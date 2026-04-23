import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MoMData } from "@/types";
import type { AIProvider } from "./interface";
import { momDataSchema } from "@/lib/validation/mom-schema";

// ─── Constants ────────────────────────────────────────────────────────────────
/** Marker prefix embedded in thrown errors so the UI can show a special banner. */
export const AI_OVERLOAD_MARKER = "[AI_OVERLOAD]";

/**
 * Model chain tried in order.
 * gemini-2.5-flash (env override) → gemini-2.0-flash → gemini-1.5-flash
 */
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

/** Max same-model retries for transient 503 errors (exponential back-off). */
const MAX_RETRIES_PER_MODEL = 2;

// ─── Error classifiers ────────────────────────────────────────────────────────
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 503 Service Unavailable — model is temporarily overloaded, worth retrying. */
function isOverload(err: unknown): boolean {
  const m = errMsg(err).toLowerCase();
  return m.includes("503") || m.includes("service unavailable") || m.includes("high demand");
}

/**
 * 429 Quota / Rate-limit — free-tier exhausted for this model.
 * Retrying the SAME model won't help; must skip to the next fallback.
 */
function isQuotaExceeded(err: unknown): boolean {
  const m = errMsg(err);
  return (
    m.includes("429") ||
    m.toLowerCase().includes("quota") ||
    m.toLowerCase().includes("rate limit") ||
    m.toLowerCase().includes("too many requests")
  );
}

/** Any error that should trigger a model-level fallback (not just a retry). */
function isFallbackable(err: unknown): boolean {
  return isOverload(err) || isQuotaExceeded(err);
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(
  transcriptText: string,
  templateDescription: string,
  promptTemplate: string
): string {
  return promptTemplate
    .replace("{{TEMPLATE_SECTIONS}}", templateDescription)
    .replace("{{TRANSCRIPT}}", transcriptText);
}

// ─── Per-model caller with retry ──────────────────────────────────────────────
/**
 * Calls generateContent on the given model.
 * - 503 (overload): retries up to MAX_RETRIES_PER_MODEL times with 2 s / 4 s back-off.
 * - 429 (quota):    throws immediately — no point retrying the same model.
 * - Other errors:   throws immediately.
 */
async function callWithRetry(
  client: GoogleGenerativeAI,
  modelName: string,
  prompt: string
): Promise<string> {
  const generativeModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
    systemInstruction:
      "You are an expert business documentation assistant. You ONLY output valid JSON. Never include markdown fences or prose outside the JSON.",
  });

  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      const result = await generativeModel.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const quota = isQuotaExceeded(err);
      const overload = isOverload(err);

      if (quota) {
        // 429 quota — skip same-model retries, let the outer loop try next model
        console.warn(`[Gemini] Model "${modelName}" quota exceeded (429). Moving to fallback.`);
        throw err;
      }

      if (overload && attempt < MAX_RETRIES_PER_MODEL) {
        const delayMs = Math.pow(2, attempt) * 2_000; // 2 s, 4 s
        console.warn(
          `[Gemini] Model "${modelName}" overloaded 503 (attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL}). Retrying in ${delayMs / 1000}s…`
        );
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      // Retries exhausted for overload, or unrelated error
      throw err;
    }
  }

  throw new Error(`[Gemini] All retries exhausted for model "${modelName}"`);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private primaryModel: string;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    this.primaryModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async extractMoM(
    transcriptText: string,
    templateDescription: string,
    promptTemplate: string
  ): Promise<MoMData> {
    const userPrompt = buildPrompt(transcriptText, templateDescription, promptTemplate);

    // Build full model chain — primary first, then deduplicated fallbacks
    const modelChain = [
      this.primaryModel,
      ...FALLBACK_MODELS.filter((m) => m !== this.primaryModel),
    ];

    let lastError: unknown;

    for (const modelName of modelChain) {
      try {
        console.log(`[Gemini] Trying model: ${modelName}`);
        const raw = await callWithRetry(this.client, modelName, userPrompt);
        const parsed = JSON.parse(raw);
        if (modelName !== this.primaryModel) {
          console.warn(`[Gemini] Succeeded with fallback model: ${modelName}`);
        }
        return momDataSchema.parse(parsed);
      } catch (err) {
        lastError = err;
        if (isFallbackable(err)) {
          // 503 overload (retries exhausted) OR 429 quota — try next model
          console.warn(
            `[Gemini] Model "${modelName}" unavailable (${isQuotaExceeded(err) ? "quota" : "overload"}). Trying next…`
          );
          continue;
        }
        // Non-transient error (bad JSON, auth, schema mismatch) — fail fast
        throw err;
      }
    }

    // All models exhausted — emit a user-friendly tagged error
    const base = errMsg(lastError);
    const isQuota = isQuotaExceeded(lastError);
    throw new Error(
      `${AI_OVERLOAD_MARKER} ${
        isQuota
          ? "The AI service's free-tier quota has been exhausted across all available models."
          : "The AI service is currently experiencing high demand across all available models."
      } Please come back in about 10 minutes and retry this job. (Detail: ${base})`
    );
  }
}

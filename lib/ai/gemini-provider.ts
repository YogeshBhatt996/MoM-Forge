import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MoMData } from "@/types";
import type { AIProvider } from "./interface";
import { momDataSchema } from "@/lib/validation/mom-schema";

// ─── Constants ────────────────────────────────────────────────────────────────
/** Marker prefix embedded in thrown errors so the UI can show a special banner. */
export const AI_OVERLOAD_MARKER = "[AI_OVERLOAD]";

/** Models to try in order when the primary is overloaded. */
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

/** How many times to retry a single model on 503 before giving up on it. */
const MAX_RETRIES_PER_MODEL = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildPrompt(
  transcriptText: string,
  templateDescription: string,
  promptTemplate: string
): string {
  return promptTemplate
    .replace("{{TEMPLATE_SECTIONS}}", templateDescription)
    .replace("{{TRANSCRIPT}}", transcriptText);
}

function is503(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.toLowerCase().includes("service unavailable") ||
    msg.toLowerCase().includes("high demand")
  );
}

/**
 * Call generateContent with exponential back-off on 503 errors.
 * Retries up to MAX_RETRIES_PER_MODEL times (delays: 2 s, 4 s).
 * Throws the original error if retries are exhausted or the error is not 503.
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
      if (is503(err) && attempt < MAX_RETRIES_PER_MODEL) {
        const delayMs = Math.pow(2, attempt) * 2_000; // 2 s, 4 s
        console.warn(
          `[Gemini] Model "${modelName}" returned 503 (attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL}). Retrying in ${delayMs / 1000}s…`
        );
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw err; // non-503 or retries exhausted — bubble up
      }
    }
  }
  // Unreachable, but TypeScript needs a return path
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

    // Build the full model chain: primary first, then fallbacks (deduplicated)
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
          console.warn(
            `[Gemini] Primary model overloaded — succeeded with fallback: ${modelName}`
          );
        }
        return momDataSchema.parse(parsed);
      } catch (err) {
        lastError = err;
        if (is503(err)) {
          console.warn(
            `[Gemini] Model "${modelName}" still unavailable after retries. Trying next fallback…`
          );
          continue; // try the next model in the chain
        }
        // Non-503 error (bad JSON, schema failure, auth, etc.) — fail immediately
        throw err;
      }
    }

    // Every model in the chain returned 503 — surface a user-friendly message
    const baseMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `${AI_OVERLOAD_MARKER} The AI service is currently experiencing high demand. ` +
        `Please come back in about 10 minutes and retry this job. ` +
        `(Technical detail: ${baseMsg})`
    );
  }
}

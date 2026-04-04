import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MoMData } from "@/types";
import type { AIProvider } from "./interface";
import { momDataSchema } from "@/lib/validation/mom-schema";

function buildPrompt(
  transcriptText: string,
  templateDescription: string,
  promptTemplate: string
): string {
  return promptTemplate
    .replace("{{TEMPLATE_SECTIONS}}", templateDescription)
    .replace("{{TRANSCRIPT}}", transcriptText);
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    this.model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async extractMoM(
    transcriptText: string,
    templateDescription: string,
    promptTemplate: string
  ): Promise<MoMData> {
    const userPrompt = buildPrompt(transcriptText, templateDescription, promptTemplate);

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
      systemInstruction:
        "You are an expert business documentation assistant. You ONLY output valid JSON. Never include markdown fences or prose outside the JSON.",
    });

    const result = await generativeModel.generateContent(userPrompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw);
    return momDataSchema.parse(parsed);
  }
}

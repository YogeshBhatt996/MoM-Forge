import OpenAI from "openai";
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

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o";
  }

  async extractMoM(
    transcriptText: string,
    templateDescription: string,
    promptTemplate: string
  ): Promise<MoMData> {
    const userPrompt = buildPrompt(transcriptText, templateDescription, promptTemplate);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert business documentation assistant. You ONLY output valid JSON. Never include markdown fences or prose outside the JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return momDataSchema.parse(parsed);
  }
}

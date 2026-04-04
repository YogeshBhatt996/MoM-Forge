// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Interface
// Swap providers (OpenAI, Anthropic, local LLM, …) by implementing this interface
// and registering the provider in factory.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { MoMData } from "@/types";

export interface AIProvider {
  /** Extract structured MoM data from a transcript using the given prompt template */
  extractMoM(
    transcriptText: string,
    templateDescription: string,
    promptTemplate: string
  ): Promise<MoMData>;
}

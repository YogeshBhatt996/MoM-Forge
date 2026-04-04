import type { AIProvider } from "./interface";

export function createAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "openai";

  switch (provider) {
    case "fake": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FakeAIProvider } = require("./fake-provider");
      return new FakeAIProvider();
    }
    case "openai": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenAIProvider } = require("./openai-provider");
      return new OpenAIProvider();
    }
    case "gemini": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GeminiProvider } = require("./gemini-provider");
      return new GeminiProvider();
    }
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${provider}". Valid options: openai | gemini | fake`
      );
  }
}

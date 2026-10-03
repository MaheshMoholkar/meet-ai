import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { env } from "@/env";

// The provider name doubles as the providerOptions key for the OpenAI-compatible provider.
const PROVIDER_NAME = "llm";

/** The text model for summaries and Ask AI: Ollama in dev, Bedrock in prod (spec §4.1). */
export function languageModel(): LanguageModel {
  if (env.LLM_PROVIDER === "bedrock") {
    return createAmazonBedrock({ region: env.AWS_REGION })(env.LLM_MODEL);
  }

  return createOpenAICompatible({
    name: PROVIDER_NAME,
    baseURL: env.LLM_BASE_URL!,
    apiKey: env.LLM_API_KEY,
  })(env.LLM_MODEL);
}

/** Per-call provider options, e.g. turning off qwen3.5's thinking on Ollama. */
export function languageModelOptions() {
  if (env.LLM_PROVIDER === "openai_compatible" && env.LLM_REASONING_EFFORT) {
    return { [PROVIDER_NAME]: { reasoningEffort: env.LLM_REASONING_EFFORT } };
  }
  return undefined;
}

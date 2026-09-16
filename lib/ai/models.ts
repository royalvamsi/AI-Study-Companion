import { AI_MODELS, estimateCost, getAIProvider } from "./router";

export { AI_MODELS, estimateCost, getAIProvider };

// Aliased model constants mapped to Gemini task routing
export const MODELS = {
  /** Primary reasoning model — tutor, assessment, complex analysis */
  primary: AI_MODELS.tutor,
  /** Fast, cost-efficient model — quiz generation, concept extraction */
  efficient: AI_MODELS.fast,
  /** Embedding model — 1536 dimensions, matches pgvector schema */
  embedding: AI_MODELS.embedding,
} as const;

export type SupportedModel = string;

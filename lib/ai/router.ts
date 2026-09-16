import { AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";

/**
 * Task-aware model identifiers routed from environment variables.
 * Defaults follow Gemini 2.5 architecture:
 * - Complex reasoning & Tutor: Gemini 2.5 Flash
 * - Lightweight generation & Concept extraction: Gemini 2.5 Flash-Lite
 * - Embeddings: Gemini Embedding
 */
export const AI_MODELS = {
  /** AI Tutor conversational & streaming interactions */
  tutor: process.env.TUTOR_MODEL || "gemini-3.5-flash",
  /** Open-ended assessment reasoning and question grading */
  assessment: process.env.ASSESSMENT_MODEL || "gemini-3.5-flash",
  /** Adaptive quiz generation */
  fast: process.env.FAST_MODEL || "gemini-3.5-flash-lite",
  /** Rapid concept extraction from uploaded study materials */
  extraction: process.env.EXTRACTION_MODEL || "gemini-3.5-flash-lite",
  /** Vector embeddings for pgvector RAG */
  embedding: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
} as const;

/**
 * Estimated token costs (USD per 1k tokens) for usage logging telemetry.
 */
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-3.5-flash-lite": { input: 0.0000375, output: 0.00015 },
  "gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-2.5-flash-lite": { input: 0.0000375, output: 0.00015 },
  "gemini-embedding-001": { input: 0.00002, output: 0 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = TOKEN_COSTS[model] ?? { input: 0.000075, output: 0.0003 };
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

// Singleton AI Provider instance
let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}

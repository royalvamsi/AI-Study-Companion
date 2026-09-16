import { getAIProvider, AI_MODELS, estimateCost } from "./router";
import { logAiUsage } from "@/lib/ai/usage-logger";

/**
 * Generate an embedding vector for a given text using Google Gemini Embedding.
 * Returns a 1536-dimension float array matching the pgvector schema.
 */
export async function generateEmbedding(
  text: string,
  options?: { userId?: string; projectId?: string }
): Promise<number[]> {
  const start = Date.now();
  const provider = getAIProvider();

  try {
    const result = await provider.embed({
      model: AI_MODELS.embedding,
      text,
      outputDimensionality: 1536,
      taskType: "RETRIEVAL_QUERY",
    });

    const latencyMs = Date.now() - start;
    // Approximating 1 token per 4 characters for embedding usage tracking
    const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));

    await logAiUsage({
      userId: options?.userId,
      projectId: options?.projectId,
      feature: "embedding",
      model: AI_MODELS.embedding,
      latencyMs,
      inputTokens: estimatedTokens,
      outputTokens: 0,
      estimatedCostUsd: estimateCost(AI_MODELS.embedding, estimatedTokens, 0),
      status: "success",
    });

    return result.values;
  } catch (error) {
    await logAiUsage({
      userId: options?.userId,
      projectId: options?.projectId,
      feature: "embedding",
      model: AI_MODELS.embedding,
      latencyMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Generate embeddings for a batch of texts using Gemini Provider.
 * Batched safely with rate-limit retries.
 */
export async function generateEmbeddings(
  texts: string[],
  options?: { userId?: string; projectId?: string }
): Promise<number[][]> {
  const start = Date.now();
  const provider = getAIProvider();

  try {
    const result = await provider.embedMany({
      model: AI_MODELS.embedding,
      texts,
      outputDimensionality: 1536,
      taskType: "RETRIEVAL_DOCUMENT",
    });

    const totalChars = texts.reduce((acc, t) => acc + t.length, 0);
    const estimatedTokens = Math.max(1, Math.ceil(totalChars / 4));

    await logAiUsage({
      userId: options?.userId,
      projectId: options?.projectId,
      feature: "embedding",
      model: AI_MODELS.embedding,
      latencyMs: Date.now() - start,
      inputTokens: estimatedTokens,
      outputTokens: 0,
      estimatedCostUsd: estimateCost(AI_MODELS.embedding, estimatedTokens, 0),
      status: "success",
    });

    return result.embeddings;
  } catch (error) {
    await logAiUsage({
      userId: options?.userId,
      projectId: options?.projectId,
      feature: "embedding",
      model: AI_MODELS.embedding,
      latencyMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

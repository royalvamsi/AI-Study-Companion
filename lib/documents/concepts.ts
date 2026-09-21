import { getAIProvider, AI_MODELS, estimateCost } from "@/lib/ai/router";
import { logAiUsage } from "@/lib/ai/usage-logger";
import { ExtractedConceptsSchema } from "@/lib/validation/schemas";
import { TextMessage } from "@/lib/ai/provider";

const CONCEPTS_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Concept name (2–5 words)" },
          description: {
            type: "string",
            description: "1–2 sentence description of what this concept is",
          },
        },
        required: ["name", "description"],
      },
      minItems: 5,
      maxItems: 20,
    },
  },
  required: ["concepts"],
};

/**
 * Extract key concepts from material text using Gemini 2.5 Flash-Lite structured output.
 * Returns a list of concepts with names and descriptions.
 */
export async function extractConcepts(
  text: string,
  materialId: string,
  userId: string,
  projectId: string
): Promise<Array<{ name: string; description: string }>> {
  const start = Date.now();
  const provider = getAIProvider();

  const systemInstruction = `You are an expert educator analyzing study materials.
Extract the key concepts, topics, and subject areas from the provided text.
Focus on concepts that a student would need to understand and be tested on.
Be specific and educational — not generic.`;

  const messages: TextMessage[] = [
    {
      role: "user",
      content: `Extract the key concepts from this study material. Return between 5 and 20 concepts in valid JSON.

Material:
${text}`,
    },
  ];

  try {
    const result = await provider.generateStructured<{
      concepts: Array<{ name: string; description: string }>;
    }>({
      model: AI_MODELS.extraction,
      systemInstruction,
      messages,
      schema: CONCEPTS_SCHEMA,
      temperature: 0.3,
      maxTokens: 2000,
    });

    const latencyMs = Date.now() - start;

    await logAiUsage({
      userId,
      projectId,
      feature: "concept_extraction",
      model: AI_MODELS.extraction,
      latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: estimateCost(
        AI_MODELS.extraction,
        result.usage.inputTokens,
        result.usage.outputTokens
      ),
      status: "success",
    });

    const parsed = ExtractedConceptsSchema.safeParse(result.data);

    if (!parsed.success) {
      console.error("Concept extraction Zod validation failed:", parsed.error);
      return [];
    }

    return parsed.data.concepts;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logAiUsage({
      userId,
      projectId,
      feature: "concept_extraction",
      model: AI_MODELS.extraction,
      latencyMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      error: errorMsg,
    });

    console.error("Concept extraction failed:", error);
    throw new Error(`Concept extraction failed: ${errorMsg}`);
  }
}

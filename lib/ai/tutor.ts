import { getAIProvider, AI_MODELS, estimateCost } from "./router";
import { logAiUsage } from "./usage-logger";
import { TextMessage } from "./provider";

export interface StreamTutorParams {
  userId: string;
  projectId: string;
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  userMessage: string;
}

/**
 * High-level AI Tutor streaming coordinator using the generic AIProvider.
 */
export async function streamTutorResponse(params: StreamTutorParams) {
  const provider = getAIProvider();
  const start = Date.now();

  const messages: TextMessage[] = [
    ...params.history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    { role: "user", content: params.userMessage },
  ];

  const streamResult = await provider.streamText({
    model: AI_MODELS.tutor,
    systemInstruction: params.systemPrompt,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  });

  return {
    textStream: streamResult.textStream,
    logUsage: async (success = true, error?: string) => {
      try {
        const usage = await streamResult.getUsage();
        const latencyMs = Date.now() - start;
        await logAiUsage({
          userId: params.userId,
          projectId: params.projectId,
          feature: "tutor_chat",
          model: AI_MODELS.tutor,
          latencyMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: estimateCost(AI_MODELS.tutor, usage.inputTokens, usage.outputTokens),
          status: success ? "success" : "error",
          error,
        });
        return usage;
      } catch {
        return { inputTokens: 0, outputTokens: 0 };
      }
    },
  };
}

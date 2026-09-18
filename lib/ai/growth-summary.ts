import { getAIProvider, AI_MODELS, estimateCost } from "@/lib/ai/router";
import { logAiUsage } from "@/lib/ai/usage-logger";
import { GrowthSummary } from "@/lib/learning/growth";

export interface GenerateGrowthNarrativeParams {
  userId: string;
  projectId?: string;
  growthSummary: GrowthSummary;
}

/**
 * Generate a 2-3 sentence coach-style narrative summarizing deterministic concept growth.
 * The LLM explains the data — it does NOT decide the classifications.
 * Logged through existing AI usage observability.
 */
export async function generateGrowthNarrative({
  userId,
  projectId,
  growthSummary,
}: GenerateGrowthNarrativeParams): Promise<string> {
  const totalConcepts =
    growthSummary.improving.length +
    growthSummary.needsAttention.length +
    growthSummary.stable.length;

  if (totalConcepts === 0) {
    return "You haven't completed any assessments yet. Take your first quiz in any project to begin tracking your mastery and growth narrative.";
  }

  const improvingNames = growthSummary.improving
    .slice(0, 3)
    .map((c) => c.conceptName)
    .join(", ");
  const needsAttentionNames = growthSummary.needsAttention
    .slice(0, 3)
    .map((c) => c.conceptName)
    .join(", ");
  const stableNames = growthSummary.stable
    .slice(0, 3)
    .map((c) => c.conceptName)
    .join(", ");

  const startTime = Date.now();
  try {
    const provider = getAIProvider();
    const prompt = `You are an encouraging, data-grounded learning coach for an AI study companion.
Summarize the student's mastery trajectory in 2-3 concise, actionable sentences based STRICTLY on the deterministic growth data below.
Do not invent any concepts, scores, or trends not provided.

Deterministic Growth Data:
- Overall Trend: ${growthSummary.overallTrend}
- Improving Concepts: ${improvingNames || "None"}
- Concepts Needing Attention: ${needsAttentionNames || "None"}
- Stable Concepts: ${stableNames || "None"}

Guidelines:
- Provide 2-3 coach-style sentences (under 60 words).
- Acknowledge what they have solidified or improved.
- Point out what requires attention or additional practice without being discouraging.
- Keep it motivating, direct, and actionable.`;

    const result = await provider.generateText({
      model: AI_MODELS.fast,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 120,
    });

    const latencyMs = Date.now() - startTime;
    await logAiUsage({
      userId,
      projectId: projectId ?? undefined,
      feature: "growth_narrative",
      model: AI_MODELS.fast,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: estimateCost(AI_MODELS.fast, result.usage.inputTokens, result.usage.outputTokens),
      latencyMs,
      status: "success",
    });

    const cleaned = result.text.trim().replace(/^["']|["']$/g, "");
    if (cleaned.length > 15) {
      return cleaned;
    }
  } catch (err) {
    console.error("Failed to generate AI growth narrative, falling back to deterministic summary:", err);
  }

  // Deterministic fallback if LLM is unavailable
  if (growthSummary.improving.length > 0 && growthSummary.needsAttention.length > 0) {
    return `You've made solid progress on ${growthSummary.improving[0].conceptName}, showing strong improvement. However, ${growthSummary.needsAttention[0].conceptName} still needs some attention and practice to lock in your understanding.`;
  } else if (growthSummary.improving.length > 0) {
    const names = growthSummary.improving.map((c) => c.conceptName).slice(0, 2).join(" and ");
    return `You're on an upward trajectory! You've solidified your grasp on ${names}, with overall performance trending positive.`;
  } else if (growthSummary.needsAttention.length > 0) {
    return `You have a few concepts requiring focused review, particularly ${growthSummary.needsAttention[0].conceptName}. Completing targeted quiz practice will help build your confidence here.`;
  } else {
    return `Your concept mastery is holding steady across your active study topics. Continue regular practice and quizzes to push your understanding to the next level.`;
  }
}

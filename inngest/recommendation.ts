import { inngest } from "@/inngest/client";
import { buildRecommendations, syncRecommendations } from "@/lib/learning/recommendations";

export const generateRecommendations = inngest.createFunction(
  {
    id: "generate-recommendations",
    name: "Generate Learning Recommendations",
    retries: 2,
    debounce: { period: "30s", key: "event.data.projectId" },
    triggers: [{ event: "learning/recommendation-requested" }],
  },
  async ({
    event,
    step,
  }: {
    event: { data: { projectId: string; userId: string; trigger: string } };
    step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
  }) => {
    const { projectId, userId } = event.data;

    const recommendations = await step.run("build-recommendations", async () => {
      return buildRecommendations(projectId, userId);
    });

    const syncResult = await step.run("persist-recommendations", async () => {
      return syncRecommendations(projectId, userId, recommendations, { emitEvents: true });
    });

    return {
      recommendationCount: recommendations.length,
      insertedCount: syncResult.insertedCount,
      updatedCount: syncResult.updatedCount,
      untouchedCount: syncResult.untouchedCount,
      supersededCount: syncResult.supersededCount,
    };
  }
);

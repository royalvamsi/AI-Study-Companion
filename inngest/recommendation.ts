import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRecommendations } from "@/lib/learning/recommendations";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";

export const generateRecommendations = inngest.createFunction(
  {
    id: "generate-recommendations",
    name: "Generate Learning Recommendations",
    retries: 2,
    debounce: { period: "30s", key: "event.data.projectId" },
    triggers: [{ event: "learning/recommendation-requested" }],
  },
  async ({ event, step }: { event: { data: { projectId: string; userId: string; trigger: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { projectId, userId } = event.data;

    const recommendations = await step.run("build-recommendations", async () => {
      return buildRecommendations(projectId, userId);
    });

    await step.run("persist-recommendations", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createAdminClient() as any;

      await supabase
        .from("recommendations")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("is_dismissed", false);

      if (recommendations.length > 0) {
        await supabase.from("recommendations").insert(recommendations);
      }

      for (const rec of recommendations) {
        await emitActivityEvent({
          projectId,
          userId,
          eventType: ActivityEventType.RECOMMENDATION_CREATED,
          payload: { priority: rec.priority, actionType: rec.action_type },
        });
      }
    });

    return { recommendationCount: recommendations.length };
  }
);

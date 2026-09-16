import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const onRepeatedMistake = inngest.createFunction(
  {
    id: "repeated-mistake",
    name: "Handle Repeated Mistake Pattern",
    retries: 2,
    triggers: [{ event: "learning/repeated-mistake" }],
  },
  async ({ event, step }: { event: { data: { projectId: string; userId: string; conceptId: string; mistakeCount: number } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { projectId, userId, conceptId, mistakeCount } = event.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // ── Step 1: Update learning context weaknesses ────────────────────────────
    await step.run("update-learning-context", async () => {
      const { data: concept } = await supabase
        .from("concepts")
        .select("name")
        .eq("id", conceptId)
        .single();

      if (!concept) return;

      const { data: context } = await supabase
        .from("learning_context")
        .select("id, weaknesses")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      if (context) {
        const weaknesses = context.weaknesses as string[];
        if (!weaknesses.includes(concept.name)) {
          await supabase
            .from("learning_context")
            .update({
              weaknesses: [...weaknesses, concept.name],
              updated_at: new Date().toISOString(),
            })
            .eq("id", context.id);
        }
      } else {
        await supabase.from("learning_context").insert({
          project_id: projectId,
          user_id: userId,
          weaknesses: [concept.name],
          strengths: [],
          preferences: [],
          important_context: [],
        });
      }
    });

    // ── Step 2: Create high-priority targeted recommendation ──────────────────
    await step.run("create-targeted-recommendation", async () => {
      await supabase
        .from("recommendations")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("concept_id", conceptId)
        .eq("is_dismissed", false);

      await supabase.from("recommendations").insert({
        project_id: projectId,
        user_id: userId,
        concept_id: conceptId,
        priority: "HIGH",
        action_type: "REVIEW",
        reasoning: `You've made mistakes on this concept ${mistakeCount} times. A focused review session is strongly recommended before attempting more questions.`,
        is_dismissed: false,
      });
    });

    return { conceptId, mistakeCount };
  }
);

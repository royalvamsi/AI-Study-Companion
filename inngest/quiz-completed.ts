import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMasteryAfterAssessment } from "@/lib/learning/mastery";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";

export const onQuizCompleted = inngest.createFunction(
  {
    id: "quiz-completed",
    name: "Quiz Completed: Update Mastery & Detect Mistakes",
    retries: 3,
    triggers: [{ event: "quiz/completed" }],
  },
  async ({ event, step }: { event: { data: { assessmentId: string; projectId: string; userId: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T>; sendEvent: (id: string, event: { name: string; data: Record<string, unknown> }) => Promise<void> } }) => {
    const { assessmentId, projectId, userId } = event.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // ── Step 1: Load assessment + questions ──────────────────────────────────
    const assessment = await step.run("load-assessment", async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(`*, assessment_questions (*)`)
        .eq("id", assessmentId)
        .single();

      if (error || !data) throw new Error(`Assessment not found: ${error?.message}`);
      return data;
    });

    // ── Step 2: Update mastery ────────────────────────────────────────────────
    await step.run("update-mastery", async () => {
      await updateMasteryAfterAssessment(assessment as Parameters<typeof updateMasteryAfterAssessment>[0], userId, projectId);

      await emitActivityEvent({
        projectId,
        userId,
        eventType: ActivityEventType.MASTERY_UPDATED,
        payload: { assessmentId },
      });
    });

    // ── Step 3: Record mistakes ───────────────────────────────────────────────
    const repeatedMistakes = await step.run("record-mistakes", async () => {
      const incorrectQuestions = (assessment.assessment_questions as Array<{ id: string; concept_id: string | null; is_correct: boolean | null }>).filter(
        (q) => q.is_correct === false && q.concept_id
      );

      const repeats: Array<{ conceptId: string; count: number }> = [];

      for (const q of incorrectQuestions) {
        const { data: existing } = await supabase
          .from("mistakes")
          .select("id, occurrence_count")
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .eq("concept_id", q.concept_id!)
          .order("last_occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const newCount = existing.occurrence_count + 1;
          await supabase
            .from("mistakes")
            .update({ occurrence_count: newCount, last_occurred_at: new Date().toISOString() })
            .eq("id", existing.id);

          if (newCount >= 3) {
            repeats.push({ conceptId: q.concept_id!, count: newCount });
          }
        } else {
          await supabase.from("mistakes").insert({
            project_id: projectId,
            user_id: userId,
            concept_id: q.concept_id!,
            question_id: q.id,
            mistake_type: "FACTUAL",
            occurrence_count: 1,
            last_occurred_at: new Date().toISOString(),
          });
        }
      }

      return repeats;
    });

    // ── Step 4: Fire repeated-mistake events ─────────────────────────────────
    for (const { conceptId, count } of repeatedMistakes) {
      await step.sendEvent(`repeated-mistake-${conceptId}`, {
        name: "learning/repeated-mistake",
        data: { projectId, userId, conceptId, mistakeCount: count },
      });
    }

    // ── Step 5: Request recommendation refresh ────────────────────────────────
    await step.sendEvent("request-recommendations", {
      name: "learning/recommendation-requested",
      data: { projectId, userId, trigger: "quiz_completed" },
    });

    return { assessmentId, repeatedMistakeCount: repeatedMistakes.length };
  }
);

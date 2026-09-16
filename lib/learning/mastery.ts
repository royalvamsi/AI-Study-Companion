import { createAdminClient } from "@/lib/supabase/admin";

type AssessmentWithQuestions = {
  id: string;
  assessment_questions: Array<{
    concept_id: string | null;
    is_correct: boolean | null;
    score: number | null;
  }>;
};

interface MasteryRecord {
  mastery_score: number;
  assessment_count: number;
}

/**
 * Update concept mastery after a completed assessment.
 *
 * Formula (transparent weighted score):
 *   newScore = previousScore * 0.6 + recentPerformance * 0.4
 */
export async function updateMasteryAfterAssessment(
  assessment: AssessmentWithQuestions,
  userId: string,
  projectId: string
): Promise<void> {
  const supabase = createAdminClient();

  const byConceptId = new Map<string, Array<{ is_correct: boolean | null; score: number | null }>>();

  for (const q of assessment.assessment_questions) {
    if (!q.concept_id) continue;
    const existing = byConceptId.get(q.concept_id) ?? [];
    existing.push({ is_correct: q.is_correct, score: q.score });
    byConceptId.set(q.concept_id, existing);
  }

  for (const [conceptId, questions] of byConceptId.entries()) {
    const answered = questions.filter((q) => q.is_correct !== null);
    if (answered.length === 0) continue;

    const recentPerformance =
      answered.reduce((sum, q) => {
        if (q.score !== null) return sum + q.score;
        return sum + (q.is_correct ? 100 : 0);
      }, 0) / answered.length;

    const { data: existingData } = await supabase
      .from("concept_mastery")
      .select("mastery_score, assessment_count")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("concept_id", conceptId)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = existingData as MasteryRecord | null;

    const previousScore = existing?.mastery_score ?? 0;
    const assessmentCount = (existing?.assessment_count ?? 0) + 1;

    const historyWeight = existing ? 0.6 : 0;
    const recentWeight = existing ? 0.4 : 1.0;
    const newScore = previousScore * historyWeight + recentPerformance * recentWeight;

    const scoreDelta = newScore - previousScore;
    const trend =
      scoreDelta > 5
        ? "IMPROVING" as const
        : scoreDelta < -5
        ? "NEEDS_ATTENTION" as const
        : "STABLE" as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("concept_mastery") as any).upsert(
      [
        {
          project_id: projectId,
          user_id: userId,
          concept_id: conceptId,
          mastery_score: Math.round(newScore * 100) / 100,
          previous_score: previousScore,
          trend,
          assessment_count: assessmentCount,
          last_assessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "project_id,user_id,concept_id" }
    );
  }
}

/**
 * Get overall project mastery (average across all concepts).
 */
export async function getProjectMastery(
  projectId: string,
  userId: string
): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("concept_mastery")
    .select("mastery_score")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as Array<{ mastery_score: number }> | null;
  if (!rows || rows.length === 0) return 0;
  const avg = rows.reduce((sum, m) => sum + m.mastery_score, 0) / rows.length;
  return Math.round(avg * 100) / 100;
}

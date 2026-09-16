import { createAdminClient } from "@/lib/supabase/admin";

export interface LearningContextSummary {
  strengths: string[];
  weaknesses: string[];
  recurringMistakes: string[];
  recentQuizScores: number[];
  formattedContext: string;
}

/**
 * Fetch persistent learning context for a student in a specific project.
 * Aggregates concept mastery strengths, weak areas needing attention,
 * recurring mistakes, and recent assessment performance.
 */
export async function getPersistentLearningContext(
  userId: string,
  projectId: string
): Promise<LearningContextSummary> {
  const supabase = createAdminClient();

  // 1. Fetch Concept Mastery (strengths & weaknesses)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: masteryRows } = await (supabase.from("concept_mastery") as any)
    .select("mastery_score, trend, concepts(name)")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (masteryRows as any[]) ?? []) {
    const conceptName = row.concepts?.name ?? "Concept";
    const score = row.mastery_score ?? 0;
    const trend = row.trend ?? "STABLE";

    if (score >= 70) {
      strengths.push(`${conceptName} (${score}%)`);
    } else if (score < 50 || trend === "NEEDS_ATTENTION") {
      weaknesses.push(`${conceptName} (${score}%, ${trend})`);
    }
  }

  // 2. Fetch Recent Recurring Mistakes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mistakeRows } = await (supabase.from("mistakes") as any)
    .select("question_text, error_type, occurrence_count")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("occurrence_count", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recurringMistakes = ((mistakeRows as any[]) ?? []).map(
    (m: { question_text?: string; error_type?: string; occurrence_count?: number }) =>
      `"${m.question_text?.slice(0, 50)}..." (${m.error_type || "conceptual gap"}, ${m.occurrence_count ?? 1}x)`
  );

  // 3. Fetch Recent Assessment Scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assessmentRows } = await (supabase.from("assessments") as any)
    .select("score, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentQuizScores = ((assessmentRows as any[]) ?? []).map((a: { score?: number }) => a.score ?? 0);

  // 4. Compose structured, bounded context for the Tutor prompt
  const sections: string[] = [];

  if (strengths.length > 0) {
    sections.push(`- Mastered Strengths: ${strengths.slice(0, 4).join(", ")}`);
  }
  if (weaknesses.length > 0) {
    sections.push(`- Weaknesses / Needs Attention: ${weaknesses.slice(0, 4).join(", ")}`);
  }
  if (recurringMistakes.length > 0) {
    sections.push(`- Recurring Mistakes: ${recurringMistakes.join("; ")}`);
  }
  if (recentQuizScores.length > 0) {
    sections.push(`- Recent Quiz Scores: ${recentQuizScores.join("%, ")}%`);
  }

  const formattedContext =
    sections.length > 0
      ? sections.join("\n")
      : "New learner in this project. No recorded mistakes or prior assessments yet.";

  return {
    strengths,
    weaknesses,
    recurringMistakes,
    recentQuizScores,
    formattedContext,
  };
}

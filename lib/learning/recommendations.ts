import { createAdminClient } from "@/lib/supabase/admin";

interface RecommendationRow {
  project_id: string;
  user_id: string;
  concept_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  action_type: string;
  reasoning: string;
  is_dismissed: boolean;
}

interface MasteryWithConcept {
  concept_id: string;
  mastery_score: number;
  trend: string | null;
  assessment_count: number;
  last_assessed_at: string | null;
  concepts: { name: string } | null;
}

interface MistakeRow {
  concept_id: string | null;
  occurrence_count: number;
}

/**
 * Deterministic recommendation engine.
 * No LLM — purely algorithmic priority scoring.
 */
export async function buildRecommendations(
  projectId: string,
  userId: string
): Promise<RecommendationRow[]> {
  const supabase = createAdminClient();

  const { data: masteryRaw } = await supabase
    .from("concept_mastery")
    .select(`
      concept_id,
      mastery_score,
      trend,
      assessment_count,
      last_assessed_at,
      concepts ( name )
    `)
    .eq("project_id", projectId)
    .eq("user_id", userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masteryData = masteryRaw as MasteryWithConcept[] | null;
  if (!masteryData || masteryData.length === 0) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: mistakeRaw } = await supabase
    .from("mistakes")
    .select("concept_id, occurrence_count")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .gte("last_occurred_at", thirtyDaysAgo);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mistakeData = mistakeRaw as MistakeRow[] | null;

  const mistakesByConceptId = new Map<string, number>();
  for (const m of mistakeData ?? []) {
    if (m.concept_id) {
      mistakesByConceptId.set(m.concept_id, (mistakesByConceptId.get(m.concept_id) ?? 0) + m.occurrence_count);
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const scored = masteryData.map((row) => {
    let score = 0;
    const mastery = row.mastery_score;
    const conceptName = row.concepts?.name ?? "Unknown";

    if (mastery < 40) score += 40;
    else if (mastery < 60) score += 20;

    const mistakes = mistakesByConceptId.get(row.concept_id) ?? 0;
    score += Math.min(mistakes * 15, 30);

    if (row.trend === "NEEDS_ATTENTION") score += 25;
    if (!row.last_assessed_at || row.last_assessed_at < sevenDaysAgo) score += 10;
    if (row.assessment_count >= 3 && mastery < 50) score += 10;

    let action_type: string;
    if (mastery < 30 || mistakes >= 3) action_type = "REVIEW";
    else if (mastery < 60) action_type = "PRACTICE";
    else action_type = "REASSESS";

    let priority: "HIGH" | "MEDIUM" | "LOW";
    if (score >= 60) priority = "HIGH";
    else if (score >= 30) priority = "MEDIUM";
    else priority = "LOW";

    const reasons: string[] = [];
    if (mastery < 40) reasons.push(`mastery is low at ${mastery.toFixed(0)}%`);
    if (mistakes >= 3) reasons.push(`${mistakes} recent mistakes recorded`);
    if (row.trend === "NEEDS_ATTENTION") reasons.push("score is declining");
    if (!row.last_assessed_at || row.last_assessed_at < sevenDaysAgo) reasons.push("not practiced recently");

    const reasoning =
      reasons.length > 0
        ? `Recommended because: ${reasons.join(", ")}.`
        : "This concept could use some attention to build stronger understanding.";

    return { conceptId: row.concept_id, conceptName, score, priority, action_type, reasoning };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.score > 0)
    .slice(0, 5);

  return top.map((r) => ({
    project_id: projectId,
    user_id: userId,
    concept_id: r.conceptId,
    priority: r.priority,
    action_type: r.action_type,
    reasoning: r.reasoning,
    is_dismissed: false,
  }));
}

import { createAdminClient } from "@/lib/supabase/admin";

export type ConceptTrend = "IMPROVING" | "STABLE" | "NEEDS_ATTENTION";

export interface ConceptGrowth {
  conceptId: string;
  conceptName: string;
  currentScore: number;
  previousScore: number | null;
  trend: ConceptTrend;
  assessmentCount: number;
  lastAssessedAt: string | null;
}

export interface GrowthSummary {
  improving: ConceptGrowth[];
  stable: ConceptGrowth[];
  needsAttention: ConceptGrowth[];
  overallTrend: ConceptTrend;
}

interface MasteryRow {
  concept_id: string;
  mastery_score: number;
  previous_score: number | null;
  trend: string | null;
  assessment_count: number;
  last_assessed_at: string | null;
  concepts: { name: string } | null;
}

/**
 * Compute growth analysis for all concepts in a project.
 */
export async function getGrowthAnalysis(
  projectId: string,
  userId: string
): Promise<GrowthSummary> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("concept_mastery")
    .select(`
      concept_id,
      mastery_score,
      previous_score,
      trend,
      assessment_count,
      last_assessed_at,
      concepts ( name )
    `)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("mastery_score", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[] | null) as MasteryRow[] | null;

  if (!rows) return { improving: [], stable: [], needsAttention: [], overallTrend: "STABLE" };

  const growthData: ConceptGrowth[] = rows.map((row) => ({
    conceptId: row.concept_id,
    conceptName: row.concepts?.name ?? "Unknown",
    currentScore: row.mastery_score,
    previousScore: row.previous_score,
    trend: (row.trend as ConceptTrend | null) ?? "STABLE",
    assessmentCount: row.assessment_count,
    lastAssessedAt: row.last_assessed_at,
  }));

  const improving = growthData.filter((c) => c.trend === "IMPROVING");
  const needsAttention = growthData.filter((c) => c.trend === "NEEDS_ATTENTION");
  const stable = growthData.filter((c) => c.trend === "STABLE");

  let overallTrend: ConceptTrend = "STABLE";
  if (improving.length > needsAttention.length * 2) overallTrend = "IMPROVING";
  else if (needsAttention.length > improving.length) overallTrend = "NEEDS_ATTENTION";

  return { improving, stable, needsAttention, overallTrend };
}

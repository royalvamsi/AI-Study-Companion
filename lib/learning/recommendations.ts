import { createAdminClient } from "@/lib/supabase/admin";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";

export interface RecommendationRow {
  id?: string;
  project_id: string;
  user_id: string;
  concept_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  action_type: string;
  reasoning: string;
  is_dismissed: boolean;
  status?: "active" | "superseded" | "resolved";
  updated_at?: string;
  created_at?: string;
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
 * Build inline recommendation reasoning string.
 * Strictly prefixes the concept name inline (Section 5 requirement).
 */
export function buildRecommendationReasoning(params: {
  conceptName: string;
  mastery: number;
  mistakes: number;
  trend: string | null;
  lastAssessedAt: string | null;
}): string {
  const reasons: string[] = [];
  if (params.mastery < 40) reasons.push(`mastery is low at ${params.mastery.toFixed(0)}%`);
  if (params.mistakes >= 3) reasons.push(`${params.mistakes} recent mistakes recorded`);
  if (params.trend === "NEEDS_ATTENTION") reasons.push("score is declining");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (!params.lastAssessedAt || params.lastAssessedAt < sevenDaysAgo) reasons.push("not practiced recently");

  return reasons.length > 0
    ? `${params.conceptName}: ${reasons.join(", ")}.`
    : `${params.conceptName}: mastery could use practice to build stronger understanding.`;
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

    const reasoning = buildRecommendationReasoning({
      conceptName,
      mastery,
      mistakes,
      trend: row.trend,
      lastAssessedAt: row.last_assessed_at,
    });

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
    status: "active" as const,
  }));
}

export interface RecommendationSyncResult {
  insertedCount: number;
  updatedCount: number;
  untouchedCount: number;
  supersededCount: number;
  activeRecommendations: RecommendationRow[];
}

/**
 * Non-destructive synchronization of recommendations.
 * - Identical active rows are left untouched (no updated_at bump, no event).
 * - Changed active rows are updated in place with updated_at = now() and event emitted.
 * - New recommendations are inserted with status = 'active' and event emitted.
 * - Active recommendations whose concepts are no longer computed are marked status = 'superseded'.
 * - Rows where is_dismissed = true are never altered or resurrected.
 */
export async function syncRecommendations(
  projectId: string,
  userId: string,
  newRecommendations: RecommendationRow[],
  options?: {
    emitEvents?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client?: any;
  }
): Promise<RecommendationSyncResult> {
  const supabase = options?.client ?? createAdminClient();

  // 1. Fetch all currently active, undismissed recommendations
  const { data: existingActiveRaw } = await supabase
    .from("recommendations")
    .select(
      "id, project_id, user_id, concept_id, priority, action_type, reasoning, is_dismissed, status, updated_at, created_at"
    )
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_dismissed", false);

  const existingActive = (existingActiveRaw ?? []) as RecommendationRow[];

  const existingByConcept = new Map<string, RecommendationRow>();
  for (const row of existingActive) {
    if (row.concept_id) {
      existingByConcept.set(row.concept_id, row);
    }
  }

  const newConceptIds = new Set<string>();
  for (const rec of newRecommendations) {
    if (rec.concept_id) {
      newConceptIds.add(rec.concept_id);
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let untouchedCount = 0;
  let supersededCount = 0;

  // 2. Upsert computed recommendations
  for (const rec of newRecommendations) {
    const existing = rec.concept_id ? existingByConcept.get(rec.concept_id) : undefined;

    if (existing) {
      const isIdentical =
        existing.priority === rec.priority &&
        existing.action_type === rec.action_type &&
        existing.reasoning === rec.reasoning;

      if (isIdentical) {
        // Untouched: do not bump updated_at, do not emit event
        untouchedCount++;
      } else {
        const now = new Date().toISOString();
        await supabase
          .from("recommendations")
          .update({
            priority: rec.priority,
            action_type: rec.action_type,
            reasoning: rec.reasoning,
            updated_at: now,
          })
          .eq("id", existing.id);

        updatedCount++;

        if (options?.emitEvents) {
          await emitActivityEvent({
            projectId,
            userId,
            eventType: ActivityEventType.RECOMMENDATION_CREATED,
            payload: { priority: rec.priority, actionType: rec.action_type },
          });
        }
      }
    } else {
      const now = new Date().toISOString();
      await supabase.from("recommendations").insert({
        project_id: rec.project_id,
        user_id: rec.user_id,
        concept_id: rec.concept_id,
        priority: rec.priority,
        action_type: rec.action_type,
        reasoning: rec.reasoning,
        is_dismissed: false,
        status: "active",
        updated_at: now,
      });

      insertedCount++;

      if (options?.emitEvents) {
        await emitActivityEvent({
          projectId,
          userId,
          eventType: ActivityEventType.RECOMMENDATION_CREATED,
          payload: { priority: rec.priority, actionType: rec.action_type },
        });
      }
    }
  }

  // 3. Mark active recommendations not in the new computed set as 'superseded'
  for (const [conceptId, row] of existingByConcept.entries()) {
    if (!newConceptIds.has(conceptId)) {
      const now = new Date().toISOString();
      await supabase
        .from("recommendations")
        .update({
          status: "superseded",
          updated_at: now,
        })
        .eq("id", row.id);

      supersededCount++;
    }
  }

  return {
    insertedCount,
    updatedCount,
    untouchedCount,
    supersededCount,
    activeRecommendations: newRecommendations,
  };
}

/**
 * Re-computes recommendations and persists them to the database non-destructively,
 * returning the top priority recommendation for immediate loop closure.
 */
export async function refreshAndGetTopRecommendation(
  projectId: string,
  userId: string
): Promise<RecommendationRow | null> {
  const recs = await buildRecommendations(projectId, userId);
  if (recs.length === 0) return null;

  await syncRecommendations(projectId, userId, recs, { emitEvents: false });

  return recs[0];
}

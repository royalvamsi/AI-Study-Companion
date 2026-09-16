export interface ConceptScoreBreakdown {
  weaknessWeight: number;
  mistakeWeight: number;
  recentPerformanceAdjustment: number;
  stalenessWeight: number;
  questionHistoryAdjustment: number;
  activityWeight: number;
  trendBonus: number;
}

export interface ConceptCandidate {
  id: string;
  name: string;
  description: string | null;
  masteryScore: number;
  trend: string;
  mistakeCount: number;
  recentScore: number | null;
  assessmentCount: number;
  lastAssessedAt: string | null;
  recentActivityCount: number;
  targetDifficulty: number;
  priorityScore: number;
  scoreBreakdown: ConceptScoreBreakdown;
}

export interface AdaptiveSelectionInput {
  concepts: Array<{ id: string; name: string; description: string | null }>;
  masteryMap: Map<
    string,
    {
      masteryScore: number;
      trend: string;
      lastAssessedAt: string | null;
      assessmentCount: number;
    }
  >;
  mistakesMap: Map<string, number>;
  recentPerformanceMap?: Map<string, number>; // average score (0-100) from recent assessments
  recentlyAssessedConceptIds?: Set<string>; // concepts assessed in immediate prior quiz
  activityMap?: Map<string, number>; // recent learning activity count per concept
  questionCount: number;
  focusConceptId?: string;
}

/**
 * Deterministic multi-signal adaptive concept selection engine.
 *
 * Implements the 7 PRD-mandated signals:
 * 1. Concept Mastery / Weakness: lower mastery yields higher selection priority.
 * 2. Recorded Mistakes: repeated errors amplify immediate review urgency.
 * 3. Recent Assessment Performance: low recent scores boost review; high recent scores reduce redundancy.
 * 4. Target Difficulty: dynamically calibrated (1-5) based on mastery, mistakes, and recent scores.
 * 5. Question History: avoids repeating recently assessed concepts when unseen alternatives exist.
 * 6. Recent Learning Activity: reinforces concepts the learner actively discussed or reviewed.
 * 7. Previous Assessment History / Staleness: concepts not evaluated recently gain staleness weight.
 */
export function selectAdaptiveConcepts({
  concepts,
  masteryMap,
  mistakesMap,
  recentPerformanceMap,
  recentlyAssessedConceptIds,
  activityMap,
  questionCount,
  focusConceptId,
}: AdaptiveSelectionInput): ConceptCandidate[] {
  if (concepts.length === 0) return [];

  const now = Date.now();

  const candidates: ConceptCandidate[] = concepts.map((concept) => {
    const masteryInfo = masteryMap.get(concept.id);
    const masteryScore = masteryInfo?.masteryScore ?? 0;
    const trend = masteryInfo?.trend ?? "STABLE";
    const lastAssessedAt = masteryInfo?.lastAssessedAt ?? null;
    const assessmentCount = masteryInfo?.assessmentCount ?? 0;
    const mistakeCount = mistakesMap.get(concept.id) ?? 0;
    const recentScore = recentPerformanceMap?.get(concept.id) ?? null;
    const wasRecentlyAssessed = recentlyAssessedConceptIds?.has(concept.id) ?? false;
    const recentActivityCount = activityMap?.get(concept.id) ?? 0;

    // ── Signal 1: Weakness Weight (0 to 35 points) ──────────────────────────
    // Lower baseline mastery indicates greater foundational learning need
    const weaknessWeight = ((100 - Math.max(0, Math.min(100, masteryScore))) / 100) * 35;

    // ── Signal 2: Recorded Mistakes (0 to 25 points) ────────────────────────
    // Concepts where student struggled and logged errors get amplified urgency
    const mistakeWeight = Math.min(mistakeCount * 8, 25);

    // ── Signal 3: Recent Assessment Performance (-15 to +20 points) ─────────
    // If recent score is low (< 50%), add up to +20 points.
    // If recent score is strong (>= 75%), apply dampener down to -15 points.
    let recentPerformanceAdjustment = 0;
    if (recentScore !== null) {
      if (recentScore < 50) {
        recentPerformanceAdjustment = ((50 - recentScore) / 50) * 20;
      } else if (recentScore >= 75) {
        recentPerformanceAdjustment = -((recentScore - 70) / 30) * 15;
      }
    }

    // ── Signal 4 & 7: Staleness / Assessment Recency (0 to 20 points) ────────
    let stalenessWeight = 10;
    if (lastAssessedAt) {
      const daysSinceAssessed = (now - new Date(lastAssessedAt).getTime()) / (1000 * 60 * 60 * 24);
      stalenessWeight = Math.min(Math.max(daysSinceAssessed * 2, 0), 20);
    } else {
      stalenessWeight = 20; // Unassessed concepts receive maximum staleness weight
    }

    // ── Signal 5: Question History / Unseen Bonus (-15 to +10 points) ───────
    // Deprioritize concepts tested in the immediate prior session (-15).
    // Prioritize virgin concepts that have never been tested (+10).
    let questionHistoryAdjustment = 0;
    if (wasRecentlyAssessed) {
      questionHistoryAdjustment = -15;
    } else if (assessmentCount === 0) {
      questionHistoryAdjustment = 10;
    }

    // ── Signal 6: Recent Learning Activity (0 to 15 points) ─────────────────
    // Student activity in tutor or review reinforces current study focus
    const activityWeight = Math.min(recentActivityCount * 5, 15);

    // Trend bonus: struggling concepts with declining score receive extra boost
    const trendBonus = trend === "NEEDS_ATTENTION" ? 15 : 0;

    // ── Composite Priority Score ────────────────────────────────────────────
    const priorityScore =
      weaknessWeight +
      mistakeWeight +
      recentPerformanceAdjustment +
      stalenessWeight +
      questionHistoryAdjustment +
      activityWeight +
      trendBonus;

    // ── Calibrated Target Difficulty (Levels 1 to 5) ────────────────────────
    let targetDifficulty = 3;

    if (masteryScore < 35 || (recentScore !== null && recentScore < 40)) {
      // Struggling: foundational facts and core definitions
      targetDifficulty = mistakeCount >= 2 || (recentScore !== null && recentScore < 25) ? 1 : 2;
    } else if (masteryScore < 65) {
      // Intermediate: application and comprehension
      if (recentScore !== null && recentScore >= 80) {
        targetDifficulty = 4; // Reward strong recent run with harder challenge
      } else {
        targetDifficulty = 3;
      }
    } else if (masteryScore < 85) {
      // Advanced: analysis and comparison
      if (recentScore !== null && recentScore < 50) {
        targetDifficulty = 3; // Step down if recent test showed unexpected slips
      } else {
        targetDifficulty = 4;
      }
    } else {
      // Mastery: synthesis, edge cases, deep reasoning
      if (recentScore !== null && recentScore < 60) {
        targetDifficulty = 4;
      } else {
        targetDifficulty = 5;
      }
    }

    return {
      id: concept.id,
      name: concept.name,
      description: concept.description,
      masteryScore,
      trend,
      mistakeCount,
      recentScore,
      assessmentCount,
      lastAssessedAt,
      recentActivityCount,
      targetDifficulty,
      priorityScore,
      scoreBreakdown: {
        weaknessWeight,
        mistakeWeight,
        recentPerformanceAdjustment,
        stalenessWeight,
        questionHistoryAdjustment,
        activityWeight,
        trendBonus,
      },
    };
  });

  // If the learner explicitly requested a focus concept, place it first
  if (focusConceptId) {
    const focused = candidates.find((c) => c.id === focusConceptId);
    if (focused) {
      const rest = candidates.filter((c) => c.id !== focusConceptId);
      rest.sort((a, b) => b.priorityScore - a.priorityScore);
      return [focused, ...rest].slice(0, questionCount);
    }
  }

  // Sort by calculated priority score descending
  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  return candidates.slice(0, Math.min(questionCount, candidates.length));
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getAIProvider, AI_MODELS, estimateCost } from "@/lib/ai/router";
import { logAiUsage } from "@/lib/ai/usage-logger";

export interface LearningContextSummary {
  learningGoal?: string | null;
  strengths: string[];
  weaknesses: string[];
  recurringMistakes: string[];
  recentQuizScores: number[];
  formattedContext: string;
}

export interface ConceptMasteryStatus {
  conceptId: string;
  conceptName: string;
  masteryScore: number | null;
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

  // 0. Fetch Project's Stated Learning Goal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectRow } = await (supabase.from("projects") as any)
    .select("learning_goal")
    .eq("id", projectId)
    .maybeSingle();

  const rawGoal = projectRow?.learning_goal;
  const learningGoal: string | null =
    typeof rawGoal === "string" && rawGoal.trim().length > 0
      ? rawGoal.trim()
      : null;

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

  if (learningGoal) {
    sections.push(`- Learning Goal: ${learningGoal}`);
  }
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
    learningGoal,
    strengths,
    weaknesses,
    recurringMistakes,
    recentQuizScores,
    formattedContext,
  };
}

/**
 * Generate an opening message for the Tutor.
 * Grounded strictly in real stored context (weaknesses, mistakes, scores).
 * If no meaningful context exists (new project), returns a plain neutral greeting
 * without fabricating weaknesses.
 */
export async function generateTutorOpeningMessage(
  userId: string,
  projectId: string,
  context: LearningContextSummary
): Promise<string> {
  const hasMeaningfulContext =
    context.weaknesses.length > 0 ||
    context.recurringMistakes.length > 0 ||
    context.recentQuizScores.length > 0;

  if (!hasMeaningfulContext) {
    return "Hello! I am your AI Study Companion for this project. How would you like to begin exploring your study materials today?";
  }

  const startTime = Date.now();
  try {
    const provider = getAIProvider();
    const prompt = `You are a personalized AI study companion for a student.
Generate a concise, encouraging opening greeting (1-2 sentences) welcoming them back to their study project.
You must ground your greeting strictly in the real learning data below. Do NOT invent, assume, or hallucinate any weaknesses, mistakes, or scores not explicitly listed.

Real Stored Learning Data:
- Weaknesses / Needs Attention: ${context.weaknesses.join(", ") || "None"}
- Recurring Mistakes: ${context.recurringMistakes.join("; ") || "None"}
- Recent Quiz Scores: ${context.recentQuizScores.join("%, ") + (context.recentQuizScores.length ? "%" : "None")}
- Strengths: ${context.strengths.join(", ") || "None"}

Instructions:
1. Greet the learner warmly.
2. Explicitly mention their most urgent weak concept or repeated mistake (if present in the data).
3. Invite them to start reviewing that concept, or ask about anything else they want to learn.
4. Keep it concise (under 40 words).`;

    const result = await provider.generateText({
      model: AI_MODELS.fast,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 100,
    });

    const latencyMs = Date.now() - startTime;
    await logAiUsage({
      userId,
      projectId,
      feature: "tutor_opening_greeting",
      model: AI_MODELS.fast,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: estimateCost(AI_MODELS.fast, result.usage.inputTokens, result.usage.outputTokens),
      latencyMs,
      status: "success",
    });

    const cleaned = result.text.trim().replace(/^["']|["']$/g, "");
    if (cleaned.length > 10) {
      return cleaned;
    }
  } catch (err) {
    console.error("Failed to generate AI opening greeting, using deterministic fallback:", err);
  }

  // Deterministic fallback using the real stored data
  if (context.weaknesses.length > 0) {
    const primaryWeakness = context.weaknesses[0].split("(")[0].trim();
    return `Welcome back! Based on your recent assessment, ${primaryWeakness} looks like a great area to strengthen. Would you like to review that together, or dive into a different topic?`;
  }
  if (context.recurringMistakes.length > 0) {
    return `Welcome back! I noticed a couple of recent questions you found tricky. Would you like to walk through them, or focus on something else today?`;
  }
  return `Welcome back! Ready to continue your learning journey? Let me know what you'd like to explore today.`;
}

/**
 * Server-side deterministic decision for comprehension checks:
 * Trigger condition:
 * - Evidence state is not INSUFFICIENT_EVIDENCE
 * - Explanation is substantive (e.g. > 100 characters)
 * - The concept being explained has mastery_score < 50 OR has no concept_mastery row yet (null)
 * - Not more than once per concept per session
 */
export function shouldTriggerComprehensionCheck(params: {
  concept: ConceptMasteryStatus | null;
  evidenceState: string;
  isSubstantive: boolean;
  alreadyCheckedConceptsInSession: Set<string>;
}): boolean {
  if (!params.concept) return false;
  if (params.evidenceState === "INSUFFICIENT_EVIDENCE") return false;
  if (!params.isSubstantive) return false;
  if (params.alreadyCheckedConceptsInSession.has(params.concept.conceptId)) return false;

  const meetsMasteryCondition =
    params.concept.masteryScore === null || params.concept.masteryScore < 50;

  return meetsMasteryCondition;
}

export function formatComprehensionCheck(conceptName: string): string {
  return `Quick check: In one or two sentences, how would you explain ${conceptName} in your own words or apply it to a practical example?`;
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getGrowthAnalysis, GrowthSummary } from "@/lib/learning/growth";

export interface ProjectActivityEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AssessmentPerformanceSummary {
  totalCompleted: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  scoreTrend: Array<{
    assessmentId: string;
    score: number;
    completedAt: string;
    questionCount: number;
  }>;
}

export interface AiActivitySummary {
  totalCalls: number;
  totalCostUsd: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  averageLatencyMs: number;
  totalTokens: number;
  callsByFeature: Record<string, number>;
  costByFeature: Record<string, number>;
}

export interface ProjectAnalyticsData {
  project: {
    id: string;
    name: string;
    description: string | null;
    learningGoal: string | null;
    createdAt: string;
  };
  activity: {
    recentEvents: ProjectActivityEvent[];
    eventCountsByType: Record<string, number>;
    totalEvents: number;
  };
  assessments: AssessmentPerformanceSummary;
  growth: GrowthSummary;
  aiUsage: AiActivitySummary;
}

/**
 * Fetch and aggregate project analytics.
 * Pure aggregation over existing database records with 0 AI model calls.
 *
 * ai_usage_logs is queried server-side only via createAdminClient() AFTER
 * explicitly verifying that the project belongs to the authenticated user.
 */
export async function getProjectAnalytics(
  projectId: string,
  userId: string
): Promise<ProjectAnalyticsData | null> {
  const supabase = createAdminClient();

  // 1. Explicit ownership verification: verify project belongs to user
  const { data: project, error: pErr } = await (supabase.from("projects") as any)
    .select("id, name, description, learning_goal, created_at, user_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (pErr || !project) {
    return null;
  }

  // 2. Fetch learning activity: recent activity_events scoped to project
  const { data: recentEventsRaw } = await (supabase.from("activity_events") as any)
    .select("id, event_type, payload, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(30);

  const recentEvents: ProjectActivityEvent[] = (recentEventsRaw || []).map((e: any) => ({
    id: e.id,
    eventType: e.event_type,
    payload: e.payload,
    createdAt: e.created_at,
  }));

  const eventCountsByType: Record<string, number> = {};
  for (const ev of recentEvents) {
    eventCountsByType[ev.eventType] = (eventCountsByType[ev.eventType] || 0) + 1;
  }

  // 3. Fetch assessment performance
  const { data: assessmentsRaw } = await (supabase.from("assessments") as any)
    .select("id, score, question_count, status, completed_at, started_at")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("started_at", { ascending: true });

  const completedAssessments = assessmentsRaw || [];
  const scores = completedAssessments
    .map((a: any) => (typeof a.score === "number" ? a.score : null))
    .filter((s: number | null): s is number => s !== null);

  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : 0;

  const scoreTrend = completedAssessments.map((a: any) => ({
    assessmentId: a.id,
    score: typeof a.score === "number" ? a.score : 0,
    completedAt: a.completed_at || a.started_at,
    questionCount: a.question_count || 0,
  }));

  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // 4. Compose existing mastery & concept trends from getGrowthAnalysis
  const growth = await getGrowthAnalysis(projectId, userId);

  // 5. Aggregate AI activity server-side with verified ownership
  const { data: aiLogsRaw } = await (supabase.from("ai_usage_logs") as any)
    .select("id, feature, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, created_at")
    .eq("project_id", projectId);

  const aiLogs: Array<{
    status: string;
    estimated_cost_usd: number | null;
    feature: string;
    latency_ms: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
  }> = aiLogsRaw || [];
  let totalCost = 0;
  let successCount = 0;
  let errorCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let totalTokens = 0;
  const callsByFeature: Record<string, number> = {};
  const costByFeature: Record<string, number> = {};

  for (const log of aiLogs) {
    if (log.status === "error") {
      errorCount++;
    } else {
      successCount++;
    }

    if (log.estimated_cost_usd) {
      const c = Number(log.estimated_cost_usd) || 0;
      totalCost += c;
      costByFeature[log.feature] = (costByFeature[log.feature] || 0) + c;
    }

    if (log.latency_ms) {
      totalLatency += log.latency_ms;
      latencyCount++;
    }

    if (log.input_tokens) totalTokens += log.input_tokens;
    if (log.output_tokens) totalTokens += log.output_tokens;

    callsByFeature[log.feature] = (callsByFeature[log.feature] || 0) + 1;
  }

  const totalCalls = aiLogs.length;
  const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 1000) / 10 : 100;
  const averageLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      learningGoal: project.learning_goal,
      createdAt: project.created_at,
    },
    activity: {
      recentEvents,
      eventCountsByType,
      totalEvents: recentEvents.length,
    },
    assessments: {
      totalCompleted: completedAssessments.length,
      averageScore,
      highestScore,
      lowestScore,
      scoreTrend,
    },
    growth,
    aiUsage: {
      totalCalls,
      totalCostUsd: Math.round(totalCost * 100000) / 100000,
      successCount,
      errorCount,
      successRate,
      averageLatencyMs,
      totalTokens,
      callsByFeature,
      costByFeature,
    },
  };
}

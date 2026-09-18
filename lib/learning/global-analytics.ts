import { createAdminClient } from "@/lib/supabase/admin";

export interface GlobalActivityEvent {
  id: string;
  projectId: string | null;
  projectName?: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProjectMasterySummary {
  projectId: string;
  projectName: string;
  averageMastery: number;
  conceptCount: number;
  completedAssessments: number;
}

export interface GlobalAnalyticsData {
  summary: {
    totalProjects: number;
    totalConceptsAssessed: number;
    overallAverageMastery: number;
    totalAssessmentsCompleted: number;
    overallAverageScore: number;
  };
  projectMasteries: ProjectMasterySummary[];
  activity: {
    recentEvents: GlobalActivityEvent[];
    eventCountsByType: Record<string, number>;
    totalEvents: number;
  };
  assessments: {
    totalCompleted: number;
    overallAverageScore: number;
    highestScore: number;
    lowestScore: number;
    scoreTrend: Array<{
      assessmentId: string;
      score: number;
      completedAt: string;
      projectName: string;
    }>;
  };
  aiUsage: {
    totalCalls: number;
    totalCostUsd: number;
    successRate: number;
    averageLatencyMs: number;
    totalTokens: number;
    callsByFeature: Record<string, number>;
    costByFeature: Record<string, number>;
  };
}

/**
 * Fetch and aggregate global analytics across all projects belonging to the authenticated user.
 * Pure aggregation with 0 AI model calls.
 *
 * ai_usage_logs is queried server-side only via createAdminClient() strictly filtered by user_id.
 */
export async function getGlobalAnalytics(userId: string): Promise<GlobalAnalyticsData> {
  const supabase = createAdminClient();

  // 1. Fetch all user projects
  const { data: projectsRaw } = await (supabase.from("projects") as any)
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const projects = (projectsRaw || []) as Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
  const projectMap = new Map<string, string>();
  for (const p of projects) {
    projectMap.set(p.id, p.name);
  }

  // 2. Fetch cross-project activity events
  const { data: eventsRaw } = await (supabase.from("activity_events") as any)
    .select("id, project_id, event_type, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  const eventCountsByType: Record<string, number> = {};
  const recentEvents: GlobalActivityEvent[] = ((eventsRaw || []) as any[]).map((e) => {
    eventCountsByType[e.event_type] = (eventCountsByType[e.event_type] || 0) + 1;
    return {
      id: e.id,
      projectId: e.project_id,
      projectName: e.project_id ? projectMap.get(e.project_id) || "Unknown Project" : undefined,
      eventType: e.event_type,
      payload: e.payload,
      createdAt: e.created_at,
    };
  });

  // 3. Fetch user concept mastery across all projects
  const { data: masteryRaw } = await (supabase.from("concept_mastery") as any)
    .select("project_id, concept_id, mastery_score, trend, assessment_count")
    .eq("user_id", userId);

  const masteryList = (masteryRaw || []) as Array<{
    project_id: string;
    concept_id: string;
    mastery_score: number;
    trend: string | null;
    assessment_count: number;
  }>;

  const projectMasteryMap = new Map<string, number[]>();
  for (const m of masteryList) {
    const scores = projectMasteryMap.get(m.project_id) || [];
    scores.push(m.mastery_score);
    projectMasteryMap.set(m.project_id, scores);
  }

  const allMasteryScores = masteryList.map((m) => m.mastery_score);
  const overallAverageMastery =
    allMasteryScores.length > 0
      ? Math.round((allMasteryScores.reduce((a: number, b: number) => a + b, 0) / allMasteryScores.length) * 10) / 10
      : 0;

  // 4. Fetch assessments across all projects
  const { data: assessmentsRaw } = await (supabase.from("assessments") as any)
    .select("id, project_id, score, question_count, status, completed_at, started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("started_at", { ascending: true });

  const completedAssessments = (assessmentsRaw || []) as Array<{
    id: string;
    project_id: string;
    score: number | null;
    question_count: number;
    status: string;
    completed_at: string | null;
    started_at: string;
  }>;

  const projectAssessmentCount = new Map<string, number>();
  for (const a of completedAssessments) {
    projectAssessmentCount.set(a.project_id, (projectAssessmentCount.get(a.project_id) || 0) + 1);
  }

  const projectMasteries: ProjectMasterySummary[] = projects.map((p) => {
    const scores = projectMasteryMap.get(p.id) || [];
    const avg = scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : 0;
    return {
      projectId: p.id,
      projectName: p.name,
      averageMastery: avg,
      conceptCount: scores.length,
      completedAssessments: projectAssessmentCount.get(p.id) || 0,
    };
  });

  const validScores = completedAssessments
    .map((a) => (typeof a.score === "number" ? a.score : null))
    .filter((s: number | null): s is number => s !== null);

  const overallAverageScore =
    validScores.length > 0
      ? Math.round((validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length) * 10) / 10
      : 0;

  const highestScore = validScores.length > 0 ? Math.max(...validScores) : 0;
  const lowestScore = validScores.length > 0 ? Math.min(...validScores) : 0;

  const scoreTrend = completedAssessments.map((a) => ({
    assessmentId: a.id,
    score: typeof a.score === "number" ? a.score : 0,
    completedAt: a.completed_at || a.started_at,
    projectName: projectMap.get(a.project_id) || "Project",
  }));

  // 5. Server-side only query of ai_usage_logs, strictly scoped by user_id
  const { data: aiLogsRaw } = await (supabase.from("ai_usage_logs") as any)
    .select("id, feature, model, latency_ms, input_tokens, output_tokens, estimated_cost_usd, status, created_at")
    .eq("user_id", userId);

  const aiLogs = (aiLogsRaw || []) as Array<{
    status: string;
    estimated_cost_usd: number | null;
    feature: string;
    latency_ms: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
  }>;

  let totalCostUsd = 0;
  let successCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let totalTokens = 0;
  const callsByFeature: Record<string, number> = {};
  const costByFeature: Record<string, number> = {};

  for (const log of aiLogs) {
    if (log.status === "success") {
      successCount++;
    }

    if (log.estimated_cost_usd) {
      const c = Number(log.estimated_cost_usd) || 0;
      totalCostUsd += c;
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
    summary: {
      totalProjects: projects.length,
      totalConceptsAssessed: masteryList.length,
      overallAverageMastery,
      totalAssessmentsCompleted: completedAssessments.length,
      overallAverageScore,
    },
    projectMasteries,
    activity: {
      recentEvents,
      eventCountsByType,
      totalEvents: recentEvents.length,
    },
    assessments: {
      totalCompleted: completedAssessments.length,
      overallAverageScore,
      highestScore,
      lowestScore,
      scoreTrend,
    },
    aiUsage: {
      totalCalls,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      successRate,
      averageLatencyMs,
      totalTokens,
      callsByFeature,
      costByFeature,
    },
  };
}

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Learning Workspace",
  description: "Your AI Study Companion dashboard — learning progress, active projects, and recommended tasks.",
};

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user profile for personal greeting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "Scholar";

  // Parallel fetch: Spaces, Projects, Mastery, Assessments, Recommendations, Activity
  // Parallel fetch: Spaces, Projects, Mastery, Assessments, Recommendations, Activity, Attention Concepts
  const [
    spacesRes,
    projectsRes,
    masteryRes,
    assessmentsRes,
    recRes,
    activityRes,
    attentionRes,
  ] = await Promise.all([
    // Spaces
    (supabase.from("spaces") as any)
      .select("*, projects(id, name, description, created_at, updated_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),

    // All projects ordered by recent activity
    (supabase.from("projects") as any)
      .select(
        "id, name, description, learning_goal, space_id, created_at, updated_at, spaces(name), materials(id, status, file_name, page_count), concepts(id)"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),

    // User concept mastery
    (supabase.from("concept_mastery") as any)
      .select("project_id, concept_id, mastery_score, trend, assessment_count")
      .eq("user_id", user.id),

    // User assessments (using started_at column and status=completed)
    (supabase.from("assessments") as any)
      .select("id, project_id, score, question_count, status, completed_at, started_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false }),

    // Top active recommendation
    (supabase.from("recommendations") as any)
      .select(
        "id, project_id, concept_id, priority, action_type, reasoning, is_dismissed, status, created_at, projects(id, name), concepts(id, name)"
      )
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Recent activity events
    (supabase.from("activity_events") as any)
      .select("id, project_id, event_type, payload, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),

    // Areas requiring attention: concepts with low mastery or NEEDS_ATTENTION trend
    (supabase.from("concept_mastery") as any)
      .select("concept_id, project_id, mastery_score, trend, assessment_count, concepts(name), projects(name)")
      .eq("user_id", user.id)
      .or("trend.eq.NEEDS_ATTENTION,mastery_score.lt.60")
      .order("mastery_score", { ascending: true })
      .limit(4),
  ]);

  const spaces = spacesRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const masteryRecords = masteryRes.data ?? [];
  const assessments = assessmentsRes.data ?? [];
  const topRecommendation = recRes.data ?? null;
  const recentActivity = activityRes.data ?? [];
  const rawAttention = attentionRes.data ?? [];

  // Snapshot analytics computed strictly from real data
  const totalConcepts = masteryRecords.length;
  const quizzesTaken = assessments.length;

  const validScores = assessments
    .map((a: any) => (typeof a.score === "number" ? a.score : null))
    .filter((s: number | null): s is number => s !== null);

  const avgScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((sum: number, s: number) => sum + s, 0) / validScores.length)
      : null;

  const overallMastery =
    totalConcepts > 0
      ? Math.round(
          masteryRecords.reduce(
            (sum: number, m: any) => sum + (m.mastery_score ?? 0),
            0
          ) / totalConcepts
        )
      : null;

  // Active "Continue Learning" project: check latest activity event first for strongest signal
  const lastActiveProjectId = recentActivity.find((e: any) => e.project_id)?.project_id;
  const continueProject =
    (lastActiveProjectId ? projects.find((p: any) => p.id === lastActiveProjectId) : null) ||
    (projects.length > 0 ? projects[0] : null);

  // Derive last activity context label for Continue Learning
  const latestEventForProject = continueProject
    ? recentActivity.find((e: any) => e.project_id === continueProject.id)
    : null;

  // Compute mastery for the continue project specifically if available
  let continueProjectMastery: number | null = null;
  if (continueProject) {
    const projMastery = masteryRecords.filter(
      (m: any) => m.project_id === continueProject.id
    );
    if (projMastery.length > 0) {
      continueProjectMastery = Math.round(
        projMastery.reduce((sum: number, m: any) => sum + (m.mastery_score ?? 0), 0) /
          projMastery.length
      );
    }
  }

  // Bounded Recent Projects (top 4 projects with their mastery computed)
  const recentProjects = projects.slice(0, 4).map((p: any) => {
    const pMastery = masteryRecords.filter((m: any) => m.project_id === p.id);
    const avgM = pMastery.length > 0
      ? Math.round(pMastery.reduce((sum: number, m: any) => sum + (m.mastery_score ?? 0), 0) / pMastery.length)
      : 0;
    return {
      ...p,
      averageMastery: avgM,
    };
  });

  // Areas Requiring Attention items
  const attentionItems = rawAttention.map((item: any) => ({
    conceptId: item.concept_id,
    projectId: item.project_id,
    conceptName: item.concepts?.name || "Unknown Concept",
    projectName: item.projects?.name || "Project",
    masteryScore: Math.round(item.mastery_score ?? 0),
    trend: item.trend || "NEEDS_ATTENTION",
    assessmentCount: item.assessment_count ?? 0,
  }));

  return (
    <DashboardContent
      userId={user.id}
      userName={displayName}
      spaces={spaces}
      projects={projects}
      recentProjects={recentProjects}
      continueProject={continueProject}
      continueProjectMastery={continueProjectMastery}
      latestActivity={latestEventForProject}
      attentionItems={attentionItems}
      snapshot={{
        totalConcepts,
        avgScore,
        quizzesTaken,
        overallMastery,
      }}
      topRecommendation={topRecommendation}
      recentActivity={recentActivity}
    />
  );
}

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { RecommendationsContent } from "@/components/recommendations/recommendations-content";
import { buildRecommendations, syncRecommendations } from "@/lib/learning/recommendations";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Study Recommendations — AI Study Companion",
  description: "Personalized, AI-generated study recommendations to boost your mastery.",
};

export default async function RecommendationsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all user's projects with 'name' column
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch recommendations with concept and project info
  const { data: existingRecs } = await supabase
    .from("recommendations")
    .select(
      `
      id,
      project_id,
      user_id,
      concept_id,
      priority,
      action_type,
      reasoning,
      is_dismissed,
      status,
      updated_at,
      created_at,
      projects (id, name),
      concepts (id, name)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let recommendations = existingRecs ?? [];

  // If no recommendations exist yet but user has projects, generate them deterministically
  const projectList = (projects as any[]) ?? [];
  if (recommendations.length === 0 && projectList.length > 0) {
    for (const p of projectList) {
      const recs = await buildRecommendations(p.id, user.id);
      if (recs.length > 0) {
        await syncRecommendations(p.id, user.id, recs, { emitEvents: true });
      }
    }

    const { data: reloaded } = await supabase
      .from("recommendations")
      .select(
        `
        id,
        project_id,
        user_id,
        concept_id,
        priority,
        action_type,
        reasoning,
        is_dismissed,
        status,
        updated_at,
        created_at,
        projects (id, name),
        concepts (id, name)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    recommendations = reloaded ?? [];
  }

  return (
    <RecommendationsContent
      initialRecommendations={(recommendations as any) ?? []}
      projects={projects ?? []}
      userId={user.id}
    />
  );
}

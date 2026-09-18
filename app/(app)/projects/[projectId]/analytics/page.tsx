import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getProjectAnalytics } from "@/lib/learning/project-analytics";
import { ProjectAnalyticsContent } from "@/components/projects/project-analytics-content";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const supabase = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase.from("projects") as any)
    .select("name")
    .eq("id", projectId)
    .single();

  return {
    title: project?.name ? `${project.name} - Analytics` : "Project Analytics",
    description: `Comprehensive learning, assessment, and AI analytics for ${project?.name ?? "project"}.`,
  };
}

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const analytics = await getProjectAnalytics(projectId, user.id);
  if (!analytics) notFound();

  return <ProjectAnalyticsContent data={analytics} />;
}

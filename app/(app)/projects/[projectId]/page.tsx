import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ProjectDetailContent } from "@/components/projects/project-detail-content";
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
    title: project?.name ?? "Project",
    description: `Study project: ${project?.name ?? ""}`,
  };
}

export default async function ProjectDetailPage({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase.from("projects") as any)
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: materials } = await (supabase.from("materials") as any)
    .select("id, file_name, file_type, status, page_count, error_message, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: concepts } = await (supabase.from("concepts") as any)
    .select("id, name, description")
    .eq("project_id", projectId)
    .order("name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mastery } = await (supabase.from("concept_mastery") as any)
    .select("concept_id, mastery_score, trend")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  return (
    <ProjectDetailContent
      project={project}
      materials={materials ?? []}
      concepts={concepts ?? []}
      mastery={mastery ?? []}
      userId={user.id}
    />
  );
}

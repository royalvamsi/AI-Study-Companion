import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ProjectsContent } from "@/components/projects/projects-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Manage your study projects — upload materials, view concepts, and track progress.",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Fetch spaces for the sidebar filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: spaces } = await (supabase.from("spaces") as any)
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  // Fetch projects, optionally filtered by space
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("projects") as any)
    .select("*, materials(id, file_name, status), concepts(id)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (params.space) {
    query = query.eq("space_id", params.space);
  }

  const { data: projects } = await query;

  return (
    <ProjectsContent
      userId={user.id}
      spaces={spaces ?? []}
      projects={projects ?? []}
      activeSpaceId={params.space ?? null}
    />
  );
}

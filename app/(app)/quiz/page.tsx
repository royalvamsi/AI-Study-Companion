import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { QuizContent } from "@/components/quiz/quiz-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz",
  description: "Test your knowledge with adaptive quizzes based on your study materials.",
};

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    projectId?: string;
    material?: string;
    materialId?: string;
  }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requestedProjectId = params.projectId || params.project || null;
  const requestedMaterialId = params.materialId || params.material || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabase.from("projects") as any)
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  // Fetch ready materials for the user's projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: materials } = await (supabase.from("materials") as any)
    .select("id, project_id, file_name, status, page_count")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("file_name");

  const userProjects = (projects ?? []) as Array<{ id: string; name: string }>;
  const userMaterials = (materials ?? []) as Array<{
    id: string;
    project_id: string;
    file_name: string;
    status: string;
    page_count: number | null;
  }>;

  let activeProjectId: string | null = null;
  let activeMaterialId: string | null = null;
  let validationNotice: string | null = null;

  if (requestedProjectId) {
    const projectMatch = userProjects.find((p) => p.id === requestedProjectId);
    if (!projectMatch) {
      validationNotice =
        "The requested study project could not be found or you do not have permission to view it.";
    } else {
      activeProjectId = projectMatch.id;
      if (requestedMaterialId) {
        const materialMatch = userMaterials.find(
          (m) => m.id === requestedMaterialId && m.project_id === activeProjectId
        );
        if (!materialMatch) {
          validationNotice =
            "The requested study material was not found in this project.";
        } else {
          activeMaterialId = materialMatch.id;
        }
      }
    }
  }

  return (
    <QuizContent
      projects={userProjects}
      materials={userMaterials}
      activeProjectId={activeProjectId}
      activeMaterialId={activeMaterialId}
      validationNotice={validationNotice}
      userId={user.id}
    />
  );
}

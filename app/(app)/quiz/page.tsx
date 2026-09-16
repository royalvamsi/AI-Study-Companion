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
  searchParams: Promise<{ project?: string; material?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

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

  return (
    <QuizContent
      projects={projects ?? []}
      materials={materials ?? []}
      activeProjectId={params.project ?? null}
      activeMaterialId={params.material ?? null}
      userId={user.id}
    />
  );
}

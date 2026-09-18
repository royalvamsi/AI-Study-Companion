import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TutorChat } from "@/components/tutor/tutor-chat";
import {
  getPersistentLearningContext,
  generateTutorOpeningMessage,
} from "@/lib/learning/learning-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tutor",
  description: "Chat with your AI tutor — ask questions about your study materials and get evidence-backed answers.",
};

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const projectId = params.project;

  // Fetch user's projects for project selector
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectsRaw } = await (supabase.from("projects") as any)
    .select("id, name, space_id, materials(id, status, file_name)")
    .eq("user_id", user.id)
    .order("name");

  let projects = (projectsRaw as any[]) ?? [];

  // If projectId is in URL, ensure the project record is loaded and included
  if (projectId && !projects.some((p) => p.id === projectId)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentProject } = await (supabase.from("projects") as any)
      .select("id, name, space_id, materials(id, status, file_name)")
      .eq("id", projectId)
      .maybeSingle();
    if (currentProject) {
      projects = [currentProject, ...projects];
    }
  }

  // If a project is selected, create or load a conversation
  let conversationId: string | null = null;
  if (projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from("conversations") as any)
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      conversationId = existing.id;
    } else if (projectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newConv } = await (supabase.from("conversations") as any)
        .insert({
          project_id: projectId,
          user_id: user.id,
          title: "New conversation",
        })
        .select("id")
        .single();
      conversationId = newConv?.id ?? null;
    }
  }

  // Load existing messages
  let messages: Array<{ id: string; role: string; content: string; sources: unknown; evidence_state: string | null; created_at: string }> = [];
  if (conversationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("messages") as any)
      .select("id, role, content, sources, evidence_state, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    messages = data ?? [];
  }

  // Section 1: Tutor opens with context, not a blank box
  let initialOpeningGreeting: string | null = null;
  if (projectId && messages.length === 0) {
    const learningContext = await getPersistentLearningContext(user.id, projectId);
    initialOpeningGreeting = await generateTutorOpeningMessage(user.id, projectId, learningContext);
  }

  return (
    <TutorChat
      projects={projects ?? []}
      activeProjectId={projectId ?? null}
      conversationId={conversationId}
      initialMessages={messages}
      initialOpeningGreeting={initialOpeningGreeting}
      userId={user.id}
    />
  );
}

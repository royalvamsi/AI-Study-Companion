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
  searchParams: Promise<{
    project?: string;
    projectId?: string;
    materialId?: string;
    material?: string;
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

  // Fetch user's projects for project selector (strictly scoped to user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectsRaw } = await (supabase.from("projects") as any)
    .select("id, name, space_id, materials(id, status, file_name, page_count)")
    .eq("user_id", user.id)
    .order("name");

  const projects = (projectsRaw as any[]) ?? [];

  let activeProjectId: string | null = null;
  let activeMaterialId: string | null = null;
  let validationNotice: string | null = null;

  if (requestedProjectId) {
    const projectMatch = projects.find((p) => p.id === requestedProjectId);
    if (!projectMatch) {
      validationNotice =
        "The requested study project could not be found or you do not have permission to view it.";
    } else {
      activeProjectId = projectMatch.id;
      if (requestedMaterialId) {
        const materialMatch = projectMatch.materials?.find(
          (m: { id: string }) => m.id === requestedMaterialId
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

  // If a project is selected, create or load a conversation
  let conversationId: string | null = null;
  if (activeProjectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from("conversations") as any)
      .select("id")
      .eq("project_id", activeProjectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      conversationId = existing.id;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newConv } = await (supabase.from("conversations") as any)
        .insert({
          project_id: activeProjectId,
          user_id: user.id,
          title: "New conversation",
        })
        .select("id")
        .single();
      conversationId = newConv?.id ?? null;
    }
  }

  // Load existing messages
  let messages: Array<{
    id: string;
    role: string;
    content: string;
    sources: unknown;
    evidence_state: string | null;
    created_at: string;
  }> = [];
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
  if (activeProjectId && messages.length === 0) {
    const learningContext = await getPersistentLearningContext(
      user.id,
      activeProjectId
    );
    initialOpeningGreeting = await generateTutorOpeningMessage(
      user.id,
      activeProjectId,
      learningContext
    );
  }

  return (
    <TutorChat
      projects={projects ?? []}
      activeProjectId={activeProjectId}
      activeMaterialId={activeMaterialId}
      validationNotice={validationNotice}
      conversationId={conversationId}
      initialMessages={messages}
      initialOpeningGreeting={initialOpeningGreeting}
      userId={user.id}
    />
  );
}

import { createAdminClient } from "@/lib/supabase/admin";

export const ActivityEventType = {
  // Project
  PROJECT_CREATED: "PROJECT_CREATED",
  // Materials
  MATERIAL_UPLOADED: "MATERIAL_UPLOADED",
  MATERIAL_PROCESSING: "MATERIAL_PROCESSING",
  MATERIAL_READY: "MATERIAL_READY",
  MATERIAL_FAILED: "MATERIAL_FAILED",
  // Tutor
  CONVERSATION_STARTED: "CONVERSATION_STARTED",
  TUTOR_MESSAGE: "TUTOR_MESSAGE",
  // Quiz
  QUIZ_STARTED: "QUIZ_STARTED",
  QUESTION_ANSWERED: "QUESTION_ANSWERED",
  QUIZ_COMPLETED: "QUIZ_COMPLETED",
  // Learning
  MASTERY_UPDATED: "MASTERY_UPDATED",
  RECOMMENDATION_CREATED: "RECOMMENDATION_CREATED",
  RECOMMENDATION_DISMISSED: "RECOMMENDATION_DISMISSED",
  MISTAKE_RECORDED: "MISTAKE_RECORDED",
} as const;

export type ActivityEventType =
  (typeof ActivityEventType)[keyof typeof ActivityEventType];

interface EmitActivityEventParams {
  projectId?: string;
  userId: string;
  eventType: ActivityEventType;
  payload?: Record<string, unknown>;
}

/**
 * Emit an activity event. Fire-and-forget — never throws.
 * Used by API routes and Inngest functions to power the activity feed and analytics.
 */
export async function emitActivityEvent(
  params: EmitActivityEventParams
): Promise<void> {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("activity_events") as any).insert({
      project_id: params.projectId ?? null,
      user_id: params.userId,
      event_type: params.eventType,
      payload: params.payload ?? {},
    });
  } catch {
    // Intentionally silent
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { streamTutorResponse } from "@/lib/ai/tutor";
import {
  retrieveChunks,
  classifyEvidenceState,
  buildTutorSystemPrompt,
  INSUFFICIENT_EVIDENCE_MESSAGE,
} from "@/lib/rag/retrieve";
import { buildCitations } from "@/lib/rag/citations";
import { createAdminClient } from "@/lib/supabase/admin";
import { TutorMessageSchema } from "@/lib/validation/schemas";
import { AIError } from "@/lib/ai/provider";
import { getPersistentLearningContext } from "@/lib/learning/learning-context";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = TutorMessageSchema.safeParse({ ...body, projectId });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { message, conversationId } = parsed.data;
    const supabase = createAdminClient();

    // 1. Retrieve relevant RAG chunks — scoped strictly to this project
    const retrievedChunks = await retrieveChunks(message, projectId, {
      userId: user.id,
      matchCount: 6,
    });

    // 2. Build citations and determine evidence state
    const citations = await buildCitations(retrievedChunks);
    const evidenceState = classifyEvidenceState(retrievedChunks);

    // 3. If INSUFFICIENT_EVIDENCE, return explicit refusal immediately without LLM world knowledge
    if (evidenceState === "INSUFFICIENT_EVIDENCE") {
      const responseMessage = INSUFFICIENT_EVIDENCE_MESSAGE;
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: responseMessage })}\n\n`)
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                evidenceState: "INSUFFICIENT_EVIDENCE",
                citations: [],
              })}\n\n`
            )
          );
          controller.close();

          if (conversationId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("messages") as any).insert([
              {
                conversation_id: conversationId,
                role: "user",
                content: message,
              },
              {
                conversation_id: conversationId,
                role: "assistant",
                content: responseMessage,
                sources: [],
                evidence_state: "INSUFFICIENT_EVIDENCE",
              },
            ]);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 4. Fetch conversation history if continuing an existing thread
    let history: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: messages } = await (supabase.from("messages") as any)
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10);

      history = messages ?? [];
    }

    // 5. Fetch structured persistent learning context (strengths, weaknesses, recurring mistakes, recent quiz performance)
    const learningContext = await getPersistentLearningContext(user.id, projectId);

    // 6. Construct Grounded System Prompt
    const systemPrompt = buildTutorSystemPrompt({
      retrievedChunks,
      evidenceState,
      masteryContext: learningContext.formattedContext,
    });

    // 6. Initiate Tutor Streaming via Gemini
    const tutorStream = await streamTutorResponse({
      userId: user.id,
      projectId,
      systemPrompt,
      history,
      userMessage: message,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of tutorStream.textStream) {
            if (chunk) {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
              );
            }
          }

          // Send citations and evidence state as final structured event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                evidenceState,
                citations,
              })}\n\n`
            )
          );

          controller.close();

          // Log usage asynchronously
          tutorStream.logUsage(true).catch(() => {});

          // Save messages to DB asynchronously
          if (conversationId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("messages") as any).insert([
              {
                conversation_id: conversationId,
                role: "user",
                content: message,
              },
              {
                conversation_id: conversationId,
                role: "assistant",
                content: fullResponse,
                sources: citations,
                evidence_state: evidenceState,
              },
            ]);
          }
        } catch (err) {
          tutorStream.logUsage(false, err instanceof Error ? err.message : String(err)).catch(() => {});
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Tutor API error:", error);
    if (error instanceof AIError) {
      const statusCode =
        error.status ||
        (error.code === "UNAVAILABLE" ? 503 : error.code === "RATE_LIMIT" ? 429 : 500);
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json(
      { error: "The AI Tutor is temporarily unavailable. Please try again in a few moments." },
      { status: 500 }
    );
  }
}

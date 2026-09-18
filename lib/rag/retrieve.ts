import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  id: string;
  materialId: string;
  content: string;
  pageNumber: number | null;
  similarity: number;
}

export type EvidenceState =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "INSUFFICIENT_EVIDENCE";

export const SUPPORTED_THRESHOLD = 0.70;
export const PARTIAL_THRESHOLD = 0.63;

/**
 * Retrieve the most relevant chunks for a query within a project.
 * This is the core RAG retrieval — always filtered by project_id.
 */
export async function retrieveChunks(
  query: string,
  projectId: string,
  options?: {
    matchCount?: number;
    userId?: string;
  }
): Promise<RetrievedChunk[]> {
  const matchCount = options?.matchCount ?? 8;

  // 1. Embed the query
  const embedding = await generateEmbedding(query, {
    userId: options?.userId,
    projectId,
  });

  // 2. Call the pgvector RPC — always scoped to this project
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_chunks", {
    query_embedding: embedding,
    match_project_id: projectId,
    match_count: matchCount,
    match_threshold: PARTIAL_THRESHOLD,
  });

  if (error) throw new Error(`RAG retrieval failed: ${error.message}`);

  return ((data ?? []) as Array<{
    id: string;
    material_id: string;
    content: string;
    page_number: number | null;
    similarity: number;
  }>).map((row) => ({
    id: row.id,
    materialId: row.material_id,
    content: row.content,
    pageNumber: row.page_number,
    similarity: row.similarity,
  }));
}

/**
 * Determine the evidence state based on the best similarity score.
 */
export function classifyEvidenceState(chunks: RetrievedChunk[]): EvidenceState {
  if (chunks.length === 0) return "INSUFFICIENT_EVIDENCE";
  const best = Math.max(...chunks.map((c) => c.similarity));
  if (best >= SUPPORTED_THRESHOLD) return "SUPPORTED";
  if (best >= PARTIAL_THRESHOLD) return "PARTIALLY_SUPPORTED";
  return "INSUFFICIENT_EVIDENCE";
}

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "I could not find sufficient evidence in the uploaded study materials for this project to answer your question. As your AI Study Tutor, I only provide explanations grounded in your project documents and cannot answer from outside knowledge.\n\nPlease ask a question related to your uploaded study materials!";

export interface TutorPromptOptions {
  retrievedChunks: RetrievedChunk[];
  evidenceState: EvidenceState;
  masteryContext?: string;
}

/**
 * Construct grounded system prompt for the AI Tutor.
 */
export function buildTutorSystemPrompt({
  retrievedChunks,
  evidenceState,
  masteryContext,
}: TutorPromptOptions): string {
  const contextStr = retrievedChunks
    .map((c, idx) => {
      const pageTag = c.pageNumber != null ? ` (Page ${c.pageNumber})` : "";
      return `[Source ${idx + 1}]${pageTag}:\n${c.content}`;
    })
    .join("\n\n");

  return `You are an AI Study Tutor for an adaptive educational platform.
You are helping a student learn and master the concepts in their study project.

STUDENT LEARNING CONTEXT:
${masteryContext || "No previous assessments recorded."}

STUDY MATERIAL CONTEXT:
${contextStr}

EVIDENCE STATE: ${evidenceState}

GROUNDING & INTEGRITY RULES:
1. STRICT GROUNDING: Answer using ONLY the provided STUDY MATERIAL CONTEXT. Do NOT answer from ungrounded general or world knowledge.
2. NO RECIPES OR UNRELATED ANSWERS: If a question is outside the scope of the study materials, do not provide recipes, tutorials, or unrelated helpful answers.
3. NO FALSE LACK OF ACCESS: NEVER claim "I do not have direct access to the PDF", "I cannot view files", or "I lack access to the document". You have the extracted study material chunks in your context above. Refer to them as "your study materials" or "the provided document".
4. PARTIAL SUPPORT: If the evidence state is PARTIALLY_SUPPORTED, address ONLY the parts of the question that are directly supported by the study material. For any parts not covered in the material, clearly and explicitly state that the study material does not contain that information. Do NOT attempt to fill in the missing information using general or world knowledge.
5. SYNTHESIS & SUMMARIES: If the student asks for a summary or main concepts of the material (e.g. "What are the main concepts discussed in this PDF?"), synthesize the key topics directly from the provided study material chunks and cite the relevant pages/sources.
6. CITATIONS: Reference specific pages or sources when answering using [Source N] or (Page X) notation based on the context. If the source material does not have page numbers (e.g. text or markdown files), cite the source filename or [Source N] directly without inventing page numbers.
7. PEDAGOGY: Be encouraging, clear, and educational. Break down complex ideas step by step using the material provided. Keep responses focused and educational.`;
}


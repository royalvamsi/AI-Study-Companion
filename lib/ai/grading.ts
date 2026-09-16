import { z } from "zod";
import { getAIProvider, AI_MODELS, estimateCost } from "./router";
import { logAiUsage } from "./usage-logger";
import { TextMessage } from "./provider";

export const GradingResultSchema = z.object({
  score: z.number().min(0).max(100),
  is_correct: z.boolean(),
  understanding: z.enum(["COMPLETE", "PARTIAL", "MINIMAL"]),
  strengths: z.array(z.string()),
  missingConcepts: z.array(z.string()),
  feedback: z.string(),
  reasoning: z.string().optional(),
});

export type GradeQuestionResult = z.infer<typeof GradingResultSchema>;

export interface GradeQuestionParams {
  userId: string;
  projectId: string;
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  conceptName?: string;
  contextStr?: string;
}

const GRADING_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Rubric score from 0 to 100 based on accuracy, completeness, and conceptual depth",
    },
    is_correct: {
      type: "boolean",
      description: "true if score >= 70, false otherwise",
    },
    understanding: {
      type: "string",
      enum: ["COMPLETE", "PARTIAL", "MINIMAL"],
      description: "Categorical evaluation of student conceptual mastery",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "Specific key concepts or points the student understood and explained correctly",
    },
    missingConcepts: {
      type: "array",
      items: { type: "string" },
      description: "Key concepts, definitions, or nuances missing from the student's explanation",
    },
    feedback: {
      type: "string",
      description: "Constructive educational feedback helping the student close the gaps",
    },
    reasoning: {
      type: "string",
      description: "Internal rubric reasoning justifying the assigned score",
    },
  },
  required: [
    "score",
    "is_correct",
    "understanding",
    "strengths",
    "missingConcepts",
    "feedback",
  ],
};

/**
 * Grade open-ended answers using Gemini structured output.
 * Evaluates conceptual understanding, accuracy, relevance, and missing concepts against model answer and study evidence.
 */
export async function gradeOpenEndedAnswer(
  params: GradeQuestionParams
): Promise<GradeQuestionResult> {
  const provider = getAIProvider();
  const start = Date.now();

  const systemInstruction = `You are an expert academic evaluator grading a student's answer to an open-ended assessment question.
Evaluate the student's answer against the model answer and target concept.

RUBRIC CRITERIA:
1. ACCURACY & UNDERSTANDING:
   - 90-100 (COMPLETE): Accurate, thorough explanation capturing the core mechanism/definition.
   - 70-89 (SATISFACTORY): Correct core understanding with minor details or terminology omitted.
   - 40-69 (PARTIAL): Partial grasp; some correct elements but critical gaps or misconceptions present.
   - 0-39 (MINIMAL): Factually incorrect, irrelevant, or minimal response.
2. STRENGTHS: Explicitly list the correct ideas or terms the student communicated.
3. MISSING CONCEPTS: Explicitly identify what was omitted or misunderstood relative to the model answer.
4. CONSTRUCTIVE FEEDBACK: Offer clear, encouraging educational guidance on how to master the missing concepts.`;

  const messages: TextMessage[] = [
    {
      role: "user",
      content: `QUESTION:
${params.questionText}

${params.conceptName ? `TARGET CONCEPT: ${params.conceptName}\n` : ""}
MODEL ANSWER / BENCHMARK:
${params.modelAnswer}

STUDENT SUBMITTED ANSWER:
${params.studentAnswer}

Evaluate the student answer and output the structured rubric assessment.`,
    },
  ];

  try {
    const result = await provider.generateStructured<GradeQuestionResult>({
      model: AI_MODELS.assessment,
      systemInstruction,
      messages,
      schema: GRADING_SCHEMA,
      temperature: 0.2,
      maxTokens: 1200,
    });

    const latencyMs = Date.now() - start;
    await logAiUsage({
      userId: params.userId,
      projectId: params.projectId,
      feature: "quiz_grading",
      model: AI_MODELS.assessment,
      latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: estimateCost(
        AI_MODELS.assessment,
        result.usage.inputTokens,
        result.usage.outputTokens
      ),
      status: "success",
    });

    const parsed = result.data;
    const score = Math.max(0, Math.min(100, Math.round(parsed?.score ?? 0)));
    const is_correct = typeof parsed?.is_correct === "boolean" ? parsed.is_correct : score >= 70;
    const understanding = parsed?.understanding || (score >= 85 ? "COMPLETE" : score >= 60 ? "PARTIAL" : "MINIMAL");
    const strengths = Array.isArray(parsed?.strengths) ? parsed.strengths : [];
    const missingConcepts = Array.isArray(parsed?.missingConcepts) ? parsed.missingConcepts : [];
    const feedback = parsed?.feedback || (is_correct ? "Well explained." : "Review the model answer to strengthen your understanding.");

    return {
      score,
      is_correct,
      understanding,
      strengths,
      missingConcepts,
      feedback,
      reasoning: parsed?.reasoning,
    };
  } catch (error) {
    await logAiUsage({
      userId: params.userId,
      projectId: params.projectId,
      feature: "quiz_grading",
      model: AI_MODELS.assessment,
      latencyMs: Date.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

import { z } from "zod";

// ── Spaces ────────────────────────────────────────────────────────────────────

export const CreateSpaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const UpdateSpaceSchema = CreateSpaceSchema.partial();

// ── Projects ──────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  learningGoal: z.string().max(300).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  learningGoal: z.string().max(300).optional(),
});

// ── Materials ─────────────────────────────────────────────────────────────────

export const UploadMaterialSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
});

// ── Tutor ─────────────────────────────────────────────────────────────────────

export const TutorMessageSchema = z.object({
  projectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(), // null = start new conversation
  message: z.string().min(1).max(4000),
});

// ── Quiz ──────────────────────────────────────────────────────────────────────

export const StartQuizSchema = z.object({
  projectId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(20).default(5),
});

export const AnswerQuestionSchema = z.object({
  assessmentId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string().min(1).max(5000),
});

export const CompleteQuizSchema = z.object({
  assessmentId: z.string().uuid(),
});

// ── LLM Structured Outputs ────────────────────────────────────────────────────

/** Zod schema for LLM-generated MCQ question */
export const McqQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).length(4),
  correctAnswer: z.string(),
  concept: z.string(),
  difficulty: z.number().int().min(1).max(5),
  explanation: z.string(),
});

/** Zod schema for LLM-generated open-ended question */
export const OpenEndedQuestionSchema = z.object({
  question: z.string(),
  concept: z.string(),
  difficulty: z.number().int().min(1).max(5),
  keyPoints: z.array(z.string()),
  rubric: z.string(),
});

/** Zod schema for LLM grading of open-ended answers */
export const GradingResultSchema = z.object({
  score: z.number().min(0).max(100),
  isCorrect: z.boolean(),
  feedback: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingConcepts: z.array(z.string()),
});

/** Zod schema for LLM-extracted concepts */
export const ExtractedConceptsSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
});

/** Zod schema for LLM recommendation explanation */
export const RecommendationSchema = z.object({
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  actionType: z.enum(["REVIEW", "PRACTICE", "REASSESS"]),
  reasoning: z.string(),
});

export type CreateSpace = z.infer<typeof CreateSpaceSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type TutorMessage = z.infer<typeof TutorMessageSchema>;
export type StartQuiz = z.infer<typeof StartQuizSchema>;
export type AnswerQuestion = z.infer<typeof AnswerQuestionSchema>;
export type McqQuestion = z.infer<typeof McqQuestionSchema>;
export type OpenEndedQuestion = z.infer<typeof OpenEndedQuestionSchema>;
export type GradingResult = z.infer<typeof GradingResultSchema>;
export type ExtractedConcepts = z.infer<typeof ExtractedConceptsSchema>;

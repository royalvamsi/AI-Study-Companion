import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { gradeOpenEndedAnswer } from "@/lib/ai/grading";
import { inngest } from "@/inngest/client";

/**
 * POST /api/projects/[projectId]/quiz/submit
 * Submit an answer to a quiz question, get deterministic/Gemini grading + structured feedback.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { assessmentId, questionId, answer } = body;
    if (!assessmentId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: "assessmentId, questionId, and answer are required" },
        { status: 400 }
      );
    }

    // Load question with concept info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: question } = await (supabase.from("assessment_questions") as any)
      .select("id, question_type, question_text, correct_answer, options, concept_id, llm_response, concepts(name)")
      .eq("id", questionId)
      .eq("assessment_id", assessmentId)
      .single();

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    let isCorrect: boolean;
    let score: number;
    let feedback: string;
    let rubricDetails: Record<string, unknown> | null = null;

    if (question.question_type === "mcq") {
      // ── Robust MCQ Answer Verification ─────────────────────────────────────
      const normAnswer = String(answer).trim().toLowerCase();
      const normCorrect = String(question.correct_answer ?? "").trim().toLowerCase();
      const options = Array.isArray(question.options) ? (question.options as string[]) : [];

      // Check direct equality
      if (normAnswer === normCorrect) {
        isCorrect = true;
      } else {
        // Handle letter-based answers ("A", "B", "C", "D")
        const letters = ["a", "b", "c", "d"];
        const answerIdx = letters.indexOf(normAnswer);
        const correctIdx = letters.indexOf(normCorrect);

        const answerText = answerIdx >= 0 && options[answerIdx] ? options[answerIdx].trim().toLowerCase() : normAnswer;
        const correctText = correctIdx >= 0 && options[correctIdx] ? options[correctIdx].trim().toLowerCase() : normCorrect;

        isCorrect = answerText === correctText;
      }

      score = isCorrect ? 100 : 0;
      feedback = isCorrect
        ? "Correct! Well done."
        : `Incorrect. The correct answer is: ${question.correct_answer}`;
    } else {
      // ── Open-ended Grading via Gemini ──────────────────────────────────────
      const gradingResult = await gradeOpenEndedAnswer({
        userId: user.id,
        projectId,
        questionText: question.question_text,
        modelAnswer: question.correct_answer,
        studentAnswer: answer,
        conceptName: question.concepts?.name,
      });

      isCorrect = gradingResult.is_correct;
      score = gradingResult.score;
      feedback = gradingResult.feedback;
      rubricDetails = {
        understanding: gradingResult.understanding,
        strengths: gradingResult.strengths,
        missingConcepts: gradingResult.missingConcepts,
        reasoning: gradingResult.reasoning,
      };
    }

    // Update question record with submission and grading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("assessment_questions") as any)
      .update({
        user_answer: answer,
        is_correct: isCorrect,
        score,
        feedback,
        answered_at: new Date().toISOString(),
        llm_response: {
          ...(typeof question.llm_response === "object" ? question.llm_response : {}),
          evaluation: rubricDetails,
        },
      })
      .eq("id", questionId);

    // Check completion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allQuestions } = await (supabase.from("assessment_questions") as any)
      .select("id, score, is_correct, answered_at")
      .eq("assessment_id", assessmentId);

    const answeredCount = (allQuestions ?? []).filter((q: { answered_at: string | null }) => q.answered_at).length;
    const totalQuestions = allQuestions?.length ?? 0;
    const isComplete = totalQuestions > 0 && answeredCount === totalQuestions;
    let finalAverageScore: number | null = null;

    if (isComplete) {
      const totalScore = (allQuestions ?? []).reduce(
        (acc: number, q: { score: number | null }) => acc + (q.score ?? 0),
        0
      );
      finalAverageScore = Math.round(totalScore / totalQuestions);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("assessments") as any)
        .update({
          status: "completed",
          score: finalAverageScore,
          completed_at: new Date().toISOString(),
        })
        .eq("id", assessmentId);

      // Trigger background workflow for mastery update and mistake tracking
      try {
        await inngest.send({
          name: "quiz/completed",
          data: {
            assessmentId,
            userId: user.id,
            projectId,
          },
        });
      } catch (e) {
        console.error("Failed to send quiz/completed Inngest event:", e);
      }
    }

    return NextResponse.json({
      questionId,
      isCorrect,
      score,
      feedback,
      isComplete,
      assessmentComplete: isComplete, // Support both client property names
      totalScore: finalAverageScore,
      correctAnswer: question.correct_answer,
      rubric: rubricDetails,
    });
  } catch (error) {
    console.error("Quiz submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

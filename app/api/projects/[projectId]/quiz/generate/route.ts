import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { selectAdaptiveConcepts } from "@/lib/learning/adaptive-selection";
import { resolveConceptForQuestion } from "@/lib/learning/concept-resolver";

// Forbidden meta-keywords that belong to product architecture, not learner curriculum
const FORBIDDEN_META_KEYWORDS = [
  "spaces and projects",
  "asynchronous material",
  "controlled ai",
  "observable ai",
  "evidence over guessing",
  "primary learning loop",
  "ai study companion loop",
  "user isolation",
  "rls policies",
  "supabase auth",
  "admin dashboard",
  "candidate challenge",
  "prd requirements",
  "product requirements",
];

/**
 * POST /api/projects/[projectId]/quiz/generate
 * Generate an adaptive quiz strictly grounded in the project's study materials.
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

    // Verify project access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project } = await (supabase.from("projects") as any)
      .select("id, name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { questionCount = 5, focusConceptId, materialId } = body;

    // ── 1. Resolve Target Study Material ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: materialsRaw } = await (supabase.from("materials") as any)
      .select("id, file_name, status, page_count")
      .eq("project_id", projectId)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    const materials = (materialsRaw ?? []) as Array<{
      id: string;
      file_name: string;
      status: string;
      page_count: number | null;
    }>;

    if (materials.length === 0) {
      return NextResponse.json(
        { error: "No ready study materials found in this project. Please upload and process study materials first." },
        { status: 400 }
      );
    }

    let targetMaterial = materials[0];
    if (materialId) {
      const found = materials.find((m) => m.id === materialId);
      if (found) targetMaterial = found;
    } else {
      // Prioritize genuine course documents over system requirements/spec documents
      const courseDoc = materials.find(
        (m) =>
          !m.file_name.toLowerCase().includes("project_requirements") &&
          !m.file_name.toLowerCase().includes("test_upload")
      );
      if (courseDoc) targetMaterial = courseDoc;
    }

    // ── 2. Scope Concepts to the Chosen Material ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conceptsRaw } = await (supabase.from("concepts") as any)
      .select("id, name, description, source_material_id")
      .eq("project_id", projectId);

    const allConcepts = (conceptsRaw ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      source_material_id: string | null;
    }>;

    // Filter concepts: strictly linked to target material, excluding any product meta concepts
    let materialConcepts = allConcepts.filter((c) => {
      const matchesMaterial = !c.source_material_id || c.source_material_id === targetMaterial.id;
      const isMeta = FORBIDDEN_META_KEYWORDS.some((kw) =>
        c.name.toLowerCase().includes(kw)
      );
      return matchesMaterial && !isMeta;
    });

    // If material-specific concepts are empty, fallback to non-meta project concepts
    if (materialConcepts.length === 0) {
      materialConcepts = allConcepts.filter(
        (c) => !FORBIDDEN_META_KEYWORDS.some((kw) => c.name.toLowerCase().includes(kw))
      );
    }

    // ── 3. Load All 7 PRD Signals for Adaptive Selection ───────────────────
    // Signal 1 & 7: Mastery, Trends, Staleness, and Lifetime Assessment Count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: masteryRaw } = await (supabase.from("concept_mastery") as any)
      .select("concept_id, mastery_score, trend, last_assessed_at, assessment_count")
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    const masteryMap = new Map<
      string,
      { masteryScore: number; trend: string; lastAssessedAt: string | null; assessmentCount: number }
    >();
    for (const m of (masteryRaw ?? []) as Array<{
      concept_id: string;
      mastery_score: number;
      trend: string | null;
      last_assessed_at: string | null;
      assessment_count: number;
    }>) {
      masteryMap.set(m.concept_id, {
        masteryScore: m.mastery_score,
        trend: m.trend ?? "STABLE",
        lastAssessedAt: m.last_assessed_at,
        assessmentCount: m.assessment_count ?? 0,
      });
    }

    // Signal 2: Recorded Mistakes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mistakesRaw } = await (supabase.from("mistakes") as any)
      .select("concept_id, occurrence_count")
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    const mistakesMap = new Map<string, number>();
    for (const m of (mistakesRaw ?? []) as Array<{ concept_id: string; occurrence_count: number }>) {
      mistakesMap.set(m.concept_id, m.occurrence_count);
    }

    // Signal 3 & 5: Recent Assessments & Question History
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentAssessmentsRaw } = await (supabase.from("assessments") as any)
      .select("id, created_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentAssessmentIds = ((recentAssessmentsRaw ?? []) as any[]).map((a) => a.id);
    const latestAssessmentId = recentAssessmentIds[0] ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recentQuestionsRaw: any[] = [];
    if (recentAssessmentIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qData } = await (supabase.from("assessment_questions") as any)
        .select("assessment_id, concept_id, question_text, score, is_correct, created_at")
        .in("assessment_id", recentAssessmentIds);
      recentQuestionsRaw = qData ?? [];
    }

    // Compute recent performance per concept (average score 0-100 on recent items)
    const recentPerformanceMap = new Map<string, number>();
    const scoresByConcept = new Map<string, number[]>();
    for (const q of recentQuestionsRaw) {
      if (q.concept_id && (q.score !== null || q.is_correct !== null)) {
        const scoreVal = q.score !== null ? q.score : q.is_correct ? 100 : 0;
        const list = scoresByConcept.get(q.concept_id) ?? [];
        list.push(scoreVal);
        scoresByConcept.set(q.concept_id, list);
      }
    }
    for (const [cid, scores] of scoresByConcept.entries()) {
      recentPerformanceMap.set(cid, scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Identify concepts and questions tested in the immediate prior assessment
    const recentlyAssessedConceptIds = new Set<string>(
      recentQuestionsRaw
        .filter((q) => q.assessment_id === latestAssessmentId && q.concept_id)
        .map((q) => q.concept_id as string)
    );
    const recentQuestionTexts = recentQuestionsRaw
      .map((q) => q.question_text as string)
      .filter(Boolean);

    // Signal 6: Recent Learning Activity
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activityRaw } = await (supabase.from("activity_events") as any)
      .select("event_type, payload")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo);

    const activityMap = new Map<string, number>();
    for (const ev of (activityRaw ?? []) as Array<{ event_type: string; payload: any }>) {
      const cid = ev.payload?.concept_id || ev.payload?.conceptId;
      if (cid) {
        activityMap.set(cid, (activityMap.get(cid) ?? 0) + 1);
      }
    }

    // ── 4. Deterministic Multi-Signal Adaptive Selection ────────────────────
    const adaptiveSelection = selectAdaptiveConcepts({
      concepts: materialConcepts,
      masteryMap,
      mistakesMap,
      recentPerformanceMap,
      recentlyAssessedConceptIds,
      activityMap,
      questionCount,
      focusConceptId,
    });

    // ── 5. Retrieve Material Chunks (Strictly Scoped to Target Material) ─────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chunksRaw } = await (supabase.from("material_chunks") as any)
      .select("id, content, page_number, chunk_index")
      .eq("project_id", projectId)
      .eq("material_id", targetMaterial.id)
      .order("chunk_index", { ascending: true })
      .limit(15);

    const materialChunks = (chunksRaw ?? []) as Array<{
      id: string;
      content: string;
      page_number: number | null;
      chunk_index: number;
    }>;

    if (materialChunks.length === 0) {
      return NextResponse.json(
        { error: "No text chunks found for this study material. Please re-process the PDF." },
        { status: 400 }
      );
    }

    const contextStr = materialChunks
      .map(
        (c, idx) =>
          `[Source ${idx + 1}] (Page ${c.page_number ?? "Unknown"}):\n${c.content}`
      )
      .join("\n\n---\n\n");

    const difficultyInstructions = adaptiveSelection
      .map(
        (c) =>
          `- Concept: "${c.name}" (Current mastery: ${c.masteryScore.toFixed(0)}%, Mistakes: ${c.mistakeCount}, Recent score: ${c.recentScore !== null ? `${c.recentScore.toFixed(0)}%` : "N/A"}) → Target Difficulty: Level ${c.targetDifficulty}/5`
      )
      .join("\n");

    // ── 6. Generate Grounded Questions via Gemini (Anti-Duplicate Guard) ─────
    const candidateConcepts = materialConcepts.map((c) => ({ id: c.id, name: c.name }));

    const generatedQuestions = await generateQuizQuestions({
      userId: user.id,
      projectId,
      materialId: targetMaterial.id,
      materialName: targetMaterial.file_name,
      questionCount,
      difficultyInstructions: difficultyInstructions || "General foundation",
      contextStr,
      recentQuestionTexts,
      availableConcepts: candidateConcepts,
    });

    if (generatedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate grounded questions from this material. Please try again." },
        { status: 500 }
      );
    }

    // ── 7. Insert Assessment & Questions Records ─────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assessment } = await (supabase.from("assessments") as any)
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: "in_progress",
        question_count: generatedQuestions.length,
      })
      .select("id")
      .single();

    if (!assessment) {
      return NextResponse.json({ error: "Failed to create assessment record" }, { status: 500 });
    }

    let unmappedCount = 0;
    const questionRows = generatedQuestions.map((q) => {
      const resolution = resolveConceptForQuestion(q.concept_name, candidateConcepts);
      if (!resolution.conceptId) {
        unmappedCount++;
      }

      return {
        assessment_id: assessment.id,
        concept_id: resolution.conceptId,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.question_type === "mcq" ? q.options : null,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
        llm_response: {
          ...q,
          material_id: targetMaterial.id,
          material_file_name: targetMaterial.file_name,
          source_page: q.source_page ?? null,
          hint: q.hint,
          explanation: q.explanation,
          concept_resolution: resolution,
        },
      };
    });

    if (candidateConcepts.length > 0 && unmappedCount > 0) {
      console.warn(
        `[QuizGenerate] Observability Warning: ${unmappedCount}/${generatedQuestions.length} questions could not be linked to a known concept in project "${project.name}" (${projectId}).`
      );
    } else if (candidateConcepts.length === 0) {
      console.warn(
        `[QuizGenerate] Observability Warning: Target material "${targetMaterial.file_name}" in project "${project.name}" has 0 concepts. All ${generatedQuestions.length} questions have concept_id = null.`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedQuestions } = await (supabase.from("assessment_questions") as any)
      .insert(questionRows)
      .select("id, question_type, question_text, options, difficulty, concept_id, llm_response");

    return NextResponse.json({
      assessmentId: assessment.id,
      materialId: targetMaterial.id,
      materialName: targetMaterial.file_name,
      questions: (insertedQuestions ?? []).map(
        (q: {
          id: string;
          question_type: string;
          question_text: string;
          options: string[] | null;
          difficulty: number | null;
          concept_id: string | null;
          llm_response: Record<string, unknown> | null;
        }) => ({
          id: q.id,
          type: q.question_type,
          text: q.question_text,
          options: q.options,
          difficulty: q.difficulty,
          conceptId: q.concept_id,
          hint: (q.llm_response?.hint as string) || null,
        })
      ),
    });
  } catch (error) {
    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  ClipboardCheck,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  Lightbulb,
  MessageSquare,
  Sparkles,
  RotateCcw,
} from "lucide-react";

interface Question {
  id: string;
  type: string;
  text: string;
  options: string[] | null;
  difficulty: number | null;
  conceptId: string | null;
  hint?: string | null;
}

interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  correctAnswer: string;
  rubric?: {
    understanding?: string;
    strengths?: string[];
    missingConcepts?: string[];
  } | null;
}

interface MaterialItem {
  id: string;
  project_id: string;
  file_name: string;
  status: string;
  page_count: number | null;
}

interface ConceptMasteryDelta {
  conceptId: string;
  conceptName?: string;
  previousScore: number;
  newScore: number;
  scoreDelta: number;
  trend: string;
}

interface CompletionRecommendation {
  concept_id: string;
  priority: string;
  action_type: string;
  reasoning: string;
}

interface QuizContentProps {
  projects: Array<{ id: string; name: string }>;
  materials: MaterialItem[];
  activeProjectId: string | null;
  activeMaterialId?: string | null;
  userId: string;
}

export function QuizContent({
  projects,
  materials,
  activeProjectId,
  activeMaterialId,
}: QuizContentProps) {
  const [selectedProject, setSelectedProject] = useState(activeProjectId ?? "");
  const [selectedMaterial, setSelectedMaterial] = useState<string>(activeMaterialId ?? "ALL");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<Map<string, AnswerResult>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [completionDeltas, setCompletionDeltas] = useState<ConceptMasteryDelta[]>([]);
  const [completionRecommendation, setCompletionRecommendation] = useState<CompletionRecommendation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Available materials filtered by selected project
  const projectMaterials = materials.filter((m) => m.project_id === selectedProject);

  async function handleGenerate() {
    if (!selectedProject) return;
    setGenerating(true);
    setQuizError(null);

    try {
      const res = await fetch(`/api/projects/${selectedProject}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCount: 5,
          materialId: selectedMaterial === "ALL" ? undefined : selectedMaterial,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `Failed to generate quiz (HTTP ${res.status})` }));
        setQuizError(err.error || "Failed to generate quiz questions.");
        return;
      }

      const data = await res.json();
      setAssessmentId(data.assessmentId);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswer("");
      setResults(new Map());
      setQuizComplete(false);
      setTotalScore(null);
      setShowHint(false);
    } catch (err) {
      console.error("Quiz generate error:", err);
      setQuizError("Failed to connect to the quiz service. Please verify your connection.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!assessmentId || !questions[currentIdx] || submitting) return;
    setSubmitting(true);
    setQuizError(null);

    try {
      const res = await fetch(`/api/projects/${selectedProject}/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          questionId: questions[currentIdx].id,
          answer: answer.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to evaluate answer" }));
        setQuizError(err.error || "Failed to submit answer. Please try again.");
        return;
      }

      const data = await res.json();
      setResults((prev) => new Map(prev).set(data.questionId, data));

      // Handle quiz completion reliably
      if (data.isComplete || data.assessmentComplete) {
        setQuizComplete(true);
        setTotalScore(data.totalScore ?? data.score ?? 0);
        if (data.masteryDeltas && Array.isArray(data.masteryDeltas)) {
          setCompletionDeltas(data.masteryDeltas);
        }
        if (data.newRecommendation) {
          setCompletionRecommendation(data.newRecommendation);
        }
      }
    } catch (err) {
      console.error("Quiz submit error:", err);
      setQuizError("Failed to evaluate answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setAnswer("");
      setShowHint(false);
    }
  }

  const currentQuestion = questions[currentIdx];
  const currentResult = currentQuestion ? results.get(currentQuestion.id) : undefined;
  const answeredCount = results.size;
  const correctCount = [...results.values()].filter((r) => r.isCorrect).length;

  const currentProject = projects.find((p) => p.id === selectedProject);
  const quizBreadcrumbItems = currentProject
    ? [
        { label: "Spaces & Projects", href: "/projects" },
        { label: currentProject.name, href: `/projects/${currentProject.id}` },
        { label: "Adaptive Quiz" },
      ]
    : [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Adaptive Quiz" },
      ];

  // ─── View 1: Setup Screen (No Quiz In Progress) ──────────────────────────
  if (questions.length === 0) {
    return (
      <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
        <Breadcrumbs items={quizBreadcrumbItems} />
        <div className="pb-6 border-b hairline">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
              Assessment
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight">
              Adaptive Quiz
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white border border-black/10 text-neutral-600 font-medium">
              Mastery Assessment
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-2 font-sans">
            Questions adapt to your mastery score and are strictly grounded in your study documents.
          </p>
        </div>

        {quizError && (
          <Alert className="border-rose-200 bg-rose-50 text-rose-800 text-xs py-3 rounded-2xl">
            <AlertDescription>{quizError}</AlertDescription>
          </Alert>
        )}

        <div className="bg-white rounded-[24px] border border-black/10 p-6 sm:p-10 subtle-shadow text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3EE] border border-black/10 text-ink flex items-center justify-center mx-auto shadow-xs">
            <ClipboardCheck className="h-7 w-7 text-neutral-700" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Prepare Your Assessment
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed font-sans">
              Select a project and optional study document. The system generates 5 adaptive questions (multiple-choice & conceptual open-ended) to evaluate your knowledge.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-lg mx-auto w-full">
            {/* Project Selector - Preserves Project Name strictly */}
            <Select
              value={selectedProject}
              onValueChange={(v) => {
                setSelectedProject(v ?? "");
                setSelectedMaterial("ALL");
              }}
            >
              <SelectTrigger className="w-full sm:w-60 bg-white border-black/15 text-ink text-xs h-10 rounded-xl">
                <SelectValue placeholder="Select project">
                  {(val: string | null) => {
                    const targetId = val || selectedProject;
                    if (!targetId) return "Select project";
                    const p = projects.find((proj) => proj.id === targetId);
                    return p?.name ?? "Select project";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-black/10 text-ink shadow-lg rounded-xl">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Material Selector - Preserves Material Name strictly */}
            {projectMaterials.length > 0 && (
              <Select
                value={selectedMaterial}
                onValueChange={(v) => setSelectedMaterial(v ?? "ALL")}
              >
                <SelectTrigger className="w-full sm:w-56 bg-white border-black/15 text-ink text-xs h-10 rounded-xl">
                  <SelectValue placeholder="All Materials">
                    {(val: string | null) => {
                      const cur = val || selectedMaterial;
                      if (cur === "ALL") return "All Materials (Combined)";
                      const m = projectMaterials.find((mat) => mat.id === cur);
                      return m?.file_name ?? "Select material";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-black/10 text-ink shadow-lg rounded-xl">
                  <SelectItem value="ALL">All Materials (Combined)</SelectItem>
                  {projectMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.file_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!selectedProject || generating}
              className="w-full sm:w-auto bg-orange hover:bg-[#D44F19] text-white text-xs font-medium h-10 px-6 shrink-0 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating Quiz…
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Start Assessment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── View 2: Quiz Complete (Results & Mastery Review) ─────────────────────
  if (quizComplete) {
    return (
      <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto space-y-8 selection:bg-orange/20 selection:text-orange">
        <Breadcrumbs items={quizBreadcrumbItems} />
        <div className="pb-6 border-b hairline">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-orange orange-dot" />
            <span className="text-[11px] uppercase tracking-[.18em] font-semibold text-neutral-500">
              Evaluation
            </span>
          </div>
          <h1 className="display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight">
            Assessment Results
          </h1>
          <p className="text-sm text-neutral-600 mt-2 font-sans">
            Review your answers, scoring feedback, and concept mastery updates.
          </p>
        </div>

        <div className="bg-white rounded-[24px] border border-black/10 p-6 sm:p-8 subtle-shadow text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F3EE] border border-black/10 text-ink flex items-center justify-center mx-auto shadow-xs">
            <Trophy className="h-8 w-8 text-orange" />
          </div>

          <div className="space-y-1">
            <h3 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight font-sans">
              {totalScore !== null ? `${totalScore.toFixed(0)}%` : "Complete"}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 font-sans">
              {correctCount} of {questions.length} questions correctly answered
            </p>
          </div>

          <div className="max-w-xs mx-auto h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-ink rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, totalScore ?? 0))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Button
              onClick={() => {
                setQuestions([]);
                setAssessmentId(null);
                setResults(new Map());
                setQuizComplete(false);
                setTotalScore(null);
                setCompletionDeltas([]);
                setCompletionRecommendation(null);
              }}
              variant="outline"
              size="sm"
              className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-9 px-4 rounded-xl font-medium shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
              Take Another Quiz
            </Button>
            <Link href="/growth">
              <Button
                size="sm"
                className="bg-ink hover:bg-neutral-800 text-white text-xs h-9 px-4 rounded-xl font-medium shadow-xs transition-colors cursor-pointer"
              >
                View Concept Growth &rarr;
              </Button>
            </Link>
          </div>
        </div>

        {/* Section 4: Loop Closure - Mastery Deltas & Immediate Recommendations */}
        {((completionDeltas && completionDeltas.length > 0) || completionRecommendation) && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
                Learning Loop Updates
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mastery Deltas */}
              {completionDeltas && completionDeltas.length > 0 && (
                <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink font-sans">
                      Concept Mastery Updated
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 border border-black/5 text-neutral-700 font-medium">
                      Live Deltas
                    </span>
                  </div>
                  <div className="space-y-2">
                    {completionDeltas.map((d) => (
                      <div key={d.conceptId} className="flex items-center justify-between text-xs py-1 border-b hairline last:border-0">
                        <span className="font-medium text-ink truncate mr-2">
                          {d.conceptName || "Concept"}
                        </span>
                        <div className="flex items-center gap-1.5 font-sans text-[11px] shrink-0">
                          <span className="text-neutral-400">{d.previousScore.toFixed(0)}%</span>
                          <span className="text-neutral-400">&rarr;</span>
                          <span className={d.scoreDelta >= 0 ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
                            {d.newScore.toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            ({d.scoreDelta >= 0 ? `+${d.scoreDelta.toFixed(0)}` : d.scoreDelta.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immediate New Recommendation */}
              {completionRecommendation && (
                <div className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink font-sans">
                      New Study Recommendation
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold uppercase tracking-wider">
                      {completionRecommendation.priority || "Action"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-700 leading-relaxed">
                    <p className="font-semibold text-ink mb-1 font-sans">
                      {completionRecommendation.action_type === "REVIEW"
                        ? "Review Concept"
                        : completionRecommendation.action_type === "PRACTICE"
                        ? "Practice Questions"
                        : "Follow-up Quiz"}
                    </p>
                    <p className="text-neutral-500 text-[11px]">
                      {completionRecommendation.reasoning}
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link href={`/tutor?project=${selectedProject}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-black/10 bg-white hover:bg-neutral-50 text-ink text-xs h-8 px-3 rounded-xl font-medium cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3 mr-1 text-neutral-500" />
                        Ask Tutor About This
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detailed Question Review List */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[.18em] text-neutral-500">
            Answer Review & Rubrics
          </h3>

          {questions.map((q, i) => {
            const r = results.get(q.id);
            const isCorrect = r?.isCorrect;

            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-black/10 p-5 subtle-shadow space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="text-[11px] font-semibold text-neutral-400 block mb-0.5 uppercase tracking-wider">
                        Question {i + 1} • {q.type === "mcq" ? "Multiple Choice" : "Open-Ended"}
                      </span>
                      <p className="text-sm font-semibold text-ink leading-snug">
                        {q.text}
                      </p>
                    </div>
                  </div>

                  {r && (
                    <span
                      className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isCorrect
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {r.score.toFixed(0)}%
                    </span>
                  )}
                </div>

                {r && (
                  <div className="p-4 rounded-xl bg-[#F9F8F5] border border-black/5 text-xs space-y-2">
                    <p className="text-neutral-700 leading-relaxed">
                      <span className="font-semibold text-ink">Feedback:</span> {r.feedback}
                    </p>

                    {/* Rubric Details for Open-Ended */}
                    {r.rubric && (
                      <div className="pt-2 border-t hairline space-y-1.5 text-[11px]">
                        {r.rubric.strengths && r.rubric.strengths.length > 0 && (
                          <p className="text-emerald-800">
                            <span className="font-semibold">Strengths:</span>{" "}
                            {r.rubric.strengths.join(", ")}
                          </p>
                        )}
                        {r.rubric.missingConcepts && r.rubric.missingConcepts.length > 0 && (
                          <p className="text-amber-800">
                            <span className="font-semibold">Conceptual Gaps:</span>{" "}
                            {r.rubric.missingConcepts.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Ask Tutor on Wrong Answer */}
                {!isCorrect && (
                  <div className="pt-1 flex items-center justify-end">
                    <Link href={`/tutor?project=${selectedProject}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-orange hover:underline px-2.5 font-medium cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Ask Tutor about this concept &rarr;
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── View 3: Active Question View ─────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#F5F3EE] text-ink font-sans antialiased p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto space-y-6 selection:bg-orange/20 selection:text-orange">
      <Breadcrumbs items={quizBreadcrumbItems} />
      {/* Step Header & Progress Bar */}
      <div className="space-y-2 pb-4 border-b hairline">
        <div className="flex items-center justify-between text-xs font-sans">
          <span className="font-bold text-ink tracking-wide">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className="text-neutral-500">
            {answeredCount} answered • {correctCount} correct
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
          <div
            className="h-full bg-orange rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {quizError && (
        <Alert className="border-rose-200 bg-rose-50 text-rose-800 text-xs py-2.5 rounded-xl">
          <AlertDescription>{quizError}</AlertDescription>
        </Alert>
      )}

      {/* Active Question Card */}
      <div className="bg-white rounded-[24px] border border-black/10 p-6 sm:p-8 subtle-shadow space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#F5F3EE] border border-black/5 text-neutral-700 font-medium">
                {currentQuestion?.type === "mcq" ? "Multiple Choice" : "Open-Ended"}
              </span>
              {currentQuestion?.difficulty && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange/10 text-orange border border-orange/20 font-medium">
                  Difficulty: {currentQuestion.difficulty}/5
                </span>
              )}
            </div>

            {currentQuestion?.hint && !currentResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHint(!showHint)}
                className="text-xs text-neutral-600 hover:text-ink h-7 px-2.5 rounded-lg cursor-pointer"
              >
                <Lightbulb className="h-3.5 w-3.5 mr-1 text-orange" />
                {showHint ? "Hide Hint" : "Hint"}
              </Button>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-ink leading-snug font-sans">
            {currentQuestion?.text}
          </h2>

          {showHint && currentQuestion?.hint && (
            <div className="p-3.5 rounded-xl bg-[#F9F8F5] border border-black/5 text-xs text-neutral-700 flex items-start gap-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-orange mt-0.5" />
              <span className="leading-relaxed">{currentQuestion.hint}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-1">
          {/* Question Input / Option Selector */}
          {currentQuestion?.type === "mcq" && currentQuestion.options ? (
            <div className="space-y-2.5">
              {currentQuestion.options.map((option, oi) => {
                const letter = String.fromCharCode(65 + oi);
                const isSelected =
                  answer === letter || answer.toLowerCase() === option.toLowerCase();
                const isAnswered = !!currentResult;

                // Robust check for correct option
                const isCorrectOption =
                  isAnswered &&
                  (currentResult?.correctAnswer?.toLowerCase() === option.toLowerCase() ||
                    currentResult?.correctAnswer?.toUpperCase() === letter);

                let optionStyle =
                  "bg-white border-black/10 text-neutral-800 hover:bg-neutral-50 hover:border-black/20";

                if (isAnswered) {
                  if (isCorrectOption) {
                    optionStyle = "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium";
                  } else if (isSelected && !currentResult?.isCorrect) {
                    optionStyle = "bg-rose-50 border-rose-300 text-rose-900";
                  } else {
                    optionStyle = "bg-[#F9F8F5] border-black/5 text-neutral-400";
                  }
                } else if (isSelected) {
                  optionStyle = "bg-orange/5 border-orange text-ink font-medium ring-1 ring-orange/30";
                }

                return (
                  <button
                    key={oi}
                    onClick={() => !isAnswered && setAnswer(option)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs sm:text-sm flex items-start gap-3 cursor-pointer ${optionStyle}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        isSelected || isCorrectOption
                          ? "bg-orange text-white"
                          : "bg-[#F5F3EE] text-neutral-600 border border-black/5"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 mt-0.5 leading-relaxed font-sans">{option}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your explanation using concepts from your study materials..."
                rows={5}
                disabled={!!currentResult}
                className="bg-white border-black/15 text-ink text-xs sm:text-sm placeholder:text-neutral-400 resize-none rounded-xl focus-visible:ring-1 focus-visible:ring-orange focus-visible:border-orange shadow-xs"
              />
            </div>
          )}

          {/* Answer Evaluation Feedback */}
          {currentResult && (
            <div
              className={`rounded-xl p-4 text-xs space-y-2 ${
                currentResult.isCorrect
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm">
                  {currentResult.isCorrect ? "✓ Correct!" : "✗ Needs Review"}
                </span>
                <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-white border border-black/5">
                  {currentResult.score.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs leading-relaxed">{currentResult.feedback}</p>

              {currentResult.rubric && (
                <div className="pt-2 border-t hairline space-y-1 text-[11px]">
                  {currentResult.rubric.strengths && currentResult.rubric.strengths.length > 0 && (
                    <p className="text-emerald-800">
                      <span className="font-semibold">Strengths:</span>{" "}
                      {currentResult.rubric.strengths.join(", ")}
                    </p>
                  )}
                  {currentResult.rubric.missingConcepts && currentResult.rubric.missingConcepts.length > 0 && (
                    <p className="text-amber-800">
                      <span className="font-semibold">Missing Elements:</span>{" "}
                      {currentResult.rubric.missingConcepts.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Ask Tutor CTA on Wrong Answer */}
              {!currentResult.isCorrect && (
                <div className="pt-2 flex items-center justify-between border-t hairline text-[11px]">
                  <span className="text-neutral-600">Stuck on this question?</span>
                  <Link
                    href={`/tutor?project=${selectedProject}`}
                    className="text-orange hover:underline font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Ask Tutor about this &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t hairline">
            {!currentResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={!answer.trim() || submitting}
                className="bg-orange hover:bg-[#D44F19] text-white text-xs font-medium h-10 px-6 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Evaluating Answer…
                  </>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            ) : currentIdx < questions.length - 1 ? (
              <Button
                onClick={handleNext}
                className="bg-ink hover:bg-neutral-800 text-white text-xs font-medium h-10 px-5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Next Question
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

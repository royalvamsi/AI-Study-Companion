"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FileText,
  MessageSquare,
  HelpCircle,
  Sparkles,
  RotateCcw,
  BookOpen,
  Check,
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <Breadcrumbs items={quizBreadcrumbItems} />
        <div className="pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Adaptive Quiz
            </h1>
            <Badge
              variant="outline"
              className="bg-indigo-500/10 text-indigo-300 border-indigo-500/25 text-xs"
            >
              Mastery Assessment
            </Badge>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Questions adapt to your mastery score and are strictly grounded in your study documents.
          </p>
        </div>

        {quizError && (
          <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs py-3">
            <AlertDescription>{quizError}</AlertDescription>
          </Alert>
        )}

        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shadow-md">
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <ClipboardCheck className="h-7 w-7" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Prepare Your Assessment
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Select a project and optional study document. The system will generate 5 adaptive questions (multiple-choice & conceptual open-ended) to evaluate your knowledge.
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
                <SelectTrigger className="w-full sm:w-60 bg-slate-800/60 border-slate-700 text-slate-200 text-xs h-9.5">
                  <SelectValue placeholder="Select project">
                    {(val: string | null) => {
                      const targetId = val || selectedProject;
                      if (!targetId) return "Select project";
                      const p = projects.find((proj) => proj.id === targetId);
                      return p?.name ?? "Select project";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
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
                  <SelectTrigger className="w-full sm:w-56 bg-slate-800/60 border-slate-700 text-slate-200 text-xs h-9.5">
                    <SelectValue placeholder="All Materials">
                      {(val: string | null) => {
                        const cur = val || selectedMaterial;
                        if (cur === "ALL") return "All Materials (Combined)";
                        const m = projectMaterials.find((mat) => mat.id === cur);
                        return m?.file_name ?? "Select material";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
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
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-9.5 px-5 shrink-0 shadow-sm"
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── View 2: Quiz Complete (Results & Mastery Review) ─────────────────────
  if (quizComplete) {
    const passed = (totalScore ?? 0) >= 70;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <Breadcrumbs items={quizBreadcrumbItems} />
        <div className="pb-2 border-b border-slate-800/60">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Assessment Results
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Review your answers, scoring feedback, and concept mastery updates.
          </p>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shadow-md text-center p-6 sm:p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {totalScore !== null ? `${totalScore.toFixed(0)}%` : "Complete"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              {correctCount} of {questions.length} questions correctly answered
            </p>
          </div>

          <Progress
            value={totalScore ?? 0}
            className="max-w-xs mx-auto h-2 bg-slate-800"
          />

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
              className="border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white text-xs h-9 px-4"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Take Another Quiz
            </Button>
            <Link href="/growth">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-4 shadow-sm"
              >
                View Concept Growth &rarr;
              </Button>
            </Link>
          </div>
        </Card>

        {/* Section 4: Loop Closure - Mastery Deltas & Immediate Recommendations */}
        {((completionDeltas && completionDeltas.length > 0) || completionRecommendation) && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Learning Loop Updates
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Mastery Deltas */}
              {completionDeltas && completionDeltas.length > 0 && (
                <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold text-slate-300">
                      Concept Mastery Updated
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                      Live Deltas
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {completionDeltas.map((d) => (
                      <div key={d.conceptId} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                        <span className="font-medium text-slate-200 truncate mr-2">
                          {d.conceptName || "Concept"}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                          <span className="text-slate-400">{d.previousScore.toFixed(0)}%</span>
                          <span className="text-slate-600">&rarr;</span>
                          <span className={d.scoreDelta >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                            {d.newScore.toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({d.scoreDelta >= 0 ? `+${d.scoreDelta.toFixed(0)}` : d.scoreDelta.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Immediate New Recommendation */}
              {completionRecommendation && (
                <Card className="border-amber-500/25 bg-amber-500/5 backdrop-blur-sm p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="text-xs font-semibold">
                      New Study Recommendation
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-300 border-amber-500/30">
                      {completionRecommendation.priority || "Action"}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-200 leading-relaxed">
                    <p className="font-medium text-amber-200/90 mb-1">
                      {completionRecommendation.action_type === "REVIEW"
                        ? "Review Concept"
                        : completionRecommendation.action_type === "PRACTICE"
                        ? "Practice Questions"
                        : "Follow-up Quiz"}
                    </p>
                    <p className="text-slate-300 text-[11px]">
                      {completionRecommendation.reasoning}
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link href={`/tutor?project=${selectedProject}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs h-7 px-2.5"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Ask Tutor About This
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Detailed Question Review List */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Answer Review & Rubrics
          </h3>

          {questions.map((q, i) => {
            const r = results.get(q.id);
            const isCorrect = r?.isCorrect;

            return (
              <Card
                key={q.id}
                className="border-slate-800/80 bg-slate-900/50 backdrop-blur-sm"
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                          Question {i + 1} • {q.type === "mcq" ? "Multiple Choice" : "Open-Ended"}
                        </span>
                        <p className="text-sm font-medium text-white leading-snug">
                          {q.text}
                        </p>
                      </div>
                    </div>

                    {r && (
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs font-semibold ${
                          isCorrect
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {r.score.toFixed(0)}%
                      </Badge>
                    )}
                  </div>

                  {r && (
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs space-y-2">
                      <p className="text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-200">Feedback:</span> {r.feedback}
                      </p>

                      {/* Rubric Details for Open-Ended */}
                      {r.rubric && (
                        <div className="pt-2 border-t border-slate-700/50 space-y-1.5 text-[11px]">
                          {r.rubric.strengths && r.rubric.strengths.length > 0 && (
                            <p className="text-emerald-300">
                              <span className="font-semibold text-emerald-400">Strengths:</span>{" "}
                              {r.rubric.strengths.join(", ")}
                            </p>
                          )}
                          {r.rubric.missingConcepts && r.rubric.missingConcepts.length > 0 && (
                            <p className="text-amber-300">
                              <span className="font-semibold text-amber-400">Conceptual Gaps:</span>{" "}
                              {r.rubric.missingConcepts.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase 19: High-Value CTA on Wrong Answer */}
                  {!isCorrect && (
                    <div className="pt-1 flex items-center justify-end">
                      <Link href={`/tutor?project=${selectedProject}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5"
                        >
                          <MessageSquare className="h-3 w-3 mr-1 text-indigo-400" />
                          Ask Tutor about this concept &rarr;
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── View 3: Active Question View ─────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={quizBreadcrumbItems} />
      {/* Step Header & Progress Bar */}
      <div className="space-y-2 pb-2 border-b border-slate-800/60">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white tracking-wide">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className="text-slate-400">
            {answeredCount} answered • {correctCount} correct
          </span>
        </div>
        <Progress
          value={((currentIdx + 1) / questions.length) * 100}
          className="h-1.5 bg-slate-800"
        />
      </div>

      {quizError && (
        <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs py-2.5">
          <AlertDescription>{quizError}</AlertDescription>
        </Alert>
      )}

      {/* Active Question Card */}
      <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shadow-md">
        <CardHeader className="p-5 sm:p-6 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-medium"
              >
                {currentQuestion?.type === "mcq" ? "Multiple Choice" : "Open-Ended"}
              </Badge>
              {currentQuestion?.difficulty && (
                <Badge
                  variant="outline"
                  className="bg-indigo-500/10 text-indigo-300 border-indigo-500/25 text-[10px]"
                >
                  Difficulty: {currentQuestion.difficulty}/5
                </Badge>
              )}
            </div>

            {currentQuestion?.hint && !currentResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHint(!showHint)}
                className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 px-2.5"
              >
                <Lightbulb className="h-3.5 w-3.5 mr-1" />
                {showHint ? "Hide Hint" : "Hint"}
              </Button>
            )}
          </div>

          <CardTitle className="text-base sm:text-lg font-semibold text-white leading-snug">
            {currentQuestion?.text}
          </CardTitle>

          {showHint && currentQuestion?.hint && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{currentQuestion.hint}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
          {/* Question Input / Option Selector */}
          {currentQuestion?.type === "mcq" && currentQuestion.options ? (
            <div className="space-y-2 pt-1">
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
                  "bg-slate-800/40 border-slate-700/70 text-slate-200 hover:bg-slate-800/80 hover:border-slate-600";

                if (isAnswered) {
                  if (isCorrectOption) {
                    optionStyle = "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium";
                  } else if (isSelected && !currentResult?.isCorrect) {
                    optionStyle = "bg-rose-500/15 border-rose-500/40 text-rose-200";
                  } else {
                    optionStyle = "bg-slate-900/40 border-slate-800 text-slate-400";
                  }
                } else if (isSelected) {
                  optionStyle = "bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500/40";
                }

                return (
                  <button
                    key={oi}
                    onClick={() => !isAnswered && setAnswer(option)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors text-xs sm:text-sm flex items-start gap-3 ${optionStyle}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        isSelected || isCorrectOption
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 mt-0.5 leading-relaxed">{option}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pt-1">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your explanation using concepts from your study materials..."
                rows={5}
                disabled={!!currentResult}
                className="bg-slate-800/60 border-slate-700 text-white text-xs sm:text-sm placeholder:text-slate-500 resize-none rounded-xl"
              />
            </div>
          )}

          {/* Answer Evaluation Feedback */}
          {currentResult && (
            <div
              className={`rounded-xl p-4 text-xs space-y-2 ${
                currentResult.isCorrect
                  ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-200"
                  : "bg-rose-500/10 border border-rose-500/25 text-rose-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">
                  {currentResult.isCorrect ? "✓ Correct!" : "✗ Needs Review"}
                </span>
                <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-slate-900/60">
                  {currentResult.score.toFixed(0)}%
                </span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed">{currentResult.feedback}</p>

              {currentResult.rubric && (
                <div className="pt-2 border-t border-slate-700/50 space-y-1 text-[11px]">
                  {currentResult.rubric.strengths && currentResult.rubric.strengths.length > 0 && (
                    <p className="text-emerald-300">
                      <span className="font-semibold text-emerald-400">Strengths:</span>{" "}
                      {currentResult.rubric.strengths.join(", ")}
                    </p>
                  )}
                  {currentResult.rubric.missingConcepts && currentResult.rubric.missingConcepts.length > 0 && (
                    <p className="text-amber-300">
                      <span className="font-semibold text-amber-400">Missing Elements:</span>{" "}
                      {currentResult.rubric.missingConcepts.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Phase 19: Ask Tutor CTA on Wrong Answer */}
              {!currentResult.isCorrect && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-700/40 text-[11px]">
                  <span className="text-slate-300">Stuck on this question?</span>
                  <Link
                    href={`/tutor?project=${selectedProject}`}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Ask Tutor about this &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {!currentResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={!answer.trim() || submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-9.5 px-6 rounded-xl shadow-sm"
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
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium h-9.5 px-5 rounded-xl shadow-sm"
              >
                Next Question
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

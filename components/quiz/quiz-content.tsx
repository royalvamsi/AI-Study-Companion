"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ClipboardCheck,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Trophy,
  Lightbulb,
  FileText,
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
  const router = useRouter();
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
  const [showHint, setShowHint] = useState(false);

  // Available materials filtered by selected project
  const projectMaterials = materials.filter((m) => m.project_id === selectedProject);

  async function handleGenerate() {
    if (!selectedProject) return;
    setGenerating(true);
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
        const err = await res.json();
        alert(err.error || "Failed to generate quiz");
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
      alert("Failed to connect to the quiz service. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!assessmentId || !questions[currentIdx] || submitting) return;
    setSubmitting(true);
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
        const err = await res.json();
        alert(err.error || "Failed to submit answer");
        return;
      }
      const data = await res.json();
      setResults((prev) => new Map(prev).set(data.questionId, data));

      // Handle quiz completion reliably
      if (data.isComplete || data.assessmentComplete) {
        setQuizComplete(true);
        setTotalScore(data.totalScore ?? data.score ?? 0);
      }
    } catch (err) {
      console.error("Quiz submit error:", err);
      alert("Failed to submit your answer. Please try again.");
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
  const currentResult = currentQuestion
    ? results.get(currentQuestion.id)
    : undefined;
  const answeredCount = results.size;
  const correctCount = [...results.values()].filter((r) => r.isCorrect).length;

  // ─── No quiz in progress ───────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Adaptive Quiz</h1>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="py-12 text-center space-y-4">
            <ClipboardCheck className="h-12 w-12 text-indigo-400/40 mx-auto" />
            <h3 className="text-lg font-semibold text-white">
              Ready to test your understanding?
            </h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Select a project and study document. Questions are grounded strictly in your material and adapt to your mastery level.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-lg mx-auto">
              <Select
                value={selectedProject}
                onValueChange={(v) => {
                  setSelectedProject(v ?? "");
                  setSelectedMaterial("ALL");
                }}
              >
                <SelectTrigger className="w-full sm:w-56 bg-slate-800/50 border-slate-700 text-slate-300">
                  <SelectValue placeholder="Select project">
                    {(val: string | null) => {
                      const targetId = val || selectedProject;
                      if (!targetId) return "Select project";
                      const p = projects.find((proj) => proj.id === targetId);
                      return p?.name ?? "Select project";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {projectMaterials.length > 0 && (
                <Select
                  value={selectedMaterial}
                  onValueChange={(v) => setSelectedMaterial(v ?? "ALL")}
                >
                  <SelectTrigger className="w-full sm:w-56 bg-slate-800/50 border-slate-700 text-slate-300">
                    <SelectValue placeholder="Select material">
                      {(val: string | null) => {
                        const cur = val || selectedMaterial;
                        if (cur === "ALL") return "All Materials (Auto)";
                        const m = projectMaterials.find((mat) => mat.id === cur);
                        return m?.file_name ?? "Select material";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Materials (Auto)</SelectItem>
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
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white min-w-[130px]"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Quiz
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Quiz complete ─────────────────────────────────────────────────────────
  if (quizComplete) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Quiz Results</h1>
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardContent className="py-12 text-center space-y-4">
            <Trophy className="h-16 w-16 text-amber-400 mx-auto" />
            <h3 className="text-3xl font-bold text-white">
              {totalScore !== null ? `${totalScore.toFixed(0)}%` : "Complete!"}
            </h3>
            <p className="text-slate-400">
              {correctCount} of {questions.length} questions answered correctly
            </p>
            <Progress value={totalScore ?? 0} className="max-w-xs mx-auto h-2" />
            <div className="flex justify-center gap-3 pt-4">
              <Button
                onClick={() => {
                  setQuestions([]);
                  setAssessmentId(null);
                  setResults(new Map());
                  setQuizComplete(false);
                }}
                variant="outline"
              >
                New Quiz
              </Button>
              <Button
                onClick={() => router.push(`/growth`)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                View Growth
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review answers */}
        <div className="space-y-3">
          {questions.map((q, i) => {
            const r = results.get(q.id);
            return (
              <Card key={q.id} className="bg-slate-900/40 border-slate-800/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    {r?.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        Q{i + 1}. {q.text}
                      </p>
                      {r && (
                        <p className="text-xs text-slate-400 mt-1">
                          {r.feedback}
                        </p>
                      )}

                      {/* Open-ended Rubric Highlights */}
                      {r?.rubric && (
                        <div className="mt-2 space-y-1 text-xs">
                          {r.rubric.strengths && r.rubric.strengths.length > 0 && (
                            <p className="text-emerald-400/90">
                              <span className="font-semibold">Strengths:</span> {r.rubric.strengths.join(", ")}
                            </p>
                          )}
                          {r.rubric.missingConcepts && r.rubric.missingConcepts.length > 0 && (
                            <p className="text-amber-400/90">
                              <span className="font-semibold">Gaps:</span> {r.rubric.missingConcepts.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {r && (
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs ${
                          r.isCorrect
                            ? "text-emerald-400 border-emerald-500/30"
                            : "text-red-400 border-red-500/30"
                        }`}
                      >
                        {r.score.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Active question ───────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">
          Question {currentIdx + 1}/{questions.length}
        </h1>
        <Progress
          value={((currentIdx + 1) / questions.length) * 100}
          className="flex-1 h-2"
        />
        <span className="text-sm text-slate-500">
          {correctCount}/{answeredCount} correct
        </span>
      </div>

      {/* Question card */}
      <Card className="bg-slate-900/50 border-slate-800/60">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] bg-slate-800 text-slate-400 border-slate-700"
              >
                {currentQuestion?.type === "mcq" ? "Multiple Choice" : "Open Ended"}
              </Badge>
              {currentQuestion?.difficulty && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
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
                className="text-xs text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 h-7 px-2"
              >
                <Lightbulb className="h-3.5 w-3.5 mr-1" />
                {showHint ? "Hide Hint" : "Need a Hint?"}
              </Button>
            )}
          </div>

          <CardTitle className="text-white text-lg leading-snug">
            {currentQuestion?.text}
          </CardTitle>

          {showHint && currentQuestion?.hint && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
              <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>{currentQuestion.hint}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion?.type === "mcq" && currentQuestion.options ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option, oi) => {
                const letter = String.fromCharCode(65 + oi);
                const isSelected = answer === letter || answer.toLowerCase() === option.toLowerCase();
                const isAnswered = !!currentResult;

                // Robust check for whether this option is the correct answer
                const isCorrectOption =
                  isAnswered &&
                  (currentResult?.correctAnswer?.toLowerCase() === option.toLowerCase() ||
                   currentResult?.correctAnswer?.toUpperCase() === letter);

                return (
                  <button
                    key={oi}
                    onClick={() => !isAnswered && setAnswer(option)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                      isAnswered
                        ? isCorrectOption
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium"
                          : isSelected && !currentResult?.isCorrect
                          ? "bg-red-500/15 border-red-500/40 text-red-300"
                          : "bg-slate-800/30 border-slate-700/50 text-slate-500"
                        : isSelected
                        ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200"
                        : "bg-slate-800/30 border-slate-700/50 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className="font-semibold mr-2 text-indigo-400">{letter}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your explanation using concepts from your study material…"
              rows={5}
              disabled={!!currentResult}
              className="bg-slate-800/50 border-slate-700 text-white resize-none"
            />
          )}

          {/* Feedback section */}
          {currentResult && (
            <div
              className={`rounded-lg p-3.5 text-sm space-y-1.5 ${
                currentResult.isCorrect
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              <p className="font-medium">
                {currentResult.isCorrect ? "✓ Correct!" : "✗ Review Needed"}
                {" — "}
                <span className="text-white">{currentResult.score.toFixed(0)}%</span>
              </p>
              <p className="text-slate-300 text-xs">{currentResult.feedback}</p>

              {currentResult.rubric && (
                <div className="pt-2 border-t border-slate-700/40 space-y-1 text-xs">
                  {currentResult.rubric.strengths && currentResult.rubric.strengths.length > 0 && (
                    <p className="text-emerald-400">
                      <span className="font-semibold">Strengths:</span> {currentResult.rubric.strengths.join("; ")}
                    </p>
                  )}
                  {currentResult.rubric.missingConcepts && currentResult.rubric.missingConcepts.length > 0 && (
                    <p className="text-amber-300">
                      <span className="font-semibold">Missing Elements:</span> {currentResult.rubric.missingConcepts.join("; ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            {!currentResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={!answer.trim() || submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[130px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating…
                  </>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            ) : currentIdx < questions.length - 1 ? (
              <Button
                onClick={handleNext}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Next Question
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

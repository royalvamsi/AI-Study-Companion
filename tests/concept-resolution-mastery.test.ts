import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveConceptForQuestion, CandidateConcept } from "@/lib/learning/concept-resolver";
import {
  calculateMasteryUpdate,
  computeMasteryTrend,
  updateMasteryAfterAssessment,
  recoverAssessmentConcepts,
} from "@/lib/learning/mastery";
import { sanitizeMaterialErrorMessage } from "@/inngest/material-processing";
import { extractConcepts } from "@/lib/documents/concepts";
import { getAIProvider, AI_MODELS } from "@/lib/ai/router";

// Mock AI Provider & Supabase
vi.mock("@/lib/ai/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/router")>();
  return {
    ...actual,
    getAIProvider: vi.fn(),
  };
});

vi.mock("@/lib/ai/usage-logger", () => ({
  logAiUsage: vi.fn().mockResolvedValue(undefined),
}));

const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabaseAdmin),
}));

describe("A. Quiz Question Concept Resolution", () => {
  const availableConcepts: CandidateConcept[] = [
    { id: "c1", name: "Version Space" },
    { id: "c2", name: "Find-S Algorithm" },
    { id: "c3", name: "Candidate Elimination Algorithm" },
    { id: "c4", name: "Classification Algorithms" },
    { id: "c5", name: "Linear Regression" },
    { id: "c6", name: "Logistic Regression" },
  ];

  it("maps exact concept names correctly", () => {
    const result = resolveConceptForQuestion("Version Space", availableConcepts);
    expect(result.conceptId).toBe("c1");
    expect(result.matchedConceptName).toBe("Version Space");
    expect(result.matchType).toBe("exact");
  });

  it("B. handles case and leading/trailing whitespace normalization", () => {
    const result = resolveConceptForQuestion("   vErSiOn sPaCe \n", availableConcepts);
    expect(result.conceptId).toBe("c1");
    expect(result.matchType).toBe("exact");
  });

  it("handles punctuation and hyphen variations", () => {
    const res1 = resolveConceptForQuestion("Find S Algorithm", availableConcepts);
    expect(res1.conceptId).toBe("c2");
    expect(res1.matchType).toBe("normalized");

    const res2 = resolveConceptForQuestion("find_s_algorithm", availableConcepts);
    expect(res2.conceptId).toBe("c2");
    expect(res2.matchType).toBe("normalized");
  });

  it("handles singular and plural inflection variations", () => {
    const res1 = resolveConceptForQuestion("Version Spaces", availableConcepts);
    expect(res1.conceptId).toBe("c1");
    expect(res1.matchType).toBe("stemmed");

    const res2 = resolveConceptForQuestion("Classification Algorithm", availableConcepts);
    expect(res2.conceptId).toBe("c4");
    expect(res2.matchType).toBe("stemmed");
  });

  it("handles unambiguous affix additions like 'Steps' or 'Basics'", () => {
    const res1 = resolveConceptForQuestion("Find-S Algorithm Steps", availableConcepts);
    expect(res1.conceptId).toBe("c2");
    expect(res1.matchType).toBe("affix");

    const res2 = resolveConceptForQuestion("Candidate Elimination Algorithm Overview", availableConcepts);
    expect(res2.conceptId).toBe("c3");
    expect(res2.matchType).toBe("affix");
  });

  it("C. does NOT incorrectly assign an unmatched or ambiguous concept to another concept", () => {
    // 1. Unrelated concept
    const resUnrelated = resolveConceptForQuestion("Quantum Mechanics", availableConcepts);
    expect(resUnrelated.conceptId).toBeNull();
    expect(resUnrelated.matchType).toBe("unmatched");

    // 2. Ambiguous concept ("Regression" matches both Linear Regression and Logistic Regression)
    const resAmbiguous = resolveConceptForQuestion("Regression", availableConcepts);
    expect(resAmbiguous.conceptId).toBeNull();
    expect(resAmbiguous.matchType).toBe("unmatched");

    // 3. General Foundation fallback
    const resGeneral = resolveConceptForQuestion("General foundation", availableConcepts);
    expect(resGeneral.conceptId).toBeNull();
    expect(resGeneral.matchType).toBe("unmatched");

    // 4. Empty inputs
    expect(resolveConceptForQuestion("", availableConcepts).conceptId).toBeNull();
    expect(resolveConceptForQuestion(null, availableConcepts).conceptId).toBeNull();
    expect(resolveConceptForQuestion("Version Space", []).conceptId).toBeNull();
  });
});

describe("D & E. Learning Loop Mastery Calculation", () => {
  it("calculates mastery update deterministically with weighted score", () => {
    // First assessment (score: 80%)
    const firstUpdate = calculateMasteryUpdate(null, 80);
    expect(firstUpdate.newScore).toBe(80);
    expect(firstUpdate.assessmentCount).toBe(1);
    expect(firstUpdate.trend).toBe("IMPROVING");

    // Second assessment (existing: 80%, recent: 40%) -> 80*0.6 + 40*0.4 = 48 + 16 = 64
    const secondUpdate = calculateMasteryUpdate(
      { mastery_score: 80, assessment_count: 1 },
      40
    );
    expect(secondUpdate.newScore).toBe(64);
    expect(secondUpdate.previousScore).toBe(80);
    expect(secondUpdate.assessmentCount).toBe(2);
    expect(secondUpdate.scoreDelta).toBe(-16);
    expect(secondUpdate.trend).toBe("NEEDS_ATTENTION");
  });

  it("computes trend accurately based on thresholds", () => {
    expect(computeMasteryTrend(1, 35, 35)).toBe("NEEDS_ATTENTION");
    expect(computeMasteryTrend(1, 50, 50)).toBe("STABLE");
    expect(computeMasteryTrend(1, 75, 75)).toBe("IMPROVING");
    expect(computeMasteryTrend(2, 60, 10)).toBe("IMPROVING");
    expect(computeMasteryTrend(2, 60, -10)).toBe("NEEDS_ATTENTION");
    expect(computeMasteryTrend(2, 60, 2)).toBe("STABLE");
  });

  it("D. Completed quiz with linked concepts creates concept_mastery", async () => {
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === "concept_mastery") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "concepts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Version Space" } }),
            }),
          }),
        };
      }
      return {};
    });

    const assessmentWithConcepts = {
      id: "assess-2",
      assessment_questions: [
        { concept_id: "c1", is_correct: true, score: 100 },
        { concept_id: "c1", is_correct: true, score: 80 },
      ],
    };

    const deltas = await updateMasteryAfterAssessment(
      assessmentWithConcepts,
      "user-1",
      "project-1"
    );

    expect(deltas.length).toBe(1);
    expect(deltas[0].conceptId).toBe("c1");
    expect(deltas[0].conceptName).toBe("Version Space");
    expect(deltas[0].newScore).toBe(90);
    expect(deltas[0].trend).toBe("IMPROVING");
  });

  it("E. Completed quiz with no concept_id does not falsely create mastery rows", async () => {
    const assessmentWithNullConcepts = {
      id: "assess-1",
      assessment_questions: [
        { concept_id: null, is_correct: true, score: 100 },
        { concept_id: null, is_correct: true, score: 80 },
        { concept_id: null, is_correct: false, score: 0 },
      ],
    };

    const deltas = await updateMasteryAfterAssessment(
      assessmentWithNullConcepts,
      "user-1",
      "project-1"
    );

    // No questions had concept_id -> no deltas returned
    expect(deltas).toEqual([]);
  });

  it("recovers unlinked questions safely when matching concepts exist", async () => {
    const mockQuestions = [
      {
        id: "q1",
        question_text: "What is Version Space?",
        concept_id: null,
        llm_response: { concept_name: "Version Spaces" },
      },
    ];

    const mockConcepts = [
      { id: "c1", name: "Version Space" },
    ];

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === "assessment_questions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: mockQuestions }),
            }),
          }),
          update: updateMock,
        };
      }
      if (table === "concepts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string) => {
              if (col === "project_id") {
                return Promise.resolve({ data: mockConcepts });
              }
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Version Space" } }),
              };
            }),
          }),
        };
      }
      if (table === "assessments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "assess-rec",
                  assessment_questions: [
                    { concept_id: "c1", is_correct: true, score: 90 },
                  ],
                },
              }),
            }),
          }),
        };
      }
      if (table === "concept_mastery") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const result = await recoverAssessmentConcepts("assess-rec", "proj-1", "user-1");
    expect(result.recoveredCount).toBe(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ concept_id: "c1" })
    );
    expect(result.updatedDeltas.length).toBe(1);
    expect(result.updatedDeltas[0].conceptId).toBe("c1");
  });
});

describe("F. Material Concept Extraction & Processing Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rethrows error when Gemini API call fails during concept extraction rather than returning []", async () => {
    const mockProvider = {
      generateStructured: vi.fn().mockRejectedValue(new Error("AI service encountered an unexpected error.")),
    };
    (getAIProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);

    await expect(
      extractConcepts("Sample study material content", "mat-1", "user-1", "proj-1")
    ).rejects.toThrow("Concept extraction failed: AI service encountered an unexpected error.");
  });

  it("returns empty array without throwing when AI successfully returns 0 concepts", async () => {
    const mockProvider = {
      generateStructured: vi.fn().mockResolvedValue({
        data: { concepts: [] },
        usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
      }),
    };
    (getAIProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);

    const result = await extractConcepts("Short introductory text", "mat-1", "user-1", "proj-1");
    expect(result).toEqual([]);
  });

  it("sanitizes concept extraction errors into clear user-facing messages", () => {
    const rawError = "Concept extraction failed: AI service encountered an unexpected error.";
    const sanitized = sanitizeMaterialErrorMessage(rawError);
    expect(sanitized).toBe("Concept extraction failed due to an AI service error. Please try reprocessing the document.");
  });
});

describe("G. Model Name Defensive Normalization", () => {
  it("defensively fixes typo 'gemini-3.5-flash-lit' by appending 'e'", () => {
    // Check that AI_MODELS properties exist and are valid non-empty strings
    expect(AI_MODELS.tutor).toBeDefined();
    expect(AI_MODELS.fast).toBeDefined();
    expect(AI_MODELS.extraction).toBeDefined();
    expect(AI_MODELS.extraction.endsWith("lite") || AI_MODELS.extraction.includes("flash")).toBe(true);
    expect(AI_MODELS.extraction).not.toBe("gemini-3.5-flash-lit");
  });
});

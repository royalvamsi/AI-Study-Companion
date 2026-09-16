import { describe, it, expect } from "vitest";
import { selectAdaptiveConcepts } from "./adaptive-selection";
import { validateQuestions } from "@/lib/ai/quiz";
import { GradingResultSchema } from "@/lib/ai/grading";

describe("Quiz Grounding & Adaptive Learning Engine", () => {
  describe("1. Deterministic Multi-Signal Adaptive Selection", () => {
    const mockConcepts = [
      { id: "c1", name: "Symmetric Encryption", description: "Shared secret cipher" },
      { id: "c2", name: "Public Key Cryptography", description: "Asymmetric key pairs" },
      { id: "c3", name: "Hash Functions & SHA", description: "One-way digest" },
      { id: "c4", name: "Digital Signatures", description: "Authenticity verification" },
    ];

    it("TEST A — Recent performance: changes priority and target difficulty for same concept and mistakes", () => {
      const concept = [{ id: "c1", name: "Symmetric Encryption", description: null }];
      const baseMastery = { masteryScore: 50, trend: "STABLE", lastAssessedAt: new Date().toISOString(), assessmentCount: 2 };
      const mistakesMap = new Map([["c1", 2]]);

      // Case 1: Low recent performance (20%)
      const lowRecentPerf = selectAdaptiveConcepts({
        concepts: concept,
        masteryMap: new Map([["c1", baseMastery]]),
        mistakesMap,
        recentPerformanceMap: new Map([["c1", 20]]),
        questionCount: 1,
      });

      // Case 2: High recent performance (90%)
      const highRecentPerf = selectAdaptiveConcepts({
        concepts: concept,
        masteryMap: new Map([["c1", baseMastery]]),
        mistakesMap,
        recentPerformanceMap: new Map([["c1", 90]]),
        questionCount: 1,
      });

      // Low recent performance should elevate urgency and step down difficulty
      expect(lowRecentPerf[0].priorityScore).toBeGreaterThan(highRecentPerf[0].priorityScore);
      expect(lowRecentPerf[0].targetDifficulty).toBeLessThan(highRecentPerf[0].targetDifficulty);
      expect(lowRecentPerf[0].targetDifficulty).toBe(1);
      expect(highRecentPerf[0].targetDifficulty).toBe(4);
    });

    it("TEST B — Question history: avoids/deprioritizes recently assessed concepts in favor of unseen concepts", () => {
      const concepts = [
        { id: "c_recent", name: "Recently Assessed Concept", description: null },
        { id: "c_unseen", name: "Unseen Concept", description: null },
      ];
      // Identical base mastery and mistakes
      const masteryMap = new Map([
        ["c_recent", { masteryScore: 50, trend: "STABLE", lastAssessedAt: new Date().toISOString(), assessmentCount: 3 }],
        ["c_unseen", { masteryScore: 50, trend: "STABLE", lastAssessedAt: null, assessmentCount: 0 }],
      ]);
      const mistakesMap = new Map();

      // c_recent was in the immediate prior assessment
      const selected = selectAdaptiveConcepts({
        concepts,
        masteryMap,
        mistakesMap,
        recentlyAssessedConceptIds: new Set(["c_recent"]),
        questionCount: 2,
      });

      expect(selected[0].id).toBe("c_unseen");
      expect(selected[0].scoreBreakdown.questionHistoryAdjustment).toBe(10); // unseen bonus
      expect(selected[1].scoreBreakdown.questionHistoryAdjustment).toBe(-15); // recency penalty
    });

    it("TEST C — Mistake history: increasing repeated mistakes increases concept priority", () => {
      const concepts = [
        { id: "c_clean", name: "Zero Mistakes Concept", description: null },
        { id: "c_struggling", name: "High Mistakes Concept", description: null },
      ];
      const now = new Date().toISOString();
      const masteryMap = new Map([
        ["c_clean", { masteryScore: 60, trend: "STABLE", lastAssessedAt: now, assessmentCount: 2 }],
        ["c_struggling", { masteryScore: 60, trend: "STABLE", lastAssessedAt: now, assessmentCount: 2 }],
      ]);
      const mistakesMap = new Map([
        ["c_clean", 0],
        ["c_struggling", 3],
      ]);

      const selected = selectAdaptiveConcepts({
        concepts,
        masteryMap,
        mistakesMap,
        questionCount: 2,
      });

      expect(selected[0].id).toBe("c_struggling");
      expect(selected[0].scoreBreakdown.mistakeWeight).toBe(24);
      expect(selected[1].scoreBreakdown.mistakeWeight).toBe(0);
      expect(selected[0].priorityScore).toBeGreaterThan(selected[1].priorityScore);
    });

    it("TEST D — Staleness: concepts unassessed for longer receive greater priority", () => {
      const concepts = [
        { id: "c_stale", name: "Stale Concept (10 days ago)", description: null },
        { id: "c_fresh", name: "Fresh Concept (Today)", description: null },
      ];
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const today = new Date().toISOString();

      const masteryMap = new Map([
        ["c_stale", { masteryScore: 70, trend: "STABLE", lastAssessedAt: tenDaysAgo, assessmentCount: 2 }],
        ["c_fresh", { masteryScore: 70, trend: "STABLE", lastAssessedAt: today, assessmentCount: 2 }],
      ]);
      const mistakesMap = new Map();

      const selected = selectAdaptiveConcepts({
        concepts,
        masteryMap,
        mistakesMap,
        questionCount: 2,
      });

      expect(selected[0].id).toBe("c_stale");
      expect(selected[0].scoreBreakdown.stalenessWeight).toBe(20);
      expect(selected[1].scoreBreakdown.stalenessWeight).toBeLessThan(5);
    });

    it("TEST E — Strong recent performance: reduces the need for immediate reassessment", () => {
      const concept = [{ id: "c1", name: "Public Key Cryptography", description: null }];
      const baseMastery = { masteryScore: 70, trend: "STABLE", lastAssessedAt: new Date().toISOString(), assessmentCount: 2 };
      const mistakesMap = new Map();

      const strongRecent = selectAdaptiveConcepts({
        concepts: concept,
        masteryMap: new Map([["c1", baseMastery]]),
        mistakesMap,
        recentPerformanceMap: new Map([["c1", 95]]), // scored 95% recently
        questionCount: 1,
      });

      expect(strongRecent[0].scoreBreakdown.recentPerformanceAdjustment).toBeLessThan(0);
      expect(strongRecent[0].scoreBreakdown.recentPerformanceAdjustment).toBeCloseTo(-12.5, 1);
    });

    it("TEST F — Difficulty adaptation: shows at least two learner states producing distinct difficulties", () => {
      const concepts = [
        { id: "c_beginner", name: "Beginner Concept", description: null },
        { id: "c_advanced", name: "Mastered Concept", description: null },
      ];
      const now = new Date().toISOString();

      // State 1: Low mastery, multiple mistakes, low recent test score
      // State 2: High mastery, 0 mistakes, high recent test score
      const masteryMap = new Map([
        ["c_beginner", { masteryScore: 20, trend: "NEEDS_ATTENTION", lastAssessedAt: now, assessmentCount: 2 }],
        ["c_advanced", { masteryScore: 90, trend: "IMPROVING", lastAssessedAt: now, assessmentCount: 5 }],
      ]);
      const mistakesMap = new Map([
        ["c_beginner", 3],
        ["c_advanced", 0],
      ]);
      const recentPerformanceMap = new Map([
        ["c_beginner", 20],
        ["c_advanced", 95],
      ]);

      const selected = selectAdaptiveConcepts({
        concepts,
        masteryMap,
        mistakesMap,
        recentPerformanceMap,
        questionCount: 2,
      });

      const beginner = selected.find((c) => c.id === "c_beginner")!;
      const advanced = selected.find((c) => c.id === "c_advanced")!;

      expect(beginner.targetDifficulty).toBe(1); // Calibrated to foundation Level 1
      expect(advanced.targetDifficulty).toBe(5); // Calibrated to advanced Level 5
    });

    it("TEST G — Recent activity & assessment context is consumed and materially alters selection", () => {
      const concepts = [
        { id: "c_active", name: "Concept Studied in Tutor Today", description: null },
        { id: "c_inactive", name: "Untouched Concept", description: null },
      ];
      const now = new Date().toISOString();
      const masteryMap = new Map([
        ["c_active", { masteryScore: 60, trend: "STABLE", lastAssessedAt: now, assessmentCount: 1 }],
        ["c_inactive", { masteryScore: 60, trend: "STABLE", lastAssessedAt: now, assessmentCount: 1 }],
      ]);
      const mistakesMap = new Map();
      // c_active had 3 tutor learning events logged in activity_events
      const activityMap = new Map([["c_active", 3]]);

      const selected = selectAdaptiveConcepts({
        concepts,
        masteryMap,
        mistakesMap,
        activityMap,
        questionCount: 2,
      });

      expect(selected[0].id).toBe("c_active");
      expect(selected[0].scoreBreakdown.activityWeight).toBe(15);
      expect(selected[1].scoreBreakdown.activityWeight).toBe(0);
      expect(selected[0].priorityScore).toBe(selected[1].priorityScore + 15);
    });
  });

  describe("2. Strict MCQ Validation & Sanitization", () => {
    it("accepts valid MCQs with exactly 4 unique options and matching answer", () => {
      const raw = [
        {
          question_type: "mcq",
          question_text: "Which property ensures data has not been altered in transit?",
          concept_name: "Integrity",
          options: ["Confidentiality", "Integrity", "Availability", "Non-repudiation"],
          correct_answer: "Integrity",
          difficulty: 2,
          explanation: "Integrity guarantees message unaltered state.",
          hint: "Think about the I in CIA triad.",
          source_page: 5,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(1);
      expect(validated[0].options).toHaveLength(4);
      expect(validated[0].correct_answer).toBe("Integrity");
      expect(validated[0].source_page).toBe(5);
    });

    it("resolves letter correct_answer (e.g. 'B') to the corresponding option", () => {
      const raw = [
        {
          question_type: "mcq",
          question_text: "What is an active attack?",
          concept_name: "Attacks",
          options: ["Eavesdropping", "Message modification", "Traffic analysis", "Monitoring"],
          correct_answer: "B",
          difficulty: 3,
          explanation: "Message modification alters data streams.",
          hint: "Active attacks alter system resources.",
          source_page: 12,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(1);
      expect(validated[0].correct_answer).toBe("Message modification");
    });

    it("rejects MCQs with fewer than 4 options", () => {
      const raw = [
        {
          question_type: "mcq",
          question_text: "Invalid question with 3 options",
          concept_name: "Crypto",
          options: ["Option 1", "Option 2", "Option 3"],
          correct_answer: "Option 1",
          difficulty: 3,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(0);
    });

    it("rejects MCQs with duplicate options", () => {
      const raw = [
        {
          question_type: "mcq",
          question_text: "Invalid question with duplicate options",
          concept_name: "Crypto",
          options: ["Duplicate", "Unique 1", "Duplicate", "Unique 2"],
          correct_answer: "Unique 1",
          difficulty: 3,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(0);
    });

    it("rejects MCQs where correct answer does not match any option", () => {
      const raw = [
        {
          question_type: "mcq",
          question_text: "Invalid question where answer is not among options",
          concept_name: "Crypto",
          options: ["A", "B", "C", "D"],
          correct_answer: "E (None of the above)",
          difficulty: 3,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(0);
    });

    it("allows valid open-ended questions", () => {
      const raw = [
        {
          question_type: "open_ended",
          question_text: "Explain the difference between passive and active network attacks.",
          concept_name: "Network Security Attacks",
          correct_answer: "Passive attacks involve eavesdropping without altering data, while active attacks involve modification or creation of false streams.",
          difficulty: 3,
          explanation: "Refer to page 7 of slide deck.",
          hint: "Compare observation versus disruption.",
          source_page: 7,
        },
      ];

      const validated = validateQuestions(raw);
      expect(validated).toHaveLength(1);
      expect(validated[0].question_type).toBe("open_ended");
      expect(validated[0].options).toHaveLength(0);
      expect(validated[0].correct_answer).toContain("Passive attacks involve");
    });
  });

  describe("3. Open-Ended Rubric Grading Schema", () => {
    it("validates structured rubric evaluations correctly", () => {
      const validEvaluation = {
        score: 85,
        is_correct: true,
        understanding: "COMPLETE" as const,
        strengths: [
          "Accurately defined passive attacks as eavesdropping",
          "Correctly cited active attacks as involving data alteration",
        ],
        missingConcepts: ["Did not mention release of message contents as passive"],
        feedback: "Excellent grasp of network attack classifications with clear contrast.",
        reasoning: "The student covered the primary distinction between interception and modification.",
      };

      const result = GradingResultSchema.safeParse(validEvaluation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(85);
        expect(result.data.understanding).toBe("COMPLETE");
        expect(result.data.strengths).toHaveLength(2);
      }
    });

    it("rejects evaluations with invalid score range or missing rubric fields", () => {
      const invalidEvaluation = {
        score: 150, // out of range
        feedback: "Good answer",
      };

      const result = GradingResultSchema.safeParse(invalidEvaluation);
      expect(result.success).toBe(false);
    });
  });

  describe("4. Anti-Leakage & Product Concept Rejection", () => {
    const FORBIDDEN_META_KEYWORDS = [
      "space",
      "project",
      "admin",
      "authentication",
      "supabase",
      "architecture",
      "product structure",
      "ai study companion",
      "candidate challenge",
      "prd",
      "requirements",
      "isolation",
      "rls",
    ];

    it("identifies and rejects product/meta architecture concepts", () => {
      const testConcepts = [
        "How Spaces and Projects are structured in relation to each other",
        "User Isolation and RLS Policies",
        "Supabase Auth and JWT tokens",
        "DES and AES Symmetric Block Ciphers",
        "Public Key Cryptography and RSA",
      ];

      const filtered = testConcepts.filter((c) => {
        const lower = c.toLowerCase();
        return !FORBIDDEN_META_KEYWORDS.some((kw) => lower.includes(kw));
      });

      expect(filtered).toEqual([
        "DES and AES Symmetric Block Ciphers",
        "Public Key Cryptography and RSA",
      ]);
    });
  });
});

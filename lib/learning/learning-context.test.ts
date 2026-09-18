import { describe, it, expect, vi } from "vitest";
import {
  shouldTriggerComprehensionCheck,
  formatComprehensionCheck,
  generateTutorOpeningMessage,
  getPersistentLearningContext,
  LearningContextSummary,
} from "./learning-context";

let mockLearningGoal: string | null = null;
let mockMasteryRows: any[] = [];
let mockMistakeRows: any[] = [];
let mockAssessmentRows: any[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockLearningGoal !== undefined ? { learning_goal: mockLearningGoal } : null,
              }),
            }),
          }),
        };
      }
      if (table === "concept_mastery") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: mockMasteryRows,
              }),
            }),
          }),
        };
      }
      if (table === "mistakes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: mockMistakeRows,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "assessments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: mockAssessmentRows,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

describe("Tutor Opening Context & Comprehension Checks (Sections 1 & 2)", () => {
  describe("Section 1: Tutor Opening Message", () => {
    it("returns a neutral greeting with no fabricated weaknesses when context is empty", async () => {
      const emptyContext: LearningContextSummary = {
        strengths: [],
        weaknesses: [],
        recurringMistakes: [],
        recentQuizScores: [],
        formattedContext: "New learner in this project. No recorded mistakes or prior assessments yet.",
      };

      const greeting = await generateTutorOpeningMessage("user-1", "proj-1", emptyContext);

      expect(greeting).toContain("Hello! I am your AI Study Companion for this project");
      expect(greeting).not.toContain("weakness");
      expect(greeting).not.toContain("mistake");
    });

    it("references weak concept in opening greeting when persistent context exists", async () => {
      const contextWithWeakness: LearningContextSummary = {
        strengths: ["Symmetric Encryption (85%)"],
        weaknesses: ["X.800 Security Services (25%, NEEDS_ATTENTION)"],
        recurringMistakes: [],
        recentQuizScores: [40],
        formattedContext: "Weaknesses: X.800 Security Services (25%)",
      };

      const greeting = await generateTutorOpeningMessage("user-1", "proj-1", contextWithWeakness);

      // Should mention X.800 Security Services or offer to review
      expect(greeting).toMatch(/X\.800 Security Services|Welcome back|review/i);
    });
  });

  describe("Section 2: Deterministic Comprehension Checks", () => {
    it("triggers comprehension check when mastery_score < 50", () => {
      const session = new Set<string>();
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-weak",
          conceptName: "Public Key Infrastructure",
          masteryScore: 35,
        },
        evidenceState: "SUPPORTED",
        isSubstantive: true,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(true);
    });

    it("triggers comprehension check when concept has no concept_mastery row yet (null)", () => {
      const session = new Set<string>();
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-new",
          conceptName: "Digital Signatures",
          masteryScore: null,
        },
        evidenceState: "SUPPORTED",
        isSubstantive: true,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(true);
    });

    it("does NOT trigger when mastery_score >= 50", () => {
      const session = new Set<string>();
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-strong",
          conceptName: "Hashing Algorithms",
          masteryScore: 78,
        },
        evidenceState: "SUPPORTED",
        isSubstantive: true,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(false);
    });

    it("does NOT trigger more than once per concept in the same session", () => {
      const session = new Set<string>(["concept-weak"]);
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-weak",
          conceptName: "Public Key Infrastructure",
          masteryScore: 20,
        },
        evidenceState: "SUPPORTED",
        isSubstantive: true,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(false);
    });

    it("does NOT trigger on INSUFFICIENT_EVIDENCE", () => {
      const session = new Set<string>();
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-weak",
          conceptName: "Quantum Cryptography",
          masteryScore: 10,
        },
        evidenceState: "INSUFFICIENT_EVIDENCE",
        isSubstantive: true,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(false);
    });

    it("does NOT trigger on short non-substantive responses", () => {
      const session = new Set<string>();
      const shouldTrigger = shouldTriggerComprehensionCheck({
        concept: {
          conceptId: "concept-weak",
          conceptName: "Quantum Cryptography",
          masteryScore: 10,
        },
        evidenceState: "SUPPORTED",
        isSubstantive: false,
        alreadyCheckedConceptsInSession: session,
      });

      expect(shouldTrigger).toBe(false);
    });

    it("formats short, one-sentence comprehension check mentioning concept name", () => {
      const checkText = formatComprehensionCheck("Modular Arithmetic");
      expect(checkText).toContain("Modular Arithmetic");
      expect(checkText.endsWith("?")).toBe(true);
      expect(checkText.split("\n").length).toBe(1);
    });
  });

  describe("Section 3: Project Learning Goal in Persistent Context", () => {
    it("includes learning_goal at the top of formattedContext when present", async () => {
      mockLearningGoal = "Master distributed consensus algorithms and Paxos";
      mockMasteryRows = [
        { mastery_score: 85, trend: "IMPROVING", concepts: { name: "Raft" } },
      ];
      mockMistakeRows = [];
      mockAssessmentRows = [{ score: 80 }];

      const context = await getPersistentLearningContext("user-1", "proj-1");

      expect(context.learningGoal).toBe("Master distributed consensus algorithms and Paxos");
      expect(context.formattedContext).toContain(
        "- Learning Goal: Master distributed consensus algorithms and Paxos"
      );
      // Confirms placed first before strengths
      const goalIndex = context.formattedContext.indexOf("- Learning Goal:");
      const strengthIndex = context.formattedContext.indexOf("- Mastered Strengths:");
      expect(goalIndex).toBeLessThan(strengthIndex);
    });

    it("cleanly omits the learning goal line without printing 'null' when learning_goal is null", async () => {
      mockLearningGoal = null;
      mockMasteryRows = [
        { mastery_score: 85, trend: "IMPROVING", concepts: { name: "Raft" } },
      ];
      mockMistakeRows = [];
      mockAssessmentRows = [];

      const context = await getPersistentLearningContext("user-1", "proj-2");

      expect(context.learningGoal).toBeNull();
      expect(context.formattedContext).not.toContain("Learning Goal");
      expect(context.formattedContext).not.toContain("null");
      expect(context.formattedContext).toContain("- Mastered Strengths: Raft (85%)");
    });

    it("cleanly omits learning goal and falls back to default message when context is completely empty and goal is null", async () => {
      mockLearningGoal = null;
      mockMasteryRows = [];
      mockMistakeRows = [];
      mockAssessmentRows = [];

      const context = await getPersistentLearningContext("user-1", "proj-3");

      expect(context.learningGoal).toBeNull();
      expect(context.formattedContext).toBe(
        "New learner in this project. No recorded mistakes or prior assessments yet."
      );
      expect(context.formattedContext).not.toContain("null");
    });

    it("displays learning goal even if no prior assessments or mastery records exist yet", async () => {
      mockLearningGoal = "Learn basic cybersecurity fundamentals";
      mockMasteryRows = [];
      mockMistakeRows = [];
      mockAssessmentRows = [];

      const context = await getPersistentLearningContext("user-1", "proj-4");

      expect(context.learningGoal).toBe("Learn basic cybersecurity fundamentals");
      expect(context.formattedContext).toBe(
        "- Learning Goal: Learn basic cybersecurity fundamentals"
      );
    });
  });
});

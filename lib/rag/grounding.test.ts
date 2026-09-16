import { describe, it, expect } from "vitest";
import {
  classifyEvidenceState,
  buildTutorSystemPrompt,
  SUPPORTED_THRESHOLD,
  PARTIAL_THRESHOLD,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type RetrievedChunk,
} from "./retrieve";

describe("Tutor Grounding & Evidence State Requirements", () => {
  const mockChunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
    id: "chunk-1",
    materialId: "mat-1",
    content: "Machine learning algorithms build a mathematical model based on sample data.",
    pageNumber: 14,
    similarity: 0.75,
    ...overrides,
  });

  describe("Threshold & Classification Logic", () => {
    it("classifies as SUPPORTED when similarity is at or above SUPPORTED_THRESHOLD", () => {
      const chunks = [mockChunk({ similarity: SUPPORTED_THRESHOLD })];
      expect(classifyEvidenceState(chunks)).toBe("SUPPORTED");

      const higherChunks = [mockChunk({ similarity: 0.85 })];
      expect(classifyEvidenceState(higherChunks)).toBe("SUPPORTED");
    });

    it("classifies as PARTIALLY_SUPPORTED when similarity is between PARTIAL_THRESHOLD and SUPPORTED_THRESHOLD", () => {
      const chunks = [mockChunk({ similarity: (SUPPORTED_THRESHOLD + PARTIAL_THRESHOLD) / 2 })];
      expect(classifyEvidenceState(chunks)).toBe("PARTIALLY_SUPPORTED");

      const boundaryChunks = [mockChunk({ similarity: PARTIAL_THRESHOLD })];
      expect(classifyEvidenceState(boundaryChunks)).toBe("PARTIALLY_SUPPORTED");
    });

    it("classifies as INSUFFICIENT_EVIDENCE when similarity is strictly below PARTIAL_THRESHOLD", () => {
      const chunks = [mockChunk({ similarity: PARTIAL_THRESHOLD - 0.05 })];
      expect(classifyEvidenceState(chunks)).toBe("INSUFFICIENT_EVIDENCE");
    });

    it("classifies as INSUFFICIENT_EVIDENCE when no chunks are retrieved", () => {
      expect(classifyEvidenceState([])).toBe("INSUFFICIENT_EVIDENCE");
    });
  });

  describe("Regression Case A: Grounded Question", () => {
    it("returns SUPPORTED evidence state and structures prompt with citations", () => {
      const chunks: RetrievedChunk[] = [
        mockChunk({
          id: "chunk-ml-1",
          content: "Supervised learning algorithms build a model from labeled training data.",
          pageNumber: 14,
          similarity: 0.74,
        }),
      ];

      const evidenceState = classifyEvidenceState(chunks);
      expect(evidenceState).toBe("SUPPORTED");

      const prompt = buildTutorSystemPrompt({
        retrievedChunks: chunks,
        evidenceState,
      });

      expect(prompt).toContain("EVIDENCE STATE: SUPPORTED");
      expect(prompt).toContain("[Source 1] (Page 14):");
      expect(prompt).toContain("Supervised learning algorithms");
      expect(prompt).toContain("STRICT GROUNDING: Answer using ONLY the provided STUDY MATERIAL CONTEXT");
    });
  });

  describe("Regression Case B: Partially Supported Question", () => {
    it("returns PARTIALLY_SUPPORTED and strictly instructs tutor not to fill gaps with general knowledge", () => {
      const chunks: RetrievedChunk[] = [
        mockChunk({
          id: "chunk-partial",
          content: "Neural networks are modeled loosely after the human brain.",
          pageNumber: 8,
          similarity: 0.65,
        }),
      ];

      const evidenceState = classifyEvidenceState(chunks);
      expect(evidenceState).toBe("PARTIALLY_SUPPORTED");

      const prompt = buildTutorSystemPrompt({
        retrievedChunks: chunks,
        evidenceState,
      });

      expect(prompt).toContain("EVIDENCE STATE: PARTIALLY_SUPPORTED");
      expect(prompt).toContain(
        "PARTIAL SUPPORT: If the evidence state is PARTIALLY_SUPPORTED, address ONLY the parts of the question that are directly supported"
      );
      expect(prompt).toContain(
        "Do NOT attempt to fill in the missing information using general or world knowledge"
      );
    });
  });

  describe("Regression Case C: Completely Unrelated Question (e.g., 'How do I cook biryani?')", () => {
    it("returns INSUFFICIENT_EVIDENCE with NO general knowledge recipe or explanation", () => {
      // Unrelated questions fail the similarity threshold or return 0 chunks
      const unrelatedChunks: RetrievedChunk[] = [];
      const evidenceState = classifyEvidenceState(unrelatedChunks);

      expect(evidenceState).toBe("INSUFFICIENT_EVIDENCE");

      // Verify the explicit response message
      expect(INSUFFICIENT_EVIDENCE_MESSAGE).toContain("I could not find sufficient evidence");
      expect(INSUFFICIENT_EVIDENCE_MESSAGE).toContain("study materials");
      expect(INSUFFICIENT_EVIDENCE_MESSAGE).toContain("cannot answer from outside knowledge");

      // Verify absence of general knowledge recipe, cooking, or food tutorial terms
      const lower = INSUFFICIENT_EVIDENCE_MESSAGE.toLowerCase();
      expect(lower).not.toContain("biryani");
      expect(lower).not.toContain("recipe");
      expect(lower).not.toContain("chicken");
      expect(lower).not.toContain("rice");
      expect(lower).not.toContain("cook");
      expect(lower).not.toContain("ingredients");
      expect(lower).not.toContain("step 1");
    });

    it("tutor system prompt strictly prohibits recipes and offering general knowledge disclaimers", () => {
      const prompt = buildTutorSystemPrompt({
        retrievedChunks: [],
        evidenceState: "INSUFFICIENT_EVIDENCE",
      });

      expect(prompt).toContain("NO RECIPES OR UNRELATED ANSWERS");
      // Must NOT tell the tutor to offer general knowledge with a disclaimer
      expect(prompt).not.toContain("offer your general knowledge with a disclaimer");
      expect(prompt).not.toContain("offer general knowledge");
    });
  });

  describe("Regression Case D: Broad PDF-Summary Question ('What are the main concepts discussed in this PDF?')", () => {
    it("supports synthesis from overview / TOC chunks and strictly forbids claiming lack of file access", () => {
      const tocChunks: RetrievedChunk[] = [
        mockChunk({
          id: "chunk-toc",
          content: "Table of Contents: 1. Introduction to AI 2. Neural Networks 3. Reinforcement Learning",
          pageNumber: 2,
          similarity: 0.67,
        }),
      ];

      const evidenceState = classifyEvidenceState(tocChunks);
      // 0.67 is >= PARTIAL_THRESHOLD (0.63)
      expect(["SUPPORTED", "PARTIALLY_SUPPORTED"]).toContain(evidenceState);

      const prompt = buildTutorSystemPrompt({
        retrievedChunks: tocChunks,
        evidenceState,
      });

      // Must explicitly prohibit claiming lack of file access
      expect(prompt).toContain(
        'NO FALSE LACK OF ACCESS: NEVER claim "I do not have direct access to the PDF", "I cannot view files", or "I lack access to the document"'
      );
      expect(prompt).toContain(
        "SYNTHESIS & SUMMARIES: If the student asks for a summary or main concepts of the material"
      );
      expect(prompt).toContain("[Source 1] (Page 2):");
    });

    it("falls back to INSUFFICIENT_EVIDENCE without hallucinating when no PDF material exists", () => {
      const emptyChunks: RetrievedChunk[] = [];
      const evidenceState = classifyEvidenceState(emptyChunks);

      expect(evidenceState).toBe("INSUFFICIENT_EVIDENCE");
      expect(INSUFFICIENT_EVIDENCE_MESSAGE).toContain(
        "I could not find sufficient evidence in the uploaded study materials"
      );
    });
  });
});

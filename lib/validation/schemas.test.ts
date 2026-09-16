import { describe, it, expect } from "vitest";
import {
  CreateSpaceSchema,
  CreateProjectSchema,
  UploadMaterialSchema,
  TutorMessageSchema,
  StartQuizSchema,
  AnswerQuestionSchema,
} from "./schemas";

describe("Validation Schemas", () => {
  describe("CreateSpaceSchema", () => {
    it("validates valid space input", () => {
      const valid = { name: "Computer Science", description: "All CS modules" };
      const result = CreateSpaceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const invalid = { name: "", description: "No name" };
      const result = CreateSpaceSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("CreateProjectSchema", () => {
    it("validates correct project with UUID", () => {
      const valid = {
        spaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Operating Systems",
        description: "Kernel and process scheduling",
      };
      const result = CreateProjectSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid spaceId UUID", () => {
      const invalid = {
        spaceId: "not-a-uuid",
        name: "OS",
      };
      const result = CreateProjectSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TutorMessageSchema", () => {
    it("validates user message with project UUID", () => {
      const valid = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Can you explain memory virtualization?",
      };
      const result = TutorMessageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects empty message", () => {
      const invalid = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "",
      };
      const result = TutorMessageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("StartQuizSchema", () => {
    it("defaults questionCount to 5 when omitted", () => {
      const input = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
      };
      const result = StartQuizSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionCount).toBe(5);
      }
    });

    it("enforces max limit of 20 questions", () => {
      const input = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        questionCount: 25,
      };
      const result = StartQuizSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("AnswerQuestionSchema", () => {
    it("validates valid question answer", () => {
      const input = {
        assessmentId: "123e4567-e89b-12d3-a456-426614174000",
        questionId: "223e4567-e89b-12d3-a456-426614174000",
        answer: "A process is an execution context with its own address space.",
      };
      const result = AnswerQuestionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

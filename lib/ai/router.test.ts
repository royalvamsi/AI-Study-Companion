import { describe, it, expect } from "vitest";
import { AI_MODELS, estimateCost, getAIProvider } from "./router";
import { AIError } from "./provider";

describe("AI Provider & Model Router", () => {
  it("provides correct task-aware Gemini model mappings", () => {
    expect(AI_MODELS.tutor).toBe("gemini-3.5-flash");
    expect(AI_MODELS.assessment).toBe("gemini-3.5-flash");
    expect(AI_MODELS.fast).toBe("gemini-3.5-flash-lite");
    expect(AI_MODELS.extraction).toBe("gemini-3.5-flash-lite");
    expect(AI_MODELS.embedding).toBe("gemini-embedding-001");
  });

  it("calculates estimated token costs accurately", () => {
    // 1000 prompt tokens and 1000 output tokens for gemini-2.5-flash
    const flashCost = estimateCost("gemini-2.5-flash", 1000, 1000);
    expect(flashCost).toBeCloseTo(0.000375, 6);

    // 1000 prompt tokens and 1000 output tokens for gemini-2.5-flash-lite
    const liteCost = estimateCost("gemini-2.5-flash-lite", 1000, 1000);
    expect(liteCost).toBeCloseTo(0.0001875, 6);

    // 1000 tokens for embedding
    const embedCost = estimateCost("gemini-embedding-001", 1000, 0);
    expect(embedCost).toBeCloseTo(0.00002, 6);
  });

  it("returns GeminiProvider singleton instance", () => {
    const provider1 = getAIProvider();
    const provider2 = getAIProvider();

    expect(provider1).toBeDefined();
    expect(provider1.name).toBe("gemini");
    expect(provider1).toBe(provider2);
  });

  it("creates typed AIError instances correctly", () => {
    const err = new AIError("Rate limit hit", "RATE_LIMIT", 429);
    expect(err.name).toBe("AIError");
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.status).toBe(429);
  });
});

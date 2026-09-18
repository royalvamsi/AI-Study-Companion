import { describe, it, expect } from "vitest";
import { computeMasteryTrend, calculateMasteryUpdate } from "./mastery";

describe("Mastery Trend Calculation (Section 0 Bug Fix)", () => {
  it("classifies first assessment (count === 1) with score < 40 as NEEDS_ATTENTION", () => {
    const trend = computeMasteryTrend(1, 20, 20);
    expect(trend).toBe("NEEDS_ATTENTION");

    const update = calculateMasteryUpdate(null, 20);
    expect(update.assessmentCount).toBe(1);
    expect(update.newScore).toBe(20);
    expect(update.trend).toBe("NEEDS_ATTENTION");
  });

  it("classifies first assessment (count === 1) with score 0 as NEEDS_ATTENTION (not STABLE)", () => {
    const trend = computeMasteryTrend(1, 0, 0);
    expect(trend).toBe("NEEDS_ATTENTION");

    const update = calculateMasteryUpdate(null, 0);
    expect(update.assessmentCount).toBe(1);
    expect(update.newScore).toBe(0);
    expect(update.trend).toBe("NEEDS_ATTENTION");
  });

  it("classifies first assessment (count === 1) with score >= 70 as IMPROVING", () => {
    const trend = computeMasteryTrend(1, 85, 85);
    expect(trend).toBe("IMPROVING");

    const update = calculateMasteryUpdate(null, 85);
    expect(update.assessmentCount).toBe(1);
    expect(update.newScore).toBe(85);
    expect(update.trend).toBe("IMPROVING");
  });

  it("classifies first assessment (count === 1) with moderate score (e.g. 50%) as STABLE", () => {
    const trend = computeMasteryTrend(1, 50, 50);
    expect(trend).toBe("STABLE");

    const update = calculateMasteryUpdate(null, 50);
    expect(update.assessmentCount).toBe(1);
    expect(update.newScore).toBe(50);
    expect(update.trend).toBe("STABLE");
  });

  it("uses delta-based logic for subsequent assessments (count > 1)", () => {
    // Second assessment with small delta -> STABLE
    // Previous 60, current 62 -> 60 * 0.6 + 62 * 0.4 = 36 + 24.8 = 60.8. Delta = 0.8 (< 5)
    const existing = { mastery_score: 60, assessment_count: 1 };
    const updateStable = calculateMasteryUpdate(existing, 62);
    expect(updateStable.assessmentCount).toBe(2);
    expect(updateStable.trend).toBe("STABLE");

    // Second assessment with large positive delta (> 5) -> IMPROVING
    // Previous 40, current 100 -> 40 * 0.6 + 100 * 0.4 = 24 + 40 = 64. Delta = 24
    const updateImproving = calculateMasteryUpdate({ mastery_score: 40, assessment_count: 1 }, 100);
    expect(updateImproving.assessmentCount).toBe(2);
    expect(updateImproving.trend).toBe("IMPROVING");

    // Second assessment with large negative delta (< -5) -> NEEDS_ATTENTION
    // Previous 80, current 0 -> 80 * 0.6 + 0 = 48. Delta = -32
    const updateDrop = calculateMasteryUpdate({ mastery_score: 80, assessment_count: 1 }, 0);
    expect(updateDrop.assessmentCount).toBe(2);
    expect(updateDrop.trend).toBe("NEEDS_ATTENTION");
  });
});

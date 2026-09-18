import { describe, it, expect } from "vitest";
import { generateGrowthNarrative } from "./growth-summary";
import { GrowthSummary } from "@/lib/learning/growth";

describe("Growth Summary Coach Narrative (Section 3)", () => {
  it("returns default message when there are no concepts", async () => {
    const emptySummary: GrowthSummary = {
      improving: [],
      stable: [],
      needsAttention: [],
      overallTrend: "STABLE",
    };

    const narrative = await generateGrowthNarrative({
      userId: "user-test",
      growthSummary: emptySummary,
    });

    expect(narrative).toContain("haven't completed any assessments yet");
  });

  it("produces a coach narrative reflecting improving and needsAttention concepts", async () => {
    const summary: GrowthSummary = {
      improving: [
        {
          conceptId: "c1",
          conceptName: "Symmetric Encryption",
          currentScore: 82,
          previousScore: 60,
          trend: "IMPROVING",
          assessmentCount: 2,
          lastAssessedAt: null,
        },
      ],
      needsAttention: [
        {
          conceptId: "c2",
          conceptName: "X.800 Security Architecture",
          currentScore: 30,
          previousScore: 25,
          trend: "NEEDS_ATTENTION",
          assessmentCount: 2,
          lastAssessedAt: null,
        },
      ],
      stable: [],
      overallTrend: "STABLE",
    };

    const narrative = await generateGrowthNarrative({
      userId: "user-test",
      growthSummary: summary,
    });

    // Should mention either the concepts or clear coach guidance
    expect(narrative.length).toBeGreaterThan(20);
    expect(narrative).toMatch(/Symmetric Encryption|X\.800 Security Architecture|progress|attention|solid/i);
  });

  it("produces positive narrative when concepts are improving", async () => {
    const summary: GrowthSummary = {
      improving: [
        {
          conceptId: "c1",
          conceptName: "Public Key Cryptography",
          currentScore: 90,
          previousScore: 70,
          trend: "IMPROVING",
          assessmentCount: 2,
          lastAssessedAt: null,
        },
      ],
      needsAttention: [],
      stable: [],
      overallTrend: "IMPROVING",
    };

    const narrative = await generateGrowthNarrative({
      userId: "user-test",
      growthSummary: summary,
    });

    expect(narrative.length).toBeGreaterThan(20);
    expect(narrative).toMatch(/Public Key Cryptography|trajectory|solid|positive|upward/i);
  });
});

import { describe, it, expect } from "vitest";
import { buildRecommendationReasoning } from "./recommendations";

describe("Recommendations Inline Reasoning (Section 5)", () => {
  it("includes concept name inline at the beginning of the reasoning text", () => {
    const reasoning = buildRecommendationReasoning({
      conceptName: "X.800 Security Architecture",
      mastery: 20,
      mistakes: 3,
      trend: "NEEDS_ATTENTION",
      lastAssessedAt: null,
    });

    // Explicit check: must start with the concept name inline
    expect(reasoning.startsWith("X.800 Security Architecture:")).toBe(true);
    expect(reasoning).toContain("mastery is low at 20%");
    expect(reasoning).toContain("3 recent mistakes recorded");
    expect(reasoning).toContain("score is declining");
  });

  it("handles a concept with low mastery only, prefixing concept name inline", () => {
    const today = new Date().toISOString();
    const reasoning = buildRecommendationReasoning({
      conceptName: "Diffie-Hellman Key Exchange",
      mastery: 35,
      mistakes: 0,
      trend: "STABLE",
      lastAssessedAt: today,
    });

    expect(reasoning.startsWith("Diffie-Hellman Key Exchange:")).toBe(true);
    expect(reasoning).toContain("mastery is low at 35%");
  });

  it("handles fallback reasoning when scores are moderate, retaining concept name inline", () => {
    const today = new Date().toISOString();
    const reasoning = buildRecommendationReasoning({
      conceptName: "RSA Algorithm",
      mastery: 75,
      mistakes: 0,
      trend: "STABLE",
      lastAssessedAt: today,
    });

    expect(reasoning.startsWith("RSA Algorithm:")).toBe(true);
    expect(reasoning).toContain("mastery could use practice to build stronger understanding.");
  });
});

describe("Recommendation Status Tracking & Non-Destructive Upsert (syncRecommendations)", () => {
  function createMockSupabase(initialRows: any[]) {
    const rows = [...initialRows];
    const updateCalls: any[] = [];
    const insertCalls: any[] = [];
    const deleteCalls: any[] = [];

    const client = {
      from: (table: string) => {
        return {
          select: () => {
            return {
              eq: (col1: string, val1: any) => ({
                eq: (col2: string, val2: any) => ({
                  eq: (col3: string, val3: any) => ({
                    eq: (col4: string, val4: any) => {
                      // Simulates .eq("project_id", p).eq("user_id", u).eq("status", "active").eq("is_dismissed", false)
                      const filtered = rows.filter((r) => {
                        return (
                          r[col1] === val1 &&
                          r[col2] === val2 &&
                          r[col3] === val3 &&
                          r[col4] === val4
                        );
                      });
                      return Promise.resolve({ data: filtered, error: null });
                    },
                  }),
                }),
              }),
            };
          },
          insert: (payload: any) => {
            const arr = Array.isArray(payload) ? payload : [payload];
            insertCalls.push(...arr);
            arr.forEach((item) => {
              rows.push({ id: item.id || `rec_${Date.now()}_${Math.random()}`, ...item });
            });
            return Promise.resolve({ data: arr, error: null });
          },
          update: (updates: any) => {
            return {
              eq: (col: string, val: any) => {
                updateCalls.push({ updates, where: { [col]: val } });
                rows.forEach((r) => {
                  if (r[col] === val) {
                    Object.assign(r, updates);
                  }
                });
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
          delete: () => {
            return {
              eq: () => {
                deleteCalls.push(true);
                return { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
              },
            };
          },
        };
      },
      _state: { rows, updateCalls, insertCalls, deleteCalls },
    };

    return client;
  }

  it("leaves identical recommendations completely untouched (no update, no updated_at bump)", async () => {
    const { syncRecommendations } = await import("./recommendations");

    const existingRow = {
      id: "rec-1",
      project_id: "p1",
      user_id: "u1",
      concept_id: "c1",
      priority: "HIGH" as const,
      action_type: "REVIEW",
      reasoning: "Concept A: mastery is low at 20%.",
      is_dismissed: false,
      status: "active" as const,
      updated_at: "2026-09-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
    };

    const mockDb = createMockSupabase([existingRow]);

    const result = await syncRecommendations(
      "p1",
      "u1",
      [
        {
          project_id: "p1",
          user_id: "u1",
          concept_id: "c1",
          priority: "HIGH",
          action_type: "REVIEW",
          reasoning: "Concept A: mastery is low at 20%.",
          is_dismissed: false,
        },
      ],
      { emitEvents: true, client: mockDb }
    );

    expect(result.untouchedCount).toBe(1);
    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(0);
    expect(result.supersededCount).toBe(0);

    // Assert NO updates were called on the DB
    expect(mockDb._state.updateCalls.length).toBe(0);
    // Assert NO deletes were called
    expect(mockDb._state.deleteCalls.length).toBe(0);
    // Assert updated_at remained exactly as it was
    expect(mockDb._state.rows[0].updated_at).toBe("2026-09-01T00:00:00.000Z");
  });

  it("updates recommendation in place with new updated_at when content changes", async () => {
    const { syncRecommendations } = await import("./recommendations");

    const existingRow = {
      id: "rec-1",
      project_id: "p1",
      user_id: "u1",
      concept_id: "c1",
      priority: "MEDIUM" as const,
      action_type: "PRACTICE",
      reasoning: "Concept A: mastery could use practice.",
      is_dismissed: false,
      status: "active" as const,
      updated_at: "2026-09-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
    };

    const mockDb = createMockSupabase([existingRow]);

    const result = await syncRecommendations(
      "p1",
      "u1",
      [
        {
          project_id: "p1",
          user_id: "u1",
          concept_id: "c1",
          priority: "HIGH", // Changed from MEDIUM
          action_type: "REVIEW", // Changed from PRACTICE
          reasoning: "Concept A: mastery is low at 25%, 3 recent mistakes recorded.",
          is_dismissed: false,
        },
      ],
      { emitEvents: false, client: mockDb }
    );

    expect(result.updatedCount).toBe(1);
    expect(result.untouchedCount).toBe(0);
    expect(mockDb._state.updateCalls.length).toBe(1);
    expect(mockDb._state.updateCalls[0].updates.priority).toBe("HIGH");
    expect(mockDb._state.updateCalls[0].updates.action_type).toBe("REVIEW");
    expect(mockDb._state.rows[0].updated_at).not.toBe("2026-09-01T00:00:00.000Z");
  });

  it("marks active recommendation as superseded when concept drops out of computed set", async () => {
    const { syncRecommendations } = await import("./recommendations");

    const activeRow1 = {
      id: "rec-1",
      project_id: "p1",
      user_id: "u1",
      concept_id: "c1", // Still recommended
      priority: "HIGH" as const,
      action_type: "REVIEW",
      reasoning: "Concept 1 is weak",
      is_dismissed: false,
      status: "active" as const,
      updated_at: "2026-09-01T00:00:00.000Z",
    };

    const activeRow2 = {
      id: "rec-2",
      project_id: "p1",
      user_id: "u1",
      concept_id: "c2", // Improved, no longer weak
      priority: "HIGH" as const,
      action_type: "REVIEW",
      reasoning: "Concept 2 is weak",
      is_dismissed: false,
      status: "active" as const,
      updated_at: "2026-09-01T00:00:00.000Z",
    };

    const mockDb = createMockSupabase([activeRow1, activeRow2]);

    // New run only recommends c1
    const result = await syncRecommendations(
      "p1",
      "u1",
      [
        {
          project_id: "p1",
          user_id: "u1",
          concept_id: "c1",
          priority: "HIGH",
          action_type: "REVIEW",
          reasoning: "Concept 1 is weak",
          is_dismissed: false,
        },
      ],
      { emitEvents: false, client: mockDb }
    );

    expect(result.untouchedCount).toBe(1);
    expect(result.supersededCount).toBe(1);

    // c2 should be marked superseded, NOT deleted
    expect(mockDb._state.deleteCalls.length).toBe(0);
    const c2Row = mockDb._state.rows.find((r) => r.concept_id === "c2");
    expect(c2Row?.status).toBe("superseded");
  });

  it("never resurrects or alters user-dismissed recommendations", async () => {
    const { syncRecommendations } = await import("./recommendations");

    const dismissedRow = {
      id: "rec-dismissed",
      project_id: "p1",
      user_id: "u1",
      concept_id: "c3",
      priority: "HIGH" as const,
      action_type: "REVIEW",
      reasoning: "User previously dismissed this",
      is_dismissed: true,
      status: "resolved" as const,
      updated_at: "2026-09-01T00:00:00.000Z",
    };

    const mockDb = createMockSupabase([dismissedRow]);

    // A run that includes c3 as a fresh recommendation
    const result = await syncRecommendations(
      "p1",
      "u1",
      [
        {
          project_id: "p1",
          user_id: "u1",
          concept_id: "c3",
          priority: "HIGH",
          action_type: "REVIEW",
          reasoning: "Concept 3 is weak",
          is_dismissed: false,
        },
      ],
      { emitEvents: false, client: mockDb }
    );

    // Because rec-dismissed was dismissed, it wasn't returned in the active query
    // An active row is newly inserted, leaving the dismissed/resolved row intact
    expect(result.insertedCount).toBe(1);
    const dismissed = mockDb._state.rows.find((r) => r.id === "rec-dismissed");
    expect(dismissed?.is_dismissed).toBe(true);
    expect(dismissed?.status).toBe("resolved");
  });
});

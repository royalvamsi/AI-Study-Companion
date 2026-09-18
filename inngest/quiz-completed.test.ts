import { describe, it, expect, vi, beforeEach } from "vitest";
import { onQuizCompleted } from "./quiz-completed";

// Mock Supabase admin client and dependencies
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
const mockEmitActivityEvent = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/activity/events", () => ({
  ActivityEventType: {
    MASTERY_UPDATED: "MASTERY_UPDATED",
  },
  emitActivityEvent: (...args: any[]) => mockEmitActivityEvent(...args),
}));

describe("Quiz Completed Function - Idempotency & Duplicate-Run Guard (Section A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures idempotency key on onQuizCompleted scoped to event.data.assessmentId", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnConfig = (onQuizCompleted as any)?.opts;
    expect(fnConfig).toBeDefined();
    expect(fnConfig.idempotency).toBe("event.data.assessmentId");
  });

  it("processes mastery and mistakes on first run, but short-circuits on duplicate run (exactly-once mastery & mistakes)", async () => {
    const assessmentId = "asmt_dup_test_123";
    const projectId = "proj_test_456";
    const userId = "user_test_789";
    const conceptId = "concept_math_001";

    // In-memory database representation
    let assessmentRow: any = {
      id: assessmentId,
      project_id: projectId,
      user_id: userId,
      status: "completed",
      score: 50,
      question_count: 2,
      mastery_processed_at: null,
      assessment_questions: [
        {
          id: "q1",
          concept_id: conceptId,
          is_correct: true,
          score: 100,
        },
        {
          id: "q2",
          concept_id: conceptId,
          is_correct: false,
          score: 0,
        },
      ],
    };

    let masteryRecord: any = null;
    let mistakeRecord: any = null;

    // Track operation counts
    let masteryUpdateCount = 0;
    let mistakeIncrementCount = 0;

    const createDbMock = () => ({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "assessments") {
          return {
            select: () => ({
              eq: (_col: string, id: string) => ({
                single: async () => {
                  if (id === assessmentId) {
                    return { data: { ...assessmentRow }, error: null };
                  }
                  return { data: null, error: new Error("Not found") };
                },
              }),
            }),
            update: (updates: any) => ({
              eq: (_col: string, id: string) => {
                if (id === assessmentId) {
                  assessmentRow = { ...assessmentRow, ...updates };
                }
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === "concept_mastery") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: masteryRecord ? { ...masteryRecord } : null, error: null }),
                  }),
                }),
              }),
            }),
            upsert: (payload: any) => {
              masteryUpdateCount++;
              const item = Array.isArray(payload) ? payload[0] : payload;
              masteryRecord = {
                ...masteryRecord,
                ...item,
                assessment_count: (masteryRecord?.assessment_count ?? 0) + 1,
              };
              return Promise.resolve({ error: null });
            },
            insert: (payload: any) => {
              masteryUpdateCount++;
              masteryRecord = {
                ...payload,
                assessment_count: 1,
              };
              return Promise.resolve({ error: null });
            },
            update: (updates: any) => ({
              eq: () => {
                masteryUpdateCount++;
                masteryRecord = {
                  ...masteryRecord,
                  ...updates,
                  assessment_count: (masteryRecord?.assessment_count ?? 0) + 1,
                };
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === "mistakes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({ data: mistakeRecord ? { ...mistakeRecord } : null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: (payload: any) => {
              mistakeIncrementCount++;
              mistakeRecord = {
                ...payload,
                occurrence_count: 1,
              };
              return Promise.resolve({ error: null });
            },
            update: (updates: any) => ({
              eq: () => {
                mistakeIncrementCount++;
                mistakeRecord = {
                  ...mistakeRecord,
                  ...updates,
                };
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === "concepts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { name: "Test Concept" }, error: null }),
              }),
            }),
          };
        }

        return {};
      }),
    });

    mockFrom.mockImplementation((table: string) => createDbMock().from(table));

    // Helper to invoke Inngest function handler with simulated step runner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnHandler = (onQuizCompleted as any)?.fn;

    const stepRunner = {
      run: async (_name: string, fn: () => any) => fn(),
      sendEvent: vi.fn(),
    };

    // ── FIRST RUN: Initial quiz/completed event ──────────────────────────────
    const result1 = await fnHandler({
      event: { data: { assessmentId, projectId, userId } },
      step: stepRunner,
    });

    // Verify first run completed successfully
    expect(result1.assessmentId).toBe(assessmentId);
    expect(result1.skipped).toBeUndefined();

    // Verify mastery was updated once
    expect(masteryUpdateCount).toBe(1);
    expect(masteryRecord).not.toBeNull();
    expect(masteryRecord.assessment_count).toBe(1);

    // Verify mistake count incremented by exactly 1 for the wrong question
    expect(mistakeIncrementCount).toBe(1);
    expect(mistakeRecord).not.toBeNull();
    expect(mistakeRecord.occurrence_count).toBe(1);

    // Verify mastery_processed_at was stamped on assessments
    expect(assessmentRow.mastery_processed_at).toBeDefined();
    expect(assessmentRow.mastery_processed_at).not.toBeNull();

    // ── SECOND RUN: Duplicate quiz/completed event (network retry/blip) ───────
    const result2 = await fnHandler({
      event: { data: { assessmentId, projectId, userId } },
      step: stepRunner,
    });

    // Verify second run detected duplicate and short-circuited
    expect(result2.skipped).toBe(true);
    expect(result2.reason).toContain("already processed");

    // CRITICAL ASSERTIONS:
    // Mastery must STILL only have been updated once (assessment_count is 1, not 2)
    expect(masteryUpdateCount).toBe(1);
    expect(masteryRecord.assessment_count).toBe(1);

    // Mistakes must STILL only have been recorded once (occurrence_count is 1, not 2)
    expect(mistakeIncrementCount).toBe(1);
    expect(mistakeRecord.occurrence_count).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAdminStatus, getAdminPlatformOverview, getAdminUserDetail } from "./admin-queries";

// Mock createAdminClient
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";

describe("Admin Authorization & Security Audit (Section E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyAdminStatus", () => {
    it("returns false for a non-admin user", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_admin: false },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const isAdmin = await verifyAdminStatus("student-user-123");
      expect(isAdmin).toBe(false);
      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockEq).toHaveBeenCalledWith("id", "student-user-123");
    });

    it("returns true for an authorized admin user", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const isAdmin = await verifyAdminStatus("admin-user-456");
      expect(isAdmin).toBe(true);
      expect(mockEq).toHaveBeenCalledWith("id", "admin-user-456");
    });

    it("returns false if user profile is not found", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const isAdmin = await verifyAdminStatus("non-existent-user");
      expect(isAdmin).toBe(false);
    });
  });

  describe("Admin Activity Filters (Section D)", () => {
    it("applies database-level filters for userId, projectId, eventType, and period", async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [
          {
            id: "evt-1",
            user_id: "user-1",
            project_id: "proj-1",
            event_type: "ASSESSMENT_COMPLETED",
            payload: { score: 90 },
            created_at: new Date().toISOString(),
          },
        ],
        count: 1,
      });

      const mockGte = vi.fn().mockReturnValue({ range: mockRange });
      const mockEqType = vi.fn().mockReturnValue({ gte: mockGte });
      const mockEqProj = vi.fn().mockReturnValue({ eq: mockEqType });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqProj });
      const mockOrder = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "activity_events") {
          return { select: mockSelect };
        }
        // Generic mock for other tables
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            }),
            limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
          }),
        };
      });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const result = await getAdminPlatformOverview({
        userId: "user-1",
        projectId: "proj-1",
        eventType: "ASSESSMENT_COMPLETED",
        period: "7d",
        limit: 10,
        offset: 0,
      });

      expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEqProj).toHaveBeenCalledWith("project_id", "proj-1");
      expect(mockEqType).toHaveBeenCalledWith("event_type", "ASSESSMENT_COMPLETED");
      expect(mockGte).toHaveBeenCalledWith("created_at", expect.any(String));
      expect(mockRange).toHaveBeenCalledWith(0, 9);
      expect(result.filteredActivity).toHaveLength(1);
      expect(result.totalFilteredActivity).toBe(1);
    });
  });

  describe("Admin User Inspection (Section C)", () => {
    it("returns null if target user does not exist", async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const detail = await getAdminUserDetail("missing-user-999");
      expect(detail).toBeNull();
    });

    it("returns fully aggregated user inspection payload when user exists", async () => {
      const mockProfile = {
        id: "target-user-1",
        email: "student@example.com",
        display_name: "Alice Student",
        is_admin: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          };
        }
        if (table === "spaces") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: "space-1", name: "Computer Science", created_at: "2026-01-02T00:00:00Z" }],
                }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "proj-1",
                      name: "Operating Systems",
                      learning_goal: "Master deadlock handling",
                      space_id: "space-1",
                      created_at: "2026-01-03T00:00:00Z",
                    },
                  ],
                }),
              }),
            }),
          };
        }
        if (table === "assessments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "ass-1",
                        project_id: "proj-1",
                        score: 85,
                        question_count: 10,
                        status: "completed",
                        completed_at: "2026-01-04T00:00:00Z",
                        started_at: "2026-01-04T00:00:00Z",
                      },
                    ],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "ai_usage_logs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "ai-log-1",
                        feature: "tutor",
                        model: "gemini-2.5-flash",
                        latency_ms: 320,
                        input_tokens: 150,
                        output_tokens: 80,
                        estimated_cost_usd: 0.00045,
                        status: "success",
                        created_at: "2026-01-04T00:00:00Z",
                      },
                    ],
                  }),
                }),
              }),
            }),
          };
        }
        // Fallback for activity, mastery, recommendations
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      });

      (createAdminClient as any).mockReturnValue({
        from: mockFrom,
      });

      const detail = await getAdminUserDetail("target-user-1");
      expect(detail).not.toBeNull();
      expect(detail?.user.displayName).toBe("Alice Student");
      expect(detail?.spaces).toHaveLength(1);
      expect(detail?.projects).toHaveLength(1);
      expect(detail?.assessments).toHaveLength(1);
      expect(detail?.averageScore).toBe(85);
      expect(detail?.aiUsage.totalCalls).toBe(1);
      expect(detail?.aiUsage.totalCostUsd).toBe(0.0005);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockProjectsSelect = vi.fn();
const mockMaterialsSelect = vi.fn();
const mockMaterialsDelete = vi.fn();
const mockStorageRemove = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: mockProjectsSelect,
        };
      }
      if (table === "materials") {
        return {
          select: mockMaterialsSelect,
          delete: mockMaterialsDelete,
        };
      }
      return {};
    }),
    storage: {
      from: () => ({
        remove: mockStorageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "materials") {
        return {
          select: mockMaterialsSelect,
          delete: mockMaterialsDelete,
        };
      }
      return {};
    }),
    storage: {
      from: () => ({
        remove: mockStorageRemove,
      }),
    },
  }),
}));

import { DELETE } from "./route";
import { deleteMaterial } from "@/lib/materials/delete";
import { executeProcessMaterialStep1 } from "@/inngest/material-processing";

describe("DELETE /api/projects/[projectId]/materials/[materialId] — Production Material Deletion Security & Cleanup", () => {
  const authenticatedUserId = "2f444c89-4a36-453f-bcd7-09feb59f752a";
  const otherUserId = "8e111a22-3b44-4c55-9d66-778899aabbcc";
  const validProjectId = "550e8400-e29b-41d4-a716-446655440000";
  const otherProjectId = "660e8400-e29b-41d4-a716-446655440001";
  const validMaterialId = "770e8400-e29b-41d4-a716-446655440002";
  const canonicalFilePath = `${authenticatedUserId}/${validProjectId}/${validMaterialId}/test-document.pdf`;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: authenticatedUserId } },
      error: null,
    });

    // Default project exists and belongs to authenticated user
    mockProjectsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validProjectId,
            user_id: authenticatedUserId,
          },
          error: null,
        }),
      }),
    });

    // Default material exists and belongs to this project & user
    mockMaterialsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validMaterialId,
            project_id: validProjectId,
            user_id: authenticatedUserId,
            file_path: canonicalFilePath,
            file_name: "test-document.pdf",
          },
          error: null,
        }),
      }),
    });

    // Default delete success
    mockMaterialsDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    // Default storage remove success
    mockStorageRemove.mockResolvedValue({
      data: [{ name: canonicalFilePath }],
      error: null,
    });
  });

  it("1. authenticated owner can delete material", async () => {
    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("test-document.pdf");
    expect(body.material.id).toBe(validMaterialId);

    // Verify DB delete was called
    expect(mockMaterialsDelete).toHaveBeenCalled();
  });

  it("2. unauthenticated user cannot delete (returns 401)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
    expect(mockMaterialsDelete).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("3. user cannot delete another user's project material (cross-user IDOR protected)", async () => {
    // Project belongs to someone else
    mockProjectsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validProjectId,
            user_id: otherUserId,
          },
          error: null,
        }),
      }),
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Project not found.");
    expect(mockMaterialsDelete).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("4. user cannot delete material belonging to another project", async () => {
    // Material is in otherProjectId, not validProjectId
    mockMaterialsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validMaterialId,
            project_id: otherProjectId,
            user_id: authenticatedUserId,
            file_path: canonicalFilePath,
            file_name: "test-document.pdf",
          },
          error: null,
        }),
      }),
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Material not found.");
    expect(mockMaterialsDelete).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("5. storage object is deleted using the DB's exact file_path", async () => {
    const customDbFilePath = "custom-user-folder/project-a/material-b/lecture-notes.pdf";
    mockMaterialsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validMaterialId,
            project_id: validProjectId,
            user_id: authenticatedUserId,
            file_path: customDbFilePath,
            file_name: "lecture-notes.pdf",
          },
          error: null,
        }),
      }),
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalledWith([customDbFilePath]);
    expect(mockStorageRemove).not.toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("*")]));
  });

  it("6. material-specific chunks and concepts are deleted via DB cascade and service", async () => {
    // Verify that deleteMaterial invokes materials table delete with id, project_id, and user_id
    const eqUser = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqProject = vi.fn().mockReturnValue({ eq: eqUser });
    const eqId = vi.fn().mockReturnValue({ eq: eqProject });
    const deleteSpy = vi.fn().mockReturnValue({ eq: eqId });

    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: validProjectId, user_id: authenticatedUserId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "materials") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: validMaterialId,
                    project_id: validProjectId,
                    user_id: authenticatedUserId,
                    file_path: canonicalFilePath,
                    file_name: "test-document.pdf",
                  },
                  error: null,
                }),
              }),
            }),
            delete: deleteSpy,
          };
        }
        return {};
      }),
    };

    const mockAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteMaterial({
      projectId: validProjectId,
      materialId: validMaterialId,
      userId: authenticatedUserId,
      supabase: mockDb as any,
      adminSupabase: mockAdmin as any,
    });

    expect(result.success).toBe(true);
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqId).toHaveBeenCalledWith("id", validMaterialId);
    expect(eqProject).toHaveBeenCalledWith("project_id", validProjectId);
    expect(eqUser).toHaveBeenCalledWith("user_id", authenticatedUserId);
  });

  it("7 & 8. shared concepts and unrelated project data are preserved (no broad deletes)", async () => {
    // Verify that deleteMaterial only touches table 'materials' with specific materialId,
    // relying strictly on foreign key cascade rather than firing manual deletes on unrelated concepts
    const tablesTouched: string[] = [];
    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        tablesTouched.push(table);
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: validProjectId, user_id: authenticatedUserId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "materials") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: validMaterialId,
                    project_id: validProjectId,
                    user_id: authenticatedUserId,
                    file_path: canonicalFilePath,
                    file_name: "test.pdf",
                  },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    const mockAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteMaterial({
      projectId: validProjectId,
      materialId: validMaterialId,
      userId: authenticatedUserId,
      supabase: mockDb as any,
      adminSupabase: mockAdmin as any,
    });

    expect(result.success).toBe(true);
    // Never touches concepts or concept_mastery directly, preserving shared concepts
    expect(tablesTouched).toContain("projects");
    expect(tablesTouched).toContain("materials");
    expect(tablesTouched).not.toContain("concepts");
    expect(tablesTouched).not.toContain("concept_mastery");
  });

  it("9. missing storage object is handled safely and idempotently", async () => {
    // Supabase Storage remove returns empty array or success when file is already absent
    mockStorageRemove.mockResolvedValue({
      data: [],
      error: null,
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockMaterialsDelete).toHaveBeenCalled();
  });

  it("10. nonexistent material returns 404 Not Found", async () => {
    mockMaterialsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Material not found.");
    expect(mockMaterialsDelete).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("11. repeated DELETE is safe/idempotent (returns 404 on second call)", async () => {
    // First call: material exists
    const request1 = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );
    const response1 = await DELETE(request1, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });
    expect(response1.status).toBe(200);

    // Second call: material has been deleted
    mockMaterialsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    const request2 = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );
    const response2 = await DELETE(request2, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });
    expect(response2.status).toBe(404);
  });

  it("12. storage failure is handled safely without deleting DB record", async () => {
    mockStorageRemove.mockResolvedValue({
      data: null,
      error: { message: "Internal storage gateway timeout" },
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("storage");
    // Crucial: DB record must NOT have been deleted when storage delete fails!
    expect(mockMaterialsDelete).not.toHaveBeenCalled();
  });

  it("13. DB cleanup failure is handled safely without leaking raw SQL or paths", async () => {
    mockMaterialsDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "deadlock detected at transaction 12345 in table materials",
              code: "40P01",
            },
          }),
        }),
      }),
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Unable to delete material record. Please try again.");
    expect(body.error).not.toContain("deadlock");
    expect(body.error).not.toContain("12345");
  });

  it("14. processing/deletion race condition is protected in Inngest pipeline", async () => {
    // When a material is deleted while Inngest starts, executeProcessMaterialStep1 gracefully skips
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Material was deleted!
              error: null,
            }),
          }),
        }),
      }),
    };

    const shouldProcess = await executeProcessMaterialStep1({
      materialId: validMaterialId,
      projectId: validProjectId,
      userId: authenticatedUserId,
      fileName: "race-condition.pdf",
      supabase: mockSupabase,
    });

    // Must return false without throwing or recreating chunks/concepts
    expect(shouldProcess).toBe(false);
  });

  it("15. client cannot control or inject the storage path", async () => {
    // Even if client sends malicious filePath or body in DELETE request
    const maliciousPayload = JSON.stringify({
      filePath: "victim-user/other-project/secret-file.pdf",
    });

    const request = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/${validMaterialId}`,
      {
        method: "DELETE",
        body: maliciousPayload,
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ projectId: validProjectId, materialId: validMaterialId }),
    });

    expect(response.status).toBe(200);
    // Verified: storage.remove called ONLY with canonicalFilePath from the DB, NEVER the client payload
    expect(mockStorageRemove).toHaveBeenCalledWith([canonicalFilePath]);
    expect(mockStorageRemove).not.toHaveBeenCalledWith(["victim-user/other-project/secret-file.pdf"]);
  });

  it("16. invalid UUID formats are rejected with 400 Bad Request", async () => {
    const request1 = new Request(
      `http://localhost:3000/api/projects/invalid-project/materials/${validMaterialId}`,
      { method: "DELETE" }
    );
    const response1 = await DELETE(request1, {
      params: Promise.resolve({ projectId: "invalid-project", materialId: validMaterialId }),
    });
    expect(response1.status).toBe(400);

    const request2 = new Request(
      `http://localhost:3000/api/projects/${validProjectId}/materials/invalid-material`,
      { method: "DELETE" }
    );
    const response2 = await DELETE(request2, {
      params: Promise.resolve({ projectId: validProjectId, materialId: "invalid-material" }),
    });
    expect(response2.status).toBe(400);
  });
});

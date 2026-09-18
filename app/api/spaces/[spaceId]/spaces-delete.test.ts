import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockSpacesSelect = vi.fn();
const mockSpacesDelete = vi.fn();
const mockProjectsSelect = vi.fn();
const mockMaterialsSelect = vi.fn();
const mockStorageRemove = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "spaces") {
        return {
          select: mockSpacesSelect,
          delete: mockSpacesDelete,
        };
      }
      if (table === "projects") {
        return {
          select: mockProjectsSelect,
        };
      }
      if (table === "materials") {
        return {
          select: mockMaterialsSelect,
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

describe("DELETE /api/spaces/[spaceId] — Delete Space Route Security & Cascade", () => {
  const authenticatedUserId = "2f444c89-4a36-453f-bcd7-09feb59f752a";
  const validSpaceId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: authenticatedUserId } },
      error: null,
    });

    // Default space exists and belongs to authenticated user
    mockSpacesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validSpaceId,
            name: "Programming Languages",
            user_id: authenticatedUserId,
          },
          error: null,
        }),
      }),
    });

    // Default delete success
    mockSpacesDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    // Default projects lookup (empty for basic case)
    mockProjectsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    // Default storage remove
    mockStorageRemove.mockResolvedValue({ data: [], error: null });
  });

  it("1. authenticated owner can delete their Space", async () => {
    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("Programming Languages");

    // Verify delete was called with spaceId AND user_id
    expect(mockSpacesDelete).toHaveBeenCalled();
  });

  it("2. unauthenticated user gets 401 Unauthorized", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    });

    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
    expect(mockSpacesDelete).not.toHaveBeenCalled();
  });

  it("3. user CANNOT delete another user's Space (cross-user deletion forbidden)", async () => {
    const victimUserId = "victim-user-uuid-9999";
    // Space exists in DB, but belongs to victimUserId, not authenticatedUserId
    mockSpacesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: validSpaceId,
            name: "Victim Private Space",
            user_id: victimUserId,
          },
          error: null,
        }),
      }),
    });

    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden. You do not own this Space.");

    // Critical assertion: delete must NEVER be invoked for another user's space
    expect(mockSpacesDelete).not.toHaveBeenCalled();
  });

  it("4. invalid Space ID format is rejected with 400 Bad Request", async () => {
    const request = new Request("http://localhost:3000/api/spaces/not-a-valid-uuid", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: "not-a-valid-uuid" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid Space ID.");
    expect(mockSpacesDelete).not.toHaveBeenCalled();
  });

  it("5. non-existent Space returns 404 Not Found", async () => {
    mockSpacesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Space not found.");
    expect(mockSpacesDelete).not.toHaveBeenCalled();
  });

  it("6. database failure during deletion is handled safely with 500 error", async () => {
    mockSpacesDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection terminated", code: "57P01" },
        }),
      }),
    });

    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Unable to delete Space. Please try again.");
  });

  it("7. cleans up physical storage files for materials in the space's projects", async () => {
    mockProjectsSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: "proj-1" }],
          error: null,
        }),
      }),
    });

    mockMaterialsSelect.mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { file_path: "user-1/proj-1/chapter1.pdf" },
          { file_path: "user-1/proj-1/slides.pdf" },
        ],
        error: null,
      }),
    });

    const request = new Request(`http://localhost:3000/api/spaces/${validSpaceId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ spaceId: validSpaceId }),
    });

    expect(response.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalledWith([
      "user-1/proj-1/chapter1.pdf",
      "user-1/proj-1/slides.pdf",
    ]);
  });
});

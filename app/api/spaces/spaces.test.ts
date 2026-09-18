import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "spaces") {
        return {
          insert: mockInsert,
        };
      }
      return {};
    }),
  }),
}));

import { POST } from "./route";

describe("POST /api/spaces — Study Space Creation Route", () => {
  const authenticatedUserId = "user-auth-uuid-1234";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default to valid authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: authenticatedUserId } },
      error: null,
    });

    // Default Supabase fluent insert mock
    mockSingle.mockResolvedValue({
      data: {
        id: "space-uuid-5678",
        name: "Programming Languages",
        description: "Study programming languages and related concepts.",
        created_at: "2026-09-17T12:00:00Z",
        updated_at: "2026-09-17T12:00:00Z",
      },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
  });

  it("1. authenticated user can create a Space and preserves ownership", async () => {
    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Programming Languages",
        description: "Study programming languages and related concepts.",
        // Malicious client tries to spoof another user ID
        user_id: "attacker-user-id",
        userId: "attacker-user-id",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.space).toBeDefined();
    expect(body.space.name).toBe("Programming Languages");

    // Verify ownership: must use authenticated user's ID, completely ignoring client spoofing
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: authenticatedUserId,
      name: "Programming Languages",
      description: "Study programming languages and related concepts.",
    });
  });

  it("2. required name is handled correctly: missing or whitespace returns 400", async () => {
    const requestEmpty = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "   ",
        description: "Empty name test",
      }),
    });

    const responseEmpty = await POST(requestEmpty);
    expect(responseEmpty.status).toBe(400);
    const bodyEmpty = await responseEmpty.json();
    expect(bodyEmpty.error).toBe("Space name is required.");
    expect(mockInsert).not.toHaveBeenCalled();

    const requestMissing = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "No name at all",
      }),
    });

    const responseMissing = await POST(requestMissing);
    expect(responseMissing.status).toBe(400);
    const bodyMissing = await responseMissing.json();
    expect(bodyMissing.error).toBe("Space name is required.");
  });

  it("2b. name exceeding 100 characters returns 400", async () => {
    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A".repeat(101),
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Space name cannot exceed 100 characters.");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("3. unauthenticated request returns 401 Unauthorized", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing" },
    });

    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Programming Languages",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("4. database/API error is surfaced gracefully as 500 without crashing", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "new row violates row-level security policy for table spaces",
      },
    });

    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Programming Languages",
        description: "Test description",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Unable to create Space. Please try again.");
  });

  it("5. optional description is nullable when omitted", async () => {
    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mathematics",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: authenticatedUserId,
      name: "Mathematics",
      description: null,
    });
  });
});

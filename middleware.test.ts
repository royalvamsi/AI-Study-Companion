import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { middleware } from "./middleware";

describe("Middleware Route Guard & Admin-Only Security Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockSupabase(user: any | null, profile: { is_admin?: boolean } | null) {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user },
      error: user ? null : { message: "Not authenticated" },
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: profile,
      error: profile ? null : { message: "Profile not found" },
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createServerClient as any).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  }

  // 1. Normal authenticated user accessing /admin -> redirected to /dashboard
  it("1. redirects a normal authenticated student away from /admin to /dashboard", async () => {
    setupMockSupabase(
      { id: "student-1", email: "student@example.com" },
      { is_admin: false }
    );

    const req = new NextRequest("http://localhost:3000/admin");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  // 2. Admin user accessing /admin -> permitted
  it("2. allows an authenticated admin user to access /admin", async () => {
    setupMockSupabase(
      { id: "admin-1", email: "admin@example.com" },
      { is_admin: true }
    );

    const req = new NextRequest("http://localhost:3000/admin");
    const res = await middleware(req);

    // Allowed through (not redirected to /dashboard or /login)
    expect(res.headers.get("location")).toBeNull();
  });

  // 3. Admin user accessing learner routes -> redirected to /admin
  it("3. strictly redirects an admin attempting to access learner routes to /admin", async () => {
    setupMockSupabase(
      { id: "admin-1", email: "admin@example.com" },
      { is_admin: true }
    );

    const learnerRoutes = [
      "/dashboard",
      "/projects",
      "/projects/proj-123",
      "/tutor",
      "/quiz",
      "/growth",
      "/analytics",
      "/recommendations",
    ];

    for (const route of learnerRoutes) {
      const req = new NextRequest(`http://localhost:3000${route}`);
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/admin");
    }
  });

  // 4. Normal user accessing learner routes -> permitted
  it("4. allows a normal student to access learner routes without redirection", async () => {
    setupMockSupabase(
      { id: "student-1", email: "student@example.com" },
      { is_admin: false }
    );

    const learnerRoutes = [
      "/dashboard",
      "/projects",
      "/tutor",
      "/quiz",
      "/growth",
      "/analytics",
      "/recommendations",
    ];

    for (const route of learnerRoutes) {
      const req = new NextRequest(`http://localhost:3000${route}`);
      const res = await middleware(req);

      expect(res.headers.get("location")).toBeNull();
    }
  });

  // 5. Unauthenticated user accessing protected routes -> redirected to /login
  it("5. redirects unauthenticated users accessing protected routes to /login", async () => {
    setupMockSupabase(null, null);

    const protectedRoutes = ["/admin", "/dashboard", "/projects", "/tutor", "/quiz"];

    for (const route of protectedRoutes) {
      const req = new NextRequest(`http://localhost:3000${route}`);
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    }
  });

  // 6. /forgot-password remains accessible to unauthenticated users
  it("6. keeps /forgot-password accessible to unauthenticated visitors", async () => {
    setupMockSupabase(null, null);

    const req = new NextRequest("http://localhost:3000/forgot-password");
    const res = await middleware(req);

    expect(res.headers.get("location")).toBeNull();
  });

  // 7. /reset-password remains accessible to authenticated users during recovery session
  it("7. keeps /reset-password accessible to authenticated users in password recovery", async () => {
    setupMockSupabase(
      { id: "recovery-user", email: "user@example.com" },
      { is_admin: false }
    );

    const req = new NextRequest("http://localhost:3000/reset-password");
    const res = await middleware(req);

    // Must NOT redirect away to /dashboard
    expect(res.headers.get("location")).toBeNull();
  });

  // 8. Client metadata spoofing attack prevention
  it("8. ignores client-controlled metadata (e.g. user_metadata.is_admin: true) and relies exclusively on database profile", async () => {
    // Malicious user injected is_admin: true into user_metadata, but profiles table has is_admin: false
    setupMockSupabase(
      {
        id: "attacker-1",
        email: "attacker@example.com",
        user_metadata: { is_admin: true },
        app_metadata: { is_admin: true },
      },
      { is_admin: false } // Trusted DB profile
    );

    const req = new NextRequest("http://localhost:3000/admin");
    const res = await middleware(req);

    // Attacker must be blocked and redirected to /dashboard
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  // 9. Fail-closed behavior on missing or erroring profile
  it("9. fails closed (treats as non-admin) when profile is null or database error occurs", async () => {
    setupMockSupabase(
      { id: "user-error", email: "user@example.com" },
      null // DB query returned null / error
    );

    const req = new NextRequest("http://localhost:3000/admin");
    const res = await middleware(req);

    // Must block and redirect to /dashboard
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});

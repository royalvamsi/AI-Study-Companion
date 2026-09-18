import { test, expect } from "@playwright/test";

test.describe("Phase 4: Authorization and Route Protection", () => {
  const protectedRoutes = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Spaces & Projects", path: "/projects" },
    { name: "AI Tutor", path: "/tutor" },
    { name: "Adaptive Quiz", path: "/quiz" },
    { name: "Growth & Mastery", path: "/growth" },
    { name: "Global Analytics", path: "/analytics" },
    { name: "Recommendations", path: "/recommendations" },
    { name: "Admin Dashboard", path: "/admin" },
    { name: "Admin Users Tab", path: "/admin?tab=users" },
    { name: "Admin User Detail", path: "/admin/users/00000000-0000-0000-0000-000000000000" },
  ];

  for (const route of protectedRoutes) {
    test(`Unauthenticated navigation to ${route.name} (${route.path}) redirects to /login`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("Protected API endpoints reject unauthenticated requests with HTTP 401", async ({
    request,
  }) => {
    // 1. /api/spaces
    const resSpaces = await request.get("/api/spaces");
    expect(resSpaces.status()).toBe(401);
    const jsonSpaces = await resSpaces.json();
    expect(jsonSpaces.error).toBe("Unauthorized");

    // 2. /api/spaces POST
    const resCreateSpace = await request.post("/api/spaces", {
      data: { name: "Unauthorized Space" },
    });
    expect(resCreateSpace.status()).toBe(401);

    // 3. /api/spaces/[id] DELETE
    const resDeleteSpace = await request.delete(
      "/api/spaces/00000000-0000-0000-0000-000000000000"
    );
    expect(resDeleteSpace.status()).toBe(401);

    // 4. /api/projects/[id]/materials POST
    const resUpload = await request.post(
      "/api/projects/00000000-0000-0000-0000-000000000000/materials"
    );
    expect(resUpload.status()).toBe(401);

    // 5. /api/projects/[id]/quiz/generate POST
    const resQuizGen = await request.post(
      "/api/projects/00000000-0000-0000-0000-000000000000/quiz/generate",
      { data: { questionCount: 3 } }
    );
    expect(resQuizGen.status()).toBe(401);

    // 6. /api/projects/[id]/quiz/submit POST
    const resQuizSub = await request.post(
      "/api/projects/00000000-0000-0000-0000-000000000000/quiz/submit",
      { data: { assessmentId: "test", answers: [] } }
    );
    expect(resQuizSub.status()).toBe(401);

    // 7. /api/projects/[id]/tutor POST
    const resTutor = await request.post(
      "/api/projects/00000000-0000-0000-0000-000000000000/tutor",
      { data: { message: "Hello" } }
    );
    expect(resTutor.status()).toBe(401);
  });
});

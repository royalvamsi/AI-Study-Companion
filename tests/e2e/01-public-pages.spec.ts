import { test, expect } from "@playwright/test";

test.describe("Phase 2: Public Application Pages", () => {
  test("Landing page loads with hero, navigation, and footer without console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/AI Study Companion/i);

    // Hero Section
    const mainHeading = page.locator("h1");
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText("Learn with context");

    // Header CTA
    const getStartedNav = page.locator('header a[href="/signup"]');
    await expect(getStartedNav).toBeVisible();

    // On viewport >= 768px, desktop nav is visible
    const isMobile = (page.viewportSize()?.width ?? 1024) < 768;
    if (!isMobile) {
      const signInNav = page.locator('header nav a[href="/login"]');
      await expect(signInNav).toBeVisible();
    }

    // CTA links
    const startLearningCta = page.locator('a[href="/signup"]:has-text("Start learning")');
    await expect(startLearningCta).toBeVisible();

    // Footer
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("AI Study Companion");

    // Filter benign favicon or font network errors
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes("favicon") && !err.includes("font")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("Landing page navigation links navigate to /login and /signup", async ({
    page,
  }) => {
    await page.goto("/");

    const isMobile = (page.viewportSize()?.width ?? 1024) < 768;

    // Navigate to /login (from header on desktop, or footer on mobile)
    if (isMobile) {
      await page.locator('footer a[href="/login"]').click();
    } else {
      await page.locator('header a[href="/login"]').first().click();
    }
    await expect(page).toHaveURL(/\/login/);

    // Navigate back to landing
    await page.goto("/");

    // Click Get started in header
    await page.locator('header a[href="/signup"]').first().click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("Login page renders all inputs, buttons, and forgot password link", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    const forgotPasswordLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveText("Forgot password?");

    const createAccountLink = page.getByRole("link", { name: /create one free/i });
    await expect(createAccountLink).toBeVisible();
  });

  test("Signup page renders form and enforces password minimum length", async ({
    page,
  }) => {
    await page.goto("/signup");

    await expect(page.locator("input#displayName")).toBeVisible();
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();

    // Attempt signup with short password (< 8 chars)
    await page.fill("input#displayName", "Test User");
    await page.fill("input#email", "shortpass@example.com");
    await page.fill("input#password", "short");
    await page.click('button[type="submit"]');

    // Error alert must be shown
    const errorAlert = page.locator('form [role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("at least 8 characters");
  });

  test("Forgot password page renders, validates email, and displays generic success message", async ({
    page,
  }) => {
    await page.goto("/forgot-password");

    const emailInput = page.locator("input#email");
    await expect(emailInput).toBeVisible();
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Submit invalid email
    await emailInput.fill("invalid-email-format");
    await submitBtn.click();
    // HTML5 email validation or error alert
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);

    // Submit valid email format (tests account enumeration defense)
    await emailInput.fill("audittest@example.com");
    await submitBtn.click();

    // Expect generic success card without account enumeration
    await expect(page.locator("text=Check your email")).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator("text=If an account exists for audittest@example.com, we've sent a password reset link")
    ).toBeVisible();

    // Link to return to sign in must work
    const returnLink = page.getByRole("link", { name: /return to sign in/i });
    await expect(returnLink).toBeVisible();
  });

  test("Reset password page handles unauthenticated direct access safely", async ({
    page,
  }) => {
    // Navigate directly without recovery hash/code
    await page.goto("/reset-password");

    // Must show Invalid or Expired Link state
    await expect(page.locator("text=Invalid or Expired Link")).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=No active password recovery session was found")
    ).toBeVisible();

    // Has button to request new link
    const requestNewBtn = page.locator('a[href="/forgot-password"] button');
    await expect(requestNewBtn).toBeVisible();

    // Back to sign in link
    const backToSignIn = page.getByRole("link", { name: /back to sign in/i });
    await expect(backToSignIn).toBeVisible();
  });
});

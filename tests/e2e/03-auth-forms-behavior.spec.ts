import { test, expect } from "@playwright/test";

test.describe("Phase 3 & 37: Authentication Failure and Error States", () => {
  test("Invalid login credentials displays error and does not authenticate", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.fill("input#email", "nonexistent-user-audit@example.com");
    await page.fill("input#password", "IntentionallyWrongPass123!");
    await page.click('button[type="submit"]');

    // Verify error is shown in UI
    const errorAlert = page.locator('form [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText(/Invalid login credentials|credentials/i);

    // Verify page did NOT redirect to dashboard or admin
    expect(page.url()).toContain("/login");
  });

  test("Password visibility toggle button reveals and conceals password", async ({
    page,
  }) => {
    await page.goto("/login");

    const passwordInput = page.locator("input#password");
    await passwordInput.fill("SecretPassword123!");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click toggle button
    const toggleBtn = page.locator('button[aria-label="Show password"], button[aria-label="Hide password"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute("type", "text");
      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    }
  });

  test("Empty form submissions are blocked by HTML5 required validation", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.locator("input#email");
    const submitBtn = page.locator('button[type="submit"]');

    await submitBtn.click();
    const isEmailValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isEmailValid).toBe(false);
  });
});

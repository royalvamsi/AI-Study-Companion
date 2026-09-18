import { test, expect } from "@playwright/test";

test.describe("Phase 29: Responsive Testing Across Viewports", () => {
  const viewports = [
    { name: "Desktop", width: 1440, height: 900 },
    { name: "Laptop", width: 1280, height: 800 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Mobile", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`Landing page renders without horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Check document scroll width does not exceed client width (no horizontal overflow)
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Verify header is visible
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Verify hero title is visible
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
    });

    test(`Login page renders and form is fully contained on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();
    });
  }
});

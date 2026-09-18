import { createAdminClient } from "../lib/supabase/admin";
import { chromium } from "playwright";
import * as dotenv from "dotenv";
import * as fs from "fs";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

async function main() {
  const supabase = createAdminClient();
  const userId = "2f444c89-4a36-453f-bcd7-09feb59f752a";
  const email = "grayalvamsiprecious777@gmail.com";
  const password = "TestPassword123!";

  console.log("Setting password and is_admin for test user...");
  const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
    password: password,
  });
  if (updateErr) {
    console.error("Failed to update user password:", updateErr);
    return;
  }
  console.log("User password updated.");

  await supabase.from("profiles").update({ is_admin: true }).eq("id", userId);
  console.log("Profile updated to is_admin: true.");

  console.log("Launching browser via Playwright (msedge)...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/login...");
  await page.goto("http://localhost:3000/login");
  await page.waitForSelector("input#email");

  console.log("Filling login form...");
  await page.fill("input#email", email);
  await page.fill("input#password", password);
  await page.click('button[type="submit"]');

  console.log("Waiting for navigation to /dashboard...");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  console.log("Successfully logged in! Current URL:", page.url());

  const cookies = await context.cookies();
  console.log("Cookies:", cookies.map((c) => c.name));

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);

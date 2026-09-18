import { createAdminClient } from "../lib/supabase/admin";
import { chromium } from "playwright";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

const WORKSPACE_DIR = "d:/AI STUDY COMPANION/screenshots";
const ARTIFACT_DIR = "C:/Users/royal/.gemini/antigravity-ide/brain/a1c323c8-bb18-4056-801e-fade244bca19/screenshots";

const USER_ID = "871145e1-5434-41fb-92e4-0402ff48f33b";
const USER_EMAIL = "alphatej1@gmail.com";
const USER_PASS = "TestPassword123!";
const PROJECT_ID = "daf5ff36-c8e5-4773-b236-4a02dfbf49ff";

async function main() {
  // Ensure destination folders exist
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const supabase = createAdminClient();

  console.log("1. Preparing user credentials & admin privileges...");
  await supabase.auth.admin.updateUserById(USER_ID, { password: USER_PASS });
  await supabase.from("profiles").update({ is_admin: true }).eq("id", USER_ID);
  console.log("User ready.");

  console.log("2. Launching browser...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const pagesToCapture = [
    {
      id: "01_login_page",
      title: "Login Page",
      url: "http://localhost:3000/login",
      authenticated: false,
      waitFor: "input#email",
    },
    {
      id: "02_signup_page",
      title: "Sign Up Page",
      url: "http://localhost:3000/signup",
      authenticated: false,
      waitFor: "input#email",
    },
    {
      id: "03_dashboard",
      title: "Learning Dashboard",
      url: "http://localhost:3000/dashboard",
      authenticated: true,
      waitFor: "text=AI Study Companion",
    },
    {
      id: "04_projects_spaces",
      title: "Study Spaces & Projects",
      url: "http://localhost:3000/projects",
      authenticated: true,
      waitFor: "text=COMPUTER SCIENCE",
    },
    {
      id: "05_project_detail",
      title: "Project Detail Workspace",
      url: `http://localhost:3000/projects/${PROJECT_ID}`,
      authenticated: true,
      waitFor: "text=COMPUTER NETWORKS",
    },
    {
      id: "06_project_analytics",
      title: "Project Concept Analytics",
      url: `http://localhost:3000/projects/${PROJECT_ID}/analytics`,
      authenticated: true,
      waitFor: "text=Analytics",
    },
    {
      id: "07_ai_tutor_landing",
      title: "AI Tutor Landing",
      url: "http://localhost:3000/tutor",
      authenticated: true,
      waitFor: "text=AI Tutor",
    },
    {
      id: "08_ai_tutor_project_chat",
      title: "AI Tutor Context Chat",
      url: `http://localhost:3000/tutor?project=${PROJECT_ID}`,
      authenticated: true,
      waitFor: "text=COMPUTER NETWORKS",
    },
    {
      id: "09_quiz_landing",
      title: "Adaptive Quiz Selection",
      url: "http://localhost:3000/quiz",
      authenticated: true,
      waitFor: "text=Quiz",
    },
    {
      id: "10_quiz_project_active",
      title: "Adaptive Quiz Project Setup",
      url: `http://localhost:3000/quiz?project=${PROJECT_ID}`,
      authenticated: true,
      waitFor: "text=Quiz",
    },
    {
      id: "11_global_analytics",
      title: "Global Analytics & Telemetry",
      url: "http://localhost:3000/analytics",
      authenticated: true,
      waitFor: "text=Analytics",
    },
    {
      id: "12_growth_analysis",
      title: "Growth & Retention Analysis",
      url: "http://localhost:3000/growth",
      authenticated: true,
      waitFor: "text=Growth",
    },
    {
      id: "13_recommendations",
      title: "AI Learning Recommendations",
      url: "http://localhost:3000/recommendations",
      authenticated: true,
      waitFor: "text=Recommendations",
    },
    {
      id: "14_admin_dashboard",
      title: "Platform Admin Console",
      url: "http://localhost:3000/admin",
      authenticated: true,
      waitFor: "text=Platform Admin",
    },
    {
      id: "15_admin_user_detail",
      title: "Admin User Detail Inspection",
      url: `http://localhost:3000/admin/users/${USER_ID}`,
      authenticated: true,
      waitFor: "text=Inspection",
    },
  ];

  let isLoggedIn = false;

  for (const item of pagesToCapture) {
    console.log(`\n--- Capturing [${item.id}]: ${item.title} ---`);

    // Handle authentication state
    if (item.authenticated && !isLoggedIn) {
      console.log("Performing login...");
      await page.goto("http://localhost:3000/login");
      await page.waitForSelector("input#email");
      await page.fill("input#email", USER_EMAIL);
      await page.fill("input#password", USER_PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard", { timeout: 15000 });
      console.log("Logged in successfully.");
      isLoggedIn = true;
      // Allow dashboard to fully mount
      await page.waitForTimeout(2000);
    }

    try {
      console.log(`Navigating to ${item.url}...`);
      await page.goto(item.url, { waitUntil: "networkidle" });
      if (item.waitFor) {
        try {
          await page.waitForSelector(item.waitFor, { timeout: 8000 });
        } catch {
          console.log(`Note: Specific selector "${item.waitFor}" not found within timeout, continuing.`);
        }
      }
      // Brief pause for animations, Recharts, and fonts to stabilize
      await page.waitForTimeout(2000);

      const filename = `${item.id}.png`;
      const workspacePath = path.join(WORKSPACE_DIR, filename);
      const artifactPath = path.join(ARTIFACT_DIR, filename);

      await page.screenshot({ path: workspacePath, fullPage: false });
      fs.copyFileSync(workspacePath, artifactPath);

      console.log(`✓ Saved: ${filename}`);
    } catch (err) {
      console.error(`Error capturing ${item.id}:`, err);
    }
  }

  await browser.close();
  console.log("\nAll screenshots captured successfully!");
}

main().catch(console.error);

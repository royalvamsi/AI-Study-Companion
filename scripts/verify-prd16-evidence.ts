import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as dotenv from "dotenv";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

import { getAdminPlatformOverview, getAdminUserDetail, verifyAdminStatus } from "../lib/admin/admin-queries";

async function main() {
  console.log("=== PRD SECTION 16: LIVE DATABASE VERIFICATION & EVIDENCE ===\n");

  // 1. Platform Overview Stats
  console.log("--- 1. Platform Overview Stats ---");
  const overview = await getAdminPlatformOverview();
  console.log("Total Users:", overview.stats.users.total);
  console.log("Total Spaces:", overview.stats.spaces.total);
  console.log("Total Projects:", overview.stats.projects.total);
  console.log("Total Assessments:", overview.stats.learningAnalytics.totalAssessmentsCompleted);
  console.log("Average Score:", overview.stats.learningAnalytics.averageScore + "%");
  console.log("AI Calls Logged:", overview.stats.aiUsage.totalCalls);
  console.log("AI Total Spend USD:", "$" + overview.stats.aiUsage.totalCostUsd);
  console.log("System Health:", overview.stats.systemHealth.status);
  console.log("Materials Total:", overview.stats.backgroundProcessing.materialsTotal);
  console.log("Materials Failed:", overview.stats.backgroundProcessing.materialsFailed);

  // 2. Activity Filtering (Section D)
  console.log("\n--- 2. Database-level Activity Filters ---");
  const firstUser = overview.stats.users.recentList[0];
  const firstProject = overview.stats.projects.recentList[0];

  // A: Filter by User
  if (firstUser) {
    const userFiltered = await getAdminPlatformOverview({ userId: firstUser.id, limit: 3 });
    console.log(`Filter [User: ${firstUser.displayName} (${firstUser.id})]:`);
    console.log(`  Matching Events Count: ${userFiltered.totalFilteredActivity}`);
    console.log(`  Returned Items: ${userFiltered.filteredActivity.length}`);
    if (userFiltered.filteredActivity[0]) {
      console.log(`  Sample Event: ${userFiltered.filteredActivity[0].eventType} at ${userFiltered.filteredActivity[0].createdAt}`);
    }
  }

  // B: Filter by Space (PRD 16 / Section D)
  const firstSpace = overview.stats.spaces.recentList[0];
  if (firstSpace) {
    const spaceFiltered = await getAdminPlatformOverview({ spaceId: firstSpace.id, limit: 5 });
    console.log(`\nFilter [Space: ${firstSpace.name} (${firstSpace.id})]:`);
    console.log(`  Matching Events Count: ${spaceFiltered.totalFilteredActivity}`);
    console.log(`  Returned Items: ${spaceFiltered.filteredActivity.length}`);
    if (spaceFiltered.filteredActivity[0]) {
      console.log(`  Sample Event: ${spaceFiltered.filteredActivity[0].eventType} at ${spaceFiltered.filteredActivity[0].createdAt}`);
    }
  }

  // C: Filter by Project
  if (firstProject) {
    const projFiltered = await getAdminPlatformOverview({ projectId: firstProject.id, limit: 3 });
    console.log(`\nFilter [Project: ${firstProject.name} (${firstProject.id})]:`);
    console.log(`  Matching Events Count: ${projFiltered.totalFilteredActivity}`);
    console.log(`  Returned Items: ${projFiltered.filteredActivity.length}`);
    if (projFiltered.filteredActivity[0]) {
      console.log(`  Sample Event: ${projFiltered.filteredActivity[0].eventType} at ${projFiltered.filteredActivity[0].createdAt}`);
    }
  }

  // C: Filter by Activity Type
  const typeFiltered = await getAdminPlatformOverview({ eventType: "MATERIAL_READY", limit: 3 });
  console.log(`\nFilter [Event Type: MATERIAL_READY]:`);
  console.log(`  Matching Events Count: ${typeFiltered.totalFilteredActivity}`);
  console.log(`  Returned Items: ${typeFiltered.filteredActivity.length}`);

  // D: Filter by Time Period (30d)
  const periodFiltered = await getAdminPlatformOverview({ period: "30d", limit: 3 });
  console.log(`\nFilter [Time Period: 30d]:`);
  console.log(`  Matching Events Count: ${periodFiltered.totalFilteredActivity}`);
  console.log(`  Returned Items: ${periodFiltered.filteredActivity.length}`);

  // 3. User Inspection (Section C)
  console.log("\n--- 3. User Inspection Detail ---");
  if (firstProject) {
    const activeUser = await (createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).from("projects") as any)
      .select("user_id")
      .eq("id", firstProject.id)
      .single();

    const activeUserId = activeUser.data?.user_id || firstUser?.id;
    const userDetail = await getAdminUserDetail(activeUserId);
    if (userDetail) {
      console.log("Inspected Active User:", userDetail.user.displayName, `(${userDetail.user.email})`);
      console.log("  User ID:", userDetail.user.id);
      console.log("  Spaces Owned:", userDetail.spaces.length);
      console.log("  Projects Owned:", userDetail.projects.length);
      console.log("  Assessments Completed:", userDetail.assessments.length);
      console.log("  Average Score:", userDetail.averageScore + "%");
      console.log("  Mastered Concepts:", userDetail.mastery.length);
      console.log("  Recommendations:", userDetail.recommendations.length);
      console.log("  Activity Log Items:", userDetail.activity.length);
      console.log("  AI Usage Operations:", userDetail.aiUsage.totalCalls);
      console.log("  AI Usage Spend:", "$" + userDetail.aiUsage.totalCostUsd);
    }
  }

  console.log("\n=== VERIFICATION FINISHED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as dotenv from "dotenv";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== VERIFY STUDY SPACE CREATION & OWNERSHIP ===\n");

  // 1. Get existing primary user
  const { data: users, error: userErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .limit(1);

  if (userErr || !users || users.length === 0) {
    throw new Error("No user found in profiles: " + JSON.stringify(userErr));
  }

  const testUser = users[0];
  console.log("Testing with user:", {
    id: testUser.id,
    email: testUser.email,
    displayName: testUser.display_name,
  });

  // 2. Clean up any existing "Programming Languages" spaces for a fresh test run
  await supabase
    .from("spaces")
    .delete()
    .eq("user_id", testUser.id)
    .eq("name", "Programming Languages");

  // 3. Create the Space as specified in prompt:
  // Name: "Programming Languages"
  // Description: "Study programming languages and related concepts."
  const { data: createdSpace, error: insertError } = await supabase
    .from("spaces")
    .insert({
      user_id: testUser.id,
      name: "Programming Languages",
      description: "Study programming languages and related concepts.",
    })
    .select("id, name, description, user_id, created_at, updated_at")
    .single();

  if (insertError) {
    console.error("Failed to insert Space:", insertError);
    process.exit(1);
  }

  console.log("\n[Step 1] Space created successfully:", createdSpace);

  // 4. Verify directly in Supabase
  const { data: allMatchingSpaces, error: queryError } = await supabase
    .from("spaces")
    .select("id, name, description, user_id, created_at, updated_at")
    .eq("user_id", testUser.id)
    .eq("name", "Programming Languages");

  if (queryError) {
    console.error("Query error:", queryError);
    process.exit(1);
  }

  console.log("\n[Step 2] Direct Supabase Query Verification:");
  console.log("- Count of matching spaces:", allMatchingSpaces.length);
  const match = allMatchingSpaces[0];

  const hasSingleSpace = allMatchingSpaces.length === 1;
  const nameCorrect = match.name === "Programming Languages";
  const descCorrect = match.description === "Study programming languages and related concepts.";
  const ownershipCorrect = match.user_id === testUser.id;
  const createdAtValid = !isNaN(Date.parse(match.created_at));
  const updatedAtValid = !isNaN(Date.parse(match.updated_at));

  console.log("- Exactly one space exists:", hasSingleSpace ? "PASS" : "FAIL");
  console.log("- Name is correct:", nameCorrect ? "PASS" : "FAIL", `("${match.name}")`);
  console.log("- Description is correct:", descCorrect ? "PASS" : "FAIL", `("${match.description}")`);
  console.log("- Belongs to authenticated user:", ownershipCorrect ? "PASS" : "FAIL", `(${match.user_id})`);
  console.log("- Timestamps valid:", createdAtValid && updatedAtValid ? "PASS" : "FAIL", `(created: ${match.created_at})`);

  // 5. Verify no unrelated user's space was created
  const { count: unrelatedCount } = await supabase
    .from("spaces")
    .select("id", { count: "exact" })
    .neq("user_id", testUser.id)
    .eq("name", "Programming Languages");

  console.log("- No unrelated user space created:", unrelatedCount === 0 ? "PASS" : "FAIL");

  // 6. Verify Dashboard Data Fetching query
  const { data: dashboardSpaces, error: dashErr } = await supabase
    .from("spaces")
    .select("*, projects(id, name, description, created_at, updated_at)")
    .eq("user_id", testUser.id)
    .order("created_at", { ascending: false });

  if (dashErr) {
    console.error("Dashboard spaces query error:", dashErr);
    process.exit(1);
  }

  const spaceOnDashboard = dashboardSpaces?.find((s) => s.id === match.id);
  console.log("\n[Step 3] Dashboard Data Fetching Simulation:");
  console.log("- Total spaces retrieved for user:", dashboardSpaces?.length);
  console.log("- Newly created space retrieved for dashboard:", spaceOnDashboard ? "PASS" : "FAIL");
  if (spaceOnDashboard) {
    console.log("  Space ID:", spaceOnDashboard.id);
    console.log("  Space Name:", spaceOnDashboard.name);
    console.log("  Projects attached count:", spaceOnDashboard.projects?.length);
  }

  if (
    hasSingleSpace &&
    nameCorrect &&
    descCorrect &&
    ownershipCorrect &&
    createdAtValid &&
    updatedAtValid &&
    unrelatedCount === 0 &&
    spaceOnDashboard
  ) {
    console.log("\nALL DATABASE AND DASHBOARD VERIFICATION CHECKS PASSED!");
  } else {
    console.error("\nSome checks failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});

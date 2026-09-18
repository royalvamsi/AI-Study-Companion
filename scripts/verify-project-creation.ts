import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as dotenv from "dotenv";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== VERIFY PROJECT CREATION & SPACE DISPLAY ASSOCIATION ===\n");

  // 1. Get primary user
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .limit(1);

  const testUser = users![0];

  // 2. Find or create "Programming Languages" Space
  let { data: space } = await supabase
    .from("spaces")
    .select("id, name, user_id")
    .eq("user_id", testUser.id)
    .eq("name", "Programming Languages")
    .maybeSingle();

  if (!space) {
    const { data: newSpace, error: createSpaceErr } = await supabase
      .from("spaces")
      .insert({
        user_id: testUser.id,
        name: "Programming Languages",
        description: "Study programming languages and related concepts.",
      })
      .select("id, name, user_id")
      .single();

    if (createSpaceErr || !newSpace) {
      throw new Error("Failed to create 'Programming Languages' space: " + JSON.stringify(createSpaceErr));
    }
    space = newSpace;
  }

  console.log("Found Space:", {
    id: space.id,
    name: space.name,
    userId: space.user_id,
  });

  // 3. Simulate project creation via the exact same insert performed by handleCreateProject
  // Project Name: "Programming Languages — Basics"
  // Assign Space: space.id (the UUID)
  const { data: newProject, error: projErr } = await supabase
    .from("projects")
    .insert({
      space_id: space.id,
      user_id: testUser.id,
      name: "Programming Languages — Basics",
      description: "Foundational concepts and paradigms.",
      learning_goal: "Understand interpreters, compilers, and typing.",
    })
    .select("id, name, space_id, user_id, created_at, updated_at")
    .single();

  if (projErr || !newProject) {
    throw new Error("Failed to insert project: " + JSON.stringify(projErr));
  }

  console.log("\n[Step 1] Project created successfully:", newProject);

  // 4. Verify directly in database
  console.log("\n[Step 2] Verify Database Storage & Space Association:");
  console.log("- Database space_id stored as UUID:", newProject.space_id === space.id ? "PASS" : "FAIL");
  console.log("  Expected UUID:", space.id);
  console.log("  Stored UUID:  ", newProject.space_id);
  console.log("- Project Name stored:", newProject.name === "Programming Languages — Basics" ? "PASS" : "FAIL");

  // 5. Verify /projects query join (how UI receives it)
  const { data: queriedProject, error: queryErr } = await supabase
    .from("projects")
    .select("id, name, space_id, spaces(id, name)")
    .eq("id", newProject.id)
    .single();

  if (queryErr) throw new Error("Failed to query project with spaces join: " + JSON.stringify(queryErr));

  console.log("\n[Step 3] Verify Joined Display Information:");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joinedSpace = (queriedProject as any).spaces;
  console.log("- Joined Space Name available for UI:", joinedSpace?.name === "Programming Languages" ? "PASS" : "FAIL");
  console.log("  Human-readable name for user display:", joinedSpace?.name);
  console.log("  Underlying ID for database relations: ", joinedSpace?.id);

  // 6. Clean up test project
  await supabase.from("projects").delete().eq("id", newProject.id);
  console.log("\n[Step 4] Test project cleaned up. Test environment clean!");
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});

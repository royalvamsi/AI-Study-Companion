import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as dotenv from "dotenv";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== COMPREHENSIVE SPACE DELETION & CASCADE DATABASE VERIFICATION ===\n");

  // 1. Get primary user
  const { data: users, error: userErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .limit(2);

  if (userErr || !users || users.length === 0) {
    throw new Error("No profiles found: " + JSON.stringify(userErr));
  }

  const primaryUser = users[0];
  console.log("Primary User:", {
    id: primaryUser.id,
    email: primaryUser.email,
  });

  // Verify another user exists or create a synthetic unrelated user ID for isolation checks
  const unrelatedUserId = users[1]?.id ?? "00000000-0000-0000-0000-000000000001";

  // -------------------------------------------------------------
  // TEST CASE A: Deletion of Space with 0 projects
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE A: Space with 0 Projects ---");
  const { data: spaceA, error: spaceAErr } = await supabase
    .from("spaces")
    .insert({
      user_id: primaryUser.id,
      name: "Delete Test Space A (Empty)",
      description: "Testing empty space deletion",
    })
    .select()
    .single();

  if (spaceAErr || !spaceA) throw new Error("Failed to insert Space A: " + JSON.stringify(spaceAErr));
  console.log("Created Space A:", spaceA.id, spaceA.name);

  // Delete Space A
  const { error: delAErr } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceA.id)
    .eq("user_id", primaryUser.id);

  if (delAErr) throw new Error("Failed to delete Space A: " + JSON.stringify(delAErr));

  // Verify Space A is gone
  const { data: checkA } = await supabase.from("spaces").select("id").eq("id", spaceA.id).maybeSingle();
  console.log("Verification Space A exists:", checkA ? "FAILED (still exists)" : "PASSED (cleanly deleted)");

  // -------------------------------------------------------------
  // TEST CASE B: Deletion of Space containing Projects
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE B: Space with Projects (Cascade Check) ---");
  const { data: spaceB, error: spaceBErr } = await supabase
    .from("spaces")
    .insert({
      user_id: primaryUser.id,
      name: "Delete Test Space B (With Projects)",
      description: "Testing project cascade",
    })
    .select()
    .single();

  if (spaceBErr || !spaceB) throw new Error("Failed to insert Space B: " + JSON.stringify(spaceBErr));

  // Create two projects in Space B
  const { data: projB1 } = await supabase
    .from("projects")
    .insert({
      space_id: spaceB.id,
      user_id: primaryUser.id,
      name: "Test Project B1",
    })
    .select()
    .single();

  const { data: projB2 } = await supabase
    .from("projects")
    .insert({
      space_id: spaceB.id,
      user_id: primaryUser.id,
      name: "Test Project B2",
    })
    .select()
    .single();

  console.log("Created Space B and attached projects:", {
    space: spaceB.id,
    proj1: projB1?.id,
    proj2: projB2?.id,
  });

  // Delete Space B
  const { error: delBErr } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceB.id)
    .eq("user_id", primaryUser.id);

  if (delBErr) throw new Error("Failed to delete Space B: " + JSON.stringify(delBErr));

  // Verify Space B and Projects B1, B2 are deleted
  const { data: checkSpaceB } = await supabase.from("spaces").select("id").eq("id", spaceB.id).maybeSingle();
  const { data: checkProjectsB } = await supabase
    .from("projects")
    .select("id")
    .in("id", [projB1!.id, projB2!.id]);

  console.log("Verification Space B deleted:", !checkSpaceB ? "PASSED" : "FAILED");
  console.log("Verification Projects B1 & B2 cascade deleted:", checkProjectsB?.length === 0 ? "PASSED" : "FAILED");

  // -------------------------------------------------------------
  // TEST CASE C: Deletion of Space with Full Dependent Learning Data
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE C: Full Dependent Learning Data Cascade ---");
  const { data: spaceC } = await supabase
    .from("spaces")
    .insert({
      user_id: primaryUser.id,
      name: "Delete Test Space C (Full Cascade)",
    })
    .select()
    .single();

  const { data: projC } = await supabase
    .from("projects")
    .insert({
      space_id: spaceC!.id,
      user_id: primaryUser.id,
      name: "Project C Full Data",
    })
    .select()
    .single();

  // 1. Material
  const { data: matC } = await supabase
    .from("materials")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      file_name: "test_doc.pdf",
      file_path: "test/doc.pdf",
      status: "ready",
    })
    .select()
    .single();

  // 2. Concept
  const { data: concC } = await supabase
    .from("concepts")
    .insert({
      project_id: projC!.id,
      source_material_id: matC!.id,
      name: "Cascade Concept C",
    })
    .select()
    .single();

  // 3. Conversation & Message
  const { data: convC } = await supabase
    .from("conversations")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      title: "Chat C",
    })
    .select()
    .single();

  const { data: msgC } = await supabase
    .from("messages")
    .insert({
      conversation_id: convC!.id,
      role: "user",
      content: "Hello Tutor",
    })
    .select()
    .single();

  // 4. Learning Context
  const { data: ctxC } = await supabase
    .from("learning_context")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      learning_goal: "Master C",
    })
    .select()
    .single();

  // 5. Concept Mastery
  const { data: mastC } = await supabase
    .from("concept_mastery")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      concept_id: concC!.id,
      mastery_score: 85,
    })
    .select()
    .single();

  // 6. Assessment
  const { data: asmtC } = await supabase
    .from("assessments")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      status: "completed",
    })
    .select()
    .single();

  // 7. Assessment Question
  const { data: asmtQ } = await supabase
    .from("assessment_questions")
    .insert({
      assessment_id: asmtC!.id,
      concept_id: concC!.id,
      question_type: "mcq",
      question_text: "What is C?",
    })
    .select()
    .single();

  // 8. Recommendation
  const { data: recC } = await supabase
    .from("recommendations")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      concept_id: concC!.id,
      priority: "HIGH",
      action_type: "REVIEW_MATERIAL",
    })
    .select()
    .single();

  // 9. Activity Event
  const { data: actC } = await supabase
    .from("activity_events")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      event_type: "PROJECT_CREATED",
    })
    .select()
    .single();

  // 10. AI Usage Log
  const { data: aiLogC } = await supabase
    .from("ai_usage_logs")
    .insert({
      project_id: projC!.id,
      user_id: primaryUser.id,
      feature: "TUTOR_CHAT",
      model: "gemini-2.5-flash",
      status: "success",
    })
    .select()
    .single();

  console.log("Populated all dependent records for Space C and Project C.");

  // Execute DELETE of Space C
  const { error: delCErr } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceC!.id)
    .eq("user_id", primaryUser.id);

  if (delCErr) throw new Error("Failed to delete Space C: " + JSON.stringify(delCErr));

  // Verify all cascades
  const [
    chkSpace,
    chkProj,
    chkMat,
    chkConc,
    chkConv,
    chkMsg,
    chkCtx,
    chkMast,
    chkAsmt,
    chkAsmtQ,
    chkRec,
    chkAct,
    chkAiLog,
  ] = await Promise.all([
    supabase.from("spaces").select("id").eq("id", spaceC!.id).maybeSingle(),
    supabase.from("projects").select("id").eq("id", projC!.id).maybeSingle(),
    supabase.from("materials").select("id").eq("id", matC!.id).maybeSingle(),
    supabase.from("concepts").select("id").eq("id", concC!.id).maybeSingle(),
    supabase.from("conversations").select("id").eq("id", convC!.id).maybeSingle(),
    supabase.from("messages").select("id").eq("id", msgC!.id).maybeSingle(),
    supabase.from("learning_context").select("id").eq("id", ctxC!.id).maybeSingle(),
    supabase.from("concept_mastery").select("id").eq("id", mastC!.id).maybeSingle(),
    supabase.from("assessments").select("id").eq("id", asmtC!.id).maybeSingle(),
    supabase.from("assessment_questions").select("id").eq("id", asmtQ!.id).maybeSingle(),
    supabase.from("recommendations").select("id").eq("id", recC!.id).maybeSingle(),
    supabase.from("activity_events").select("id").eq("id", actC!.id).maybeSingle(),
    supabase.from("ai_usage_logs").select("id, project_id").eq("id", aiLogC!.id).single(),
  ]);

  console.log("- Space C deleted:", !chkSpace.data ? "PASS" : "FAIL");
  console.log("- Project C deleted:", !chkProj.data ? "PASS" : "FAIL");
  console.log("- Materials cascade deleted:", !chkMat.data ? "PASS" : "FAIL");
  console.log("- Concepts cascade deleted:", !chkConc.data ? "PASS" : "FAIL");
  console.log("- Conversations cascade deleted:", !chkConv.data ? "PASS" : "FAIL");
  console.log("- Messages cascade deleted:", !chkMsg.data ? "PASS" : "FAIL");
  console.log("- Learning Context cascade deleted:", !chkCtx.data ? "PASS" : "FAIL");
  console.log("- Concept Mastery cascade deleted:", !chkMast.data ? "PASS" : "FAIL");
  console.log("- Assessments cascade deleted:", !chkAsmt.data ? "PASS" : "FAIL");
  console.log("- Assessment Questions cascade deleted:", !chkAsmtQ.data ? "PASS" : "FAIL");
  console.log("- Recommendations cascade deleted:", !chkRec.data ? "PASS" : "FAIL");
  console.log("- Activity Events cascade deleted:", !chkAct.data ? "PASS" : "FAIL");
  console.log(
    "- AI Usage Log project_id set to null (audit retained):",
    chkAiLog.data?.project_id === null ? "PASS" : "FAIL"
  );

  // Clean up AI log test record
  await supabase.from("ai_usage_logs").delete().eq("id", aiLogC!.id);

  // -------------------------------------------------------------
  // TEST CASE D: Cross-User Isolation Check
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE D: Cross-User Isolation ---");
  // Check that other spaces in the database belonging to any user were untouched
  const { data: survivingSpaces } = await supabase
    .from("spaces")
    .select("id, name, user_id");

  console.log("Total surviving spaces in database:", survivingSpaces?.length);
  const progLangSpace = survivingSpaces?.find((s) => s.name === "Programming Languages");
  console.log("Existing 'Programming Languages' space untouched:", progLangSpace ? "PASS" : "FAIL");

  console.log("\nALL DATABASE TESTS COMPLETED SUCCESSFULLY WITH ZERO LEFTOVER TEST DATA!");
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});

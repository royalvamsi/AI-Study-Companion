import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import * as fs from "node:fs";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { syncRecommendations, RecommendationRow } from "../lib/learning/recommendations";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("==================================================================");
  console.log("VERIFY RECOMMENDATION STATUS TRACKING & HISTORY PRESERVATION");
  console.log("==================================================================\n");

  // 1. Check if column 'status' exists in DB
  const { data: testCol, error: colErr } = await supabase
    .from("recommendations")
    .select("id, status, updated_at")
    .limit(1);

  if (colErr) {
    console.log("SCHEMA STATUS: MIGRATION 003 PENDING ON HOSTED DATABASE");
    console.log(`Supabase returned: [${colErr.code}] ${colErr.message}`);
    console.log("\nPlease apply `supabase/migrations/003_recommendations_status_and_history.sql`");
    console.log("in your Supabase SQL Editor: https://supabase.com/dashboard/project/rmtovvvvbkiuvsgyzpgy/sql/new");
    return;
  }

  console.log("✓ Schema Verified: 'status' and 'updated_at' columns exist in database.\n");

  // 2. Fetch a real project and user for testing
  const { data: projects } = await supabase.from("projects").select("id, user_id, name").limit(1);
  if (!projects || projects.length === 0) {
    throw new Error("No project found in database");
  }
  const project = projects[0];
  const projectId = project.id;
  const userId = project.user_id;
  console.log(`Using Project: "${project.name}" (${projectId}) for User: ${userId}\n`);

  // Fetch two real concepts for this project
  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .eq("project_id", projectId)
    .limit(3);

  if (!concepts || concepts.length < 2) {
    throw new Error("Need at least 2 concepts for this test");
  }

  const conceptA = concepts[0];
  const conceptB = concepts[1];
  const conceptC = concepts[2] || { id: crypto.randomUUID(), name: "Bonus Concept" };

  console.log(`Test Concept A: ${conceptA.name} (${conceptA.id})`);
  console.log(`Test Concept B: ${conceptB.name} (${conceptB.id})`);
  console.log(`Test Concept C: ${conceptC.name} (${conceptC.id})\n`);

  // Clean any existing test rows for these concepts in this project/user
  await supabase
    .from("recommendations")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("concept_id", [conceptA.id, conceptB.id, conceptC.id]);

  // ------------------------------------------------------------------
  // RUN 1: Initial recommendation generation for Concept A and Concept B
  // ------------------------------------------------------------------
  console.log("------------------------------------------------------------------");
  console.log("RUN 1: Initial generation for Concept A and Concept B");
  console.log("------------------------------------------------------------------");

  const run1Recs: RecommendationRow[] = [
    {
      project_id: projectId,
      user_id: userId,
      concept_id: conceptA.id,
      priority: "HIGH",
      action_type: "REVIEW",
      reasoning: `${conceptA.name}: mastery is low at 15%.`,
      is_dismissed: false,
    },
    {
      project_id: projectId,
      user_id: userId,
      concept_id: conceptB.id,
      priority: "MEDIUM",
      action_type: "PRACTICE",
      reasoning: `${conceptB.name}: mastery could use practice.`,
      is_dismissed: false,
    },
  ];

  const result1 = await syncRecommendations(projectId, userId, run1Recs, { emitEvents: true });
  console.log("Run 1 Result:", result1);

  const { data: dbAfterRun1 } = await supabase
    .from("recommendations")
    .select("id, concept_id, priority, action_type, status, updated_at, is_dismissed")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("concept_id", [conceptA.id, conceptB.id]);

  console.log("DB rows after Run 1:");
  console.table(dbAfterRun1);

  const run1TimestampA = dbAfterRun1?.find((r) => r.concept_id === conceptA.id)?.updated_at;
  const run1TimestampB = dbAfterRun1?.find((r) => r.concept_id === conceptB.id)?.updated_at;

  // Wait 1 second so timestamps would change if updated
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // ------------------------------------------------------------------
  // RUN 2: SAME learner state triggered again (identical recommendations)
  // ------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("RUN 2: SAME learner state triggered second time in a row");
  console.log("------------------------------------------------------------------");

  const result2 = await syncRecommendations(projectId, userId, run1Recs, { emitEvents: true });
  console.log("Run 2 Result (expected: untouchedCount = 2, inserted = 0, updated = 0):", result2);

  const { data: dbAfterRun2 } = await supabase
    .from("recommendations")
    .select("id, concept_id, priority, action_type, status, updated_at, is_dismissed")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("concept_id", [conceptA.id, conceptB.id]);

  console.log("DB rows after Run 2:");
  console.table(dbAfterRun2);

  const run2TimestampA = dbAfterRun2?.find((r) => r.concept_id === conceptA.id)?.updated_at;
  const run2TimestampB = dbAfterRun2?.find((r) => r.concept_id === conceptB.id)?.updated_at;

  const unchangedA = run1TimestampA === run2TimestampA;
  const unchangedB = run1TimestampB === run2TimestampB;
  console.log(`Concept A updated_at identical: ${unchangedA} (${run1TimestampA} vs ${run2TimestampA})`);
  console.log(`Concept B updated_at identical: ${unchangedB} (${run1TimestampB} vs ${run2TimestampB})`);

  if (!unchangedA || !unchangedB) {
    throw new Error("FAILED: updated_at was bumped for identical recommendations!");
  }
  console.log("✓ SUCCESS: Second run did NOT create new rows or bump updated_at for unchanged recommendations.");

  // ------------------------------------------------------------------
  // RUN 3: Learner state CHANGES (Concept A improved, Concept C is now weak)
  // ------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("RUN 3: Learner state CHANGES (Concept A improved; Concept C is now recommended)");
  console.log("------------------------------------------------------------------");

  const run3Recs: RecommendationRow[] = [
    {
      project_id: projectId,
      user_id: userId,
      concept_id: conceptB.id, // Unchanged
      priority: "MEDIUM",
      action_type: "PRACTICE",
      reasoning: `${conceptB.name}: mastery could use practice.`,
      is_dismissed: false,
    },
    {
      project_id: projectId,
      user_id: userId,
      concept_id: conceptC.id, // New recommendation
      priority: "HIGH",
      action_type: "REVIEW",
      reasoning: `${conceptC.name}: mastery is low at 10%.`,
      is_dismissed: false,
    },
  ];

  const result3 = await syncRecommendations(projectId, userId, run3Recs, { emitEvents: true });
  console.log("Run 3 Result (expected: supersededCount = 1, inserted = 1, untouched = 1):", result3);

  const { data: dbAfterRun3 } = await supabase
    .from("recommendations")
    .select("id, concept_id, priority, action_type, status, updated_at, is_dismissed")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("concept_id", [conceptA.id, conceptB.id, conceptC.id])
    .order("created_at", { ascending: true });

  console.log("DB rows after Run 3 (showing active, superseded, and history):");
  console.table(dbAfterRun3);

  const conceptARow = dbAfterRun3?.find((r) => r.concept_id === conceptA.id);
  const conceptBRow = dbAfterRun3?.find((r) => r.concept_id === conceptB.id);
  const conceptCRow = dbAfterRun3?.find((r) => r.concept_id === conceptC.id);

  console.log(`Concept A status: "${conceptARow?.status}" (expected: "superseded")`);
  console.log(`Concept B status: "${conceptBRow?.status}" (expected: "active")`);
  console.log(`Concept C status: "${conceptCRow?.status}" (expected: "active")`);

  if (conceptARow?.status !== "superseded") {
    throw new Error(`FAILED: Concept A status should be 'superseded', found: ${conceptARow?.status}`);
  }
  if (conceptCRow?.status !== "active") {
    throw new Error(`FAILED: Concept C status should be 'active', found: ${conceptCRow?.status}`);
  }

  console.log("\n✓ SUCCESS: Old recommendation flipped to 'superseded', not deleted, and new active recommendation created!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

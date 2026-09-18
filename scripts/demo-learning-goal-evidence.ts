import * as fs from "node:fs";
import * as dotenv from "dotenv";
import { getPersistentLearningContext } from "../lib/learning/learning-context";
import { buildTutorSystemPrompt } from "../lib/rag/retrieve";
import { createClient } from "@supabase/supabase-js";

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
Object.assign(process.env, envConfig);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. Fetch real project from database
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, learning_goal, user_id")
    .limit(2);

  if (error || !projects || projects.length === 0) {
    throw new Error("Could not fetch projects: " + error?.message);
  }

  const projWithGoal = projects.find((p: any) => p.learning_goal) || projects[0];

  // Case A: Real project with learning_goal set
  const contextA = await getPersistentLearningContext(projWithGoal.user_id, projWithGoal.id);

  console.log("=== EVIDENCE 1: formattedContext WITH learning_goal ===");
  console.log(contextA.formattedContext);

  // Case B: Real project with learning_goal = null
  // Let's create a temporary project without learning_goal
  const { data: tempProj, error: tempErr } = await supabase
    .from("projects")
    .insert({
      name: "Temporary Verification Project (No Goal)",
      learning_goal: null,
      user_id: projWithGoal.user_id,
      space_id: "0baee59a-62ac-43ad-86e1-23396d8019bb",
    })
    .select()
    .single();

  if (tempErr) throw tempErr;

  try {
    const contextB = await getPersistentLearningContext(tempProj.user_id, tempProj.id);
    console.log("\n=== EVIDENCE 2: formattedContext WITHOUT learning_goal (null) ===");
    console.log(contextB.formattedContext);
  } finally {
    await supabase.from("projects").delete().eq("id", tempProj.id);
  }

  // Case C: Assembled STUDENT LEARNING CONTEXT in Tutor System Prompt
  const promptA = buildTutorSystemPrompt({
    retrievedChunks: [
      {
        id: "chunk-1",
        materialId: "mat-1",
        content: "Supervised learning involves algorithms that learn from labeled datasets to predict outcomes.",
        pageNumber: 1,
        similarity: 0.91,
      },
    ],
    evidenceState: "SUPPORTED",
    masteryContext: contextA.formattedContext,
  });

  console.log("\n=== EVIDENCE 3: Assembled STUDENT LEARNING CONTEXT in Tutor System Prompt ===");
  const startIdx = promptA.indexOf("STUDENT LEARNING CONTEXT:");
  const endIdx = promptA.indexOf("STUDY MATERIAL CONTEXT:");
  console.log(promptA.slice(startIdx, endIdx).trim());
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});

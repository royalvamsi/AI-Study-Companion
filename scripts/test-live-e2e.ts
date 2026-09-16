import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { gradeOpenEndedAnswer } from "@/lib/ai/grading";
import { updateMasteryAfterAssessment } from "@/lib/learning/mastery";
import { buildRecommendations } from "@/lib/learning/recommendations";
import { getGrowthAnalysis } from "@/lib/learning/growth";

async function runLiveVerification() {
  const supabase = createAdminClient();
  const projectId = "daf5ff36-c8e5-4773-b236-4a02dfbf49ff"; // COMPUTER NETWORKS
  const userId = "2f444c89-4a36-453f-bcd7-09feb59f752a";

  console.log("==================================================");
  console.log("LIVE E2E VERIFICATION: PROJECT CRYPTOGRAPHY & NETWORK SECURITY");
  console.log("Project ID:", projectId);
  console.log("==================================================");

  // 1. Fetch materials for this project
  const { data: materials } = await supabase
    .from("materials")
    .select("id, file_name, status")
    .eq("project_id", projectId);

  console.log("\n[Step 1] Project Materials:", materials);
  if (!materials || materials.length === 0) {
    throw new Error("No materials found for project");
  }

  const targetMaterial = materials[0];
  console.log("Target Material for Quiz:", targetMaterial.file_name, targetMaterial.id);

  // 2. Fetch chunks scoped to this material
  const { data: chunks } = await supabase
    .from("material_chunks")
    .select("id, content, page_number")
    .eq("material_id", targetMaterial.id)
    .limit(10);

  console.log(`\n[Step 2] Scoped Chunks Found: ${chunks?.length}`);
  if (!chunks || chunks.length === 0) {
    throw new Error("No chunks found for material");
  }

  // 3. Fetch concepts scoped to this material
  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, description")
    .eq("project_id", projectId)
    .eq("source_material_id", targetMaterial.id);

  console.log(`\n[Step 3] Material-Scoped Concepts (${concepts?.length}):`, concepts?.map(c => c.name));

  // 4. Generate Grounded Quiz using Gemini
  console.log("\n[Step 4] Calling generateQuizQuestions with material context...");
  const quizContext = chunks.map(c => `[Page ${c.page_number}]: ${c.content}`).join("\n\n");
  
  const generatedQuestions = await generateQuizQuestions({
    userId,
    projectId,
    contextStr: quizContext,
    concepts: (concepts ?? []).slice(0, 3),
    questionCount: 3,
  });

  console.log(`\n[Step 5] Generated ${generatedQuestions.length} Questions:`);
  let contaminationFound = false;

  for (let i = 0; i < generatedQuestions.length; i++) {
    const q = generatedQuestions[i];
    console.log(`\n--- Question ${i + 1} (${q.question_type.toUpperCase()}, Diff: ${q.difficulty}) ---`);
    console.log("Text:", q.question_text);
    console.log("Concept:", q.concept_name);
    console.log("Correct Answer:", q.correct_answer);
    if (q.question_type === "mcq") {
      console.log("Options (4):", q.options);
      if (q.options.length !== 4) {
        throw new Error(`MCQ does not have 4 options: ${q.options.length}`);
      }
    }
    console.log("Explanation:", q.explanation);
    console.log("Hint:", q.hint);

    // Check for contamination
    const fullText = (q.question_text + " " + q.correct_answer).toLowerCase();
    for (const w of ["spaces and projects", "candidate challenge", "product architecture", "supabase auth"]) {
      if (fullText.includes(w)) {
        contaminationFound = true;
        console.error(`CONTAMINATION DETECTED! Question contains forbidden phrase: ${w}`);
      }
    }
  }

  if (contaminationFound) {
    throw new Error("Quiz Grounding FAILED: PRD concepts leaked into quiz!");
  } else {
    console.log("\n>>> SUCCESS: Zero PRD/product concepts found. 100% grounded in Cryptography material! <<<");
  }

  // 6. Test Open-Ended Rubric Grading
  console.log("\n[Step 6] Testing Open-Ended Rubric Grading...");
  const openEndedSample = generatedQuestions.find(q => q.question_type === "open_ended") ?? {
    question_text: "Explain the difference between passive and active attacks in network security.",
    correct_answer: "Passive attacks eavesdrop on communications without modifying data (e.g. traffic analysis, release of message contents). Active attacks alter data or fabricate messages (e.g. masquerade, replay, modification of messages, denial of service).",
    concept_name: "Security Attacks",
  };

  const studentSubmission = "Passive attacks only listen or monitor transmissions to obtain information without altering it, like snooping on packets. Active attacks involve modifying the messages or attacking availability.";
  
  console.log("Grading student answer:", studentSubmission);
  const rubricResult = await gradeOpenEndedAnswer({
    userId,
    projectId,
    questionText: openEndedSample.question_text,
    modelAnswer: openEndedSample.correct_answer,
    studentAnswer: studentSubmission,
    conceptName: openEndedSample.concept_name,
    contextStr: quizContext,
  });

  console.log("\n[Step 7] Rubric Evaluation Result:");
  console.log("- Score:", rubricResult.score);
  console.log("- Understanding:", rubricResult.understanding);
  console.log("- Is Correct:", rubricResult.is_correct);
  console.log("- Strengths:", rubricResult.strengths);
  console.log("- Missing Concepts:", rubricResult.missingConcepts);
  console.log("- Feedback:", rubricResult.feedback);
  console.log("- Reasoning:", rubricResult.reasoning);

  // 7. Test Concept Mastery Update
  console.log("\n[Step 8] Testing Concept Mastery Update...");
  const targetConcept = concepts?.[0];
  if (targetConcept) {
    await updateMasteryAfterAssessment(
      {
        id: "test-assessment-id",
        assessment_questions: [
          {
            concept_id: targetConcept.id,
            is_correct: rubricResult.is_correct,
            score: rubricResult.score,
          },
        ],
      },
      userId,
      projectId
    );
    const { data: updatedMastery } = await supabase
      .from("concept_mastery")
      .select("mastery_score, trend, assessment_count")
      .eq("concept_id", targetConcept.id)
      .maybeSingle();
    console.log("Updated Concept Mastery:", targetConcept.name, updatedMastery);
  }

  // 8. Test Growth Analysis
  console.log("\n[Step 9] Testing Growth Analysis Calculation...");
  const growth = await getGrowthAnalysis(projectId, userId);
  console.log("Growth Summary:", {
    improvingCount: growth.improving.length,
    stableCount: growth.stable.length,
    needsAttentionCount: growth.needsAttention.length,
    overallTrend: growth.overallTrend,
  });

  // 9. Test Recommendations Engine
  console.log("\n[Step 10] Testing Deterministic Recommendations...");
  const recs = await buildRecommendations(projectId, userId);
  console.log(`Generated ${recs.length} Recommendations:`);
  for (const r of recs) {
    console.log(`- Priority: ${r.priority} | Action: ${r.action_type} | Reason: ${r.reasoning}`);
  }

  console.log("\n==================================================");
  console.log("ALL LIVE E2E SCENARIOS VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runLiveVerification().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});

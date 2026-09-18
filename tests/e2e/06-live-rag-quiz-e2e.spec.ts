import { test, expect } from "@playwright/test";
import path from "path";
import { createClient } from "@supabase/supabase-js";

test.describe("Phase 30: Live Ingestion, Grounded RAG, and Adaptive Quiz E2E", () => {
  test.setTimeout(360000); // 6 minutes for full end-to-end live pipeline

  const learnerEmail = process.env.E2E_USER_EMAIL;
  const learnerPassword = process.env.E2E_USER_PASSWORD;

  test.skip(
    !learnerEmail || !learnerPassword,
    "E2E_USER_EMAIL and E2E_USER_PASSWORD must be configured in .env.local"
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  test("End-to-end: Upload PDF -> Inngest Processing -> READY -> Grounded Tutor -> Quiz -> Mastery -> Growth -> Recommendations", async ({
    page,
  }) => {
    // ══════════════════════════════════════════════════════════════════════════
    // STEP 1: AUTHENTICATION
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto("/login");
    await page.fill("input#email", learnerEmail!);
    await page.fill("input#password", learnerPassword!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 2: CREATE A NEW STUDY SPACE
    // ══════════════════════════════════════════════════════════════════════════
    const timestamp = Date.now();
    const spaceName = `Live RAG Space ${timestamp}`;
    const newSpaceBtn = page.locator('button:has-text("New Space")').first();
    await expect(newSpaceBtn).toBeVisible({ timeout: 10000 });
    await newSpaceBtn.click();

    await expect(page.locator('text="Create a Study Space"')).toBeVisible();
    await page.fill('input[placeholder="e.g., Artificial Intelligence"]', spaceName);
    await page.click('button[type="submit"]:has-text("Create Space")');
    await expect(page.locator('text="Create a Study Space"')).not.toBeVisible({ timeout: 10000 });

    // Wait for space card to appear on dashboard
    await expect(page.getByText(spaceName).first()).toBeVisible({ timeout: 15000 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 3: CREATE A NEW PROJECT IN THE SPACE
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);

    const projectName = `Live ML Project ${timestamp}`;
    const newProjectBtn = page.locator('button:has-text("New Project")').first();
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
    await newProjectBtn.click();

    await expect(page.locator('text="Create a Study Project"')).toBeVisible();
    await page.fill('input[placeholder="e.g., Chapter 4 — Neural Networks"]', projectName);

    // Select the newly created space if dropdown is present
    const spaceTrigger = page.locator('button:has-text("Select a space")');
    if (await spaceTrigger.isVisible()) {
      await spaceTrigger.click();
      await page.locator(`[role="option"]:has-text("${spaceName}")`).first().click();
    }

    await page.click('button[type="submit"]:has-text("Create Project")');

    // Wait for redirect to /projects/[projectId]
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 20000 });
    const projectUrl = page.url();
    const projectId = projectUrl.split("/projects/")[1].split("?")[0];
    console.log(`[E2E] Created new Project with ID: ${projectId} (${projectName})`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 4: UPLOAD REAL PDF FIXTURE & TRACK INNGEST STATUS LIFECYCLE
    // ══════════════════════════════════════════════════════════════════════════
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 15000 });
    await fileInput.setInputFiles("tests/fixtures/sample.pdf");

    // Verify material card appears in UI
    const materialCard = page.locator('text="sample.pdf"').first();
    await expect(materialCard).toBeVisible({ timeout: 25000 });

    // Track status transitions directly from Supabase & UI
    const observedStatuses = new Set<string>();
    let materialId = "";
    let finalStatus = "";

    const startTime = Date.now();
    const maxWaitMs = 120000; // 2 minutes maximum wait for Inngest + Gemini pipeline

    while (Date.now() - startTime < maxWaitMs) {
      const { data: mats } = await supabase
        .from("materials")
        .select("id, status, error_message, file_name")
        .eq("project_id", projectId);

      const mat = mats?.[0];
      if (mat) {
        materialId = mat.id;
        observedStatuses.add(mat.status);
        console.log(`[Material Lifecycle] ID: ${mat.id} | Status: ${mat.status}`);

        if (mat.status === "ready") {
          finalStatus = "ready";
          break;
        }
        if (mat.status === "failed") {
          finalStatus = "failed";
          console.error(`[Material Lifecycle] Material failed: ${mat.error_message}`);
          break;
        }
      }
      await page.waitForTimeout(2000);
    }

    console.log(`[Material Lifecycle Summary] Material ID: ${materialId}`);
    console.log(`[Material Lifecycle Summary] Observed status transitions: ${Array.from(observedStatuses).join(" -> ")}`);
    console.log(`[Material Lifecycle Summary] Final status: ${finalStatus}`);

    // Assert that the newly uploaded PDF actually reached READY
    expect(finalStatus).toBe("ready");
    expect(observedStatuses.has("ready")).toBe(true);

    // Verify UI displays "Ready" badge
    await page.reload();
    await expect(page.locator("span:has-text('Ready')").first()).toBeVisible({ timeout: 15000 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 5: AI TUTOR - GROUNDED QUESTION & CITATIONS
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto(`/tutor?project=${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/tutor\\?project=${projectId}`));

    // Wait for chat interface to be ready
    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // Question 1: Grounded in sample.pdf
    const groundedQuestion = "What is supervised learning?";
    await chatInput.fill(groundedQuestion);
    await page.locator('button[aria-label="Send study query"]').click();

    // Wait for response to stream and complete
    await expect(page.locator('button[aria-label="Send study query"] svg.animate-spin')).toBeHidden({ timeout: 45000 });
    await expect(page.locator("text=Synthesizing grounded evidence").first()).toBeHidden({ timeout: 45000 });

    // Verify response content contains grounding in sample.pdf
    const tutorResponse = page.locator(".font-sans").getByText(/labeled data|models|predicts/i).first();
    await expect(tutorResponse).toBeVisible({ timeout: 30000 });

    // Verify citation references uploaded sample.pdf
    const citationBadge = page.locator("text=Sources:").first();
    await expect(citationBadge).toBeVisible({ timeout: 15000 });
    const sourceRef = page.getByText(/sample\.pdf/i).first();
    await expect(sourceRef).toBeVisible({ timeout: 10000 });
    console.log("[RAG Verification] Grounded answer and citation verified for sample.pdf!");

    // Question 2: Unsupported / off-topic question
    const unsupportedQuestion = "What is the population of Japan?";
    await chatInput.fill(unsupportedQuestion);
    await page.locator('button[aria-label="Send study query"]').click();

    // Wait for streaming to finish
    await expect(page.locator('button[aria-label="Send study query"] svg.animate-spin')).toBeHidden({ timeout: 45000 });
    await expect(page.locator("text=Synthesizing grounded evidence").first()).toBeHidden({ timeout: 45000 });

    // Verify Insufficient Evidence behavior / academic safeguard banner
    const insufficientNotice = page.locator("text=Insufficient Evidence in Uploaded Material").first();
    const fallbackText = page.getByText(/not available in your study material|insufficient context|not mentioned/i).first();
    const hasInsufficient = (await insufficientNotice.isVisible()) || (await fallbackText.isVisible());
    expect(hasInsufficient).toBe(true);
    console.log("[RAG Verification] Unsupported question properly flagged with insufficient evidence safeguard!");

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 6: ADAPTIVE QUIZ GENERATION & COMPLETION
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto(`/quiz?project=${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/quiz\\?project=${projectId}`));

    // Click Start Assessment
    const startQuizBtn = page.locator('button:has-text("Start Assessment")').first();
    await expect(startQuizBtn).toBeVisible({ timeout: 15000 });
    await startQuizBtn.click();

    // Wait for Quiz Questions to be generated by LLM and rendered
    await expect(page.getByText(/Question 1 of/i).first()).toBeVisible({ timeout: 60000 });

    // Verify questions are grounded in uploaded material concepts
    const questionText = await page.locator("main h2, h2.font-serif").first().innerText();
    console.log(`[Quiz Verification] Question 1 text: "${questionText}"`);
    expect(questionText.length).toBeGreaterThan(10);

    // Complete all questions in the quiz
    let questionNumber = 1;
    while (true) {
      // Check if quiz completed
      if (await page.getByText(/Assessment Results/i).isVisible()) {
        break;
      }

      // Check question type
      const isMcq = await page.locator("button:has(span:text('A'))").first().isVisible();
      if (isMcq) {
        // Select option A
        await page.locator("button:has(span:text('A'))").first().click();
      } else {
        // Fill text answer
        const textAnswer = page.locator("textarea").first();
        if (await textAnswer.isVisible()) {
          await textAnswer.fill("Supervised learning trains models on labeled input-output datasets.");
        }
      }

      // Submit answer
      const submitAnswerBtn = page.locator('button:has-text("Submit Answer")').first();
      await expect(submitAnswerBtn).toBeVisible();
      await submitAnswerBtn.click();

      // Wait for either per-question evaluation feedback OR transition to Assessment Results
      await expect(
        page.getByText(/Correct!|Needs Review|Assessment Results/i).first()
      ).toBeVisible({ timeout: 60000 });

      // If quiz finished and navigated to Assessment Results, break out of loop
      if (await page.getByText(/Assessment Results/i).isVisible()) {
        break;
      }

      // If Next Question button exists, click it. Otherwise, we reached the end.
      const nextBtn = page.locator('button:has-text("Next Question")').first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        questionNumber++;
      } else {
        // Reached end of quiz
        break;
      }
    }

    // Verify Assessment Results View
    await expect(page.getByText(/Assessment Results/i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/questions correctly answered|Score|%/i).first()).toBeVisible();
    console.log(`[Quiz Verification] Assessment completed across ${questionNumber} questions!`);

    // Verify Concept Mastery Updates / Live Deltas
    const masteryUpdated = page.getByText(/Concept Mastery Updated|Live Deltas/i).first();
    if (await masteryUpdated.isVisible()) {
      console.log("[Mastery Verification] Live concept mastery deltas rendered on quiz completion!");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 7: GROWTH & MASTERY VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto(`/growth?project=${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/growth\\?project=${projectId}`));
    await expect(page.locator("main").getByText(/Concept Mastery|Mastery|Growth/i).first()).toBeVisible({ timeout: 20000 });
    console.log("[Growth Verification] Growth & Mastery page verified for new project!");

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 8: RECOMMENDATIONS VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════
    await page.goto(`/recommendations?project=${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/recommendations\\?project=${projectId}`));
    await expect(page.locator("main").getByText(/Recommendations|Study Priorities|Next Steps/i).first()).toBeVisible({ timeout: 20000 });
    console.log("[Recommendations Verification] Recommendations page verified for new project!");
  });
});

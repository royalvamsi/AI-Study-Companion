import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processMaterial } from "@/inngest/material-processing";
import { onQuizCompleted } from "@/inngest/quiz-completed";
import { generateRecommendations } from "@/inngest/recommendation";
import { onRepeatedMistake } from "@/inngest/repeated-mistake";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processMaterial,
    onQuizCompleted,
    generateRecommendations,
    onRepeatedMistake,
  ],
});

import { Inngest } from "inngest";

// ── Event type definitions ────────────────────────────────────────────────────
export type Events = {
  "material/uploaded": {
    data: {
      materialId: string;
      projectId: string;
      userId: string;
      filePath: string;
      fileName: string;
    };
  };
  "quiz/completed": {
    data: {
      assessmentId: string;
      projectId: string;
      userId: string;
    };
  };
  "learning/recommendation-requested": {
    data: {
      projectId: string;
      userId: string;
      trigger: "quiz_completed" | "mastery_updated" | "manual";
    };
  };
  "learning/repeated-mistake": {
    data: {
      projectId: string;
      userId: string;
      conceptId: string;
      mistakeCount: number;
    };
  };
};

// Keep this type alias for external imports
export type InngestEvents = Events;

const hasRealEventKey =
  Boolean(process.env.INNGEST_EVENT_KEY) &&
  !process.env.INNGEST_EVENT_KEY?.includes("your-inngest");

const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.INNGEST_DEV === "true" ||
  !hasRealEventKey;

// Typed Inngest instance — events flow through all createFunction calls
export const inngest = new Inngest({
  id: "ai-study-companion",
  isDev,
  ...(hasRealEventKey ? { eventKey: process.env.INNGEST_EVENT_KEY } : {}),
});


# AI Study Companion

> **An intelligent, production-grade AI learning partner that transforms course materials into an active, adaptive, and evidence-grounded study loop.**  
> Built for the **AI.Prof Full Stack AI Engineer Candidate Challenge** based on **Project Requirements / PRD v3.0**.

# AI Study Companion

> An intelligent, production-grade AI learning partner...

🔗 **Live Demo:** https://ai-study-companion-khaki.vercel.app

## 🎯 Executive Summary & Problem Statement

Most traditional study tools are passive: students upload lecture slides and either receive shallow flashcards or chat with ungrounded generic LLMs that hallucinate facts.

**AI Study Companion** replaces disconnected CRUD workflows with an integrated, cohesive learning partner. It enforces strict grounding to course materials, adapts question difficulty dynamically across multiple learner signals, evaluates open-ended explanations using structured rubrics, updates concept mastery deterministically, and provides actionable recommendations to close understanding gaps.

---

## 🔄 The Closed Learning Loop

```
Upload Material (PDF)
         ↓
Asynchronous Processing (Text Extraction → Chunking → 1536-dim Embeddings → Concept Extraction)
         ↓
AI Tutor (Broad Overview or Specific RAG Retrieval with Page Citations & Insufficient Evidence Guard)
         ↓
Adaptive Quiz (Deterministic Multi-Signal Concept Selection → Grounded MCQ & Open-Ended Questions)
         ↓
Rubric Evaluation (Accuracy, Conceptual Depth, Identified Strengths, Missing Concepts, Feedback)
         ↓
Concept Mastery Engine (Transparent Weighted Scoring: 0.6 * Previous + 0.4 * Recent)
         ↓
Growth Analysis (Improving / Stable / Needs Attention Concept Classifications)
         ↓
Deterministic Recommendations (Review Weak Concepts & Targeted Next Steps)
```

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (Next.js 16)                            │
│  React 19 · Tailwind CSS · shadcn/ui · TanStack Query · Recharts Analytics  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    NEXT.JS ROUTE HANDLERS & MIDDLEWARE                      │
│   Auth Verification · Role Guard · Zod Validation · Task-Aware Router       │
└───────┬──────────────────────────────┬───────────────────────────────┬──────┘
        │                              │                               │
┌───────▼──────────────┐    ┌──────────▼──────────┐         ┌──────────▼──────┐
│    SUPABASE DB       │    │     GOOGLE GEMINI   │         │     INNGEST     │
│ PostgreSQL + pgvector│    │  gemini-3.5-flash   │         │ Background Jobs │
│  Row-Level Security  │    │ gemini-3.5-flash-lt │         │  PDF Extraction │
│  User/Project RLS    │    │ gemini-embed-001    │         │ Concept Mapping │
└──────────────────────┘    └─────────────────────┘         └─────────────────┘
```

---

## 🧠 AI Layer Architecture & Working Model Configuration

The application is powered exclusively by **Google Gemini** through a resilient provider abstraction (`lib/ai/provider.ts` and `lib/ai/gemini.ts`):

| Role / Feature | Configured Model | Runtime Fallback | Purpose & Behavior |
| :--- | :--- | :--- | :--- |
| **AI Tutor (Streaming)** | `gemini-3.5-flash` | `gemini-3.5-flash-lite` | Live token streaming, grounded reasoning, citation formatting. |
| **Assessment & Grading** | `gemini-3.5-flash` | `gemini-3.5-flash-lite` | Nuanced open-ended rubric grading and conceptual depth scoring. |
| **Adaptive Quiz Generation** | `gemini-3.5-flash` | `gemini-3.5-flash-lite` | Strictly grounded 4-option MCQs and open-ended questions. |
| **Concept Extraction** | `gemini-3.5-flash-lite` | `gemini-3.5-flash` | High-throughput extraction of core topics from parsed PDFs. |
| **Vector Embeddings** | `gemini-embedding-001` | — | 1536-dimensional semantic embeddings (`outputDimensionality: 1536`). |

### Key Resilience Engineering Features:
- **Automatic Exponential Backoff & Jitter**: Handles transient 429 (rate-limit) and 503 (high-demand) errors seamlessly.
- **Dynamic Model Fallback**: If `gemini-3.5-flash` experiences temporary unavailability, the system automatically falls back to `gemini-3.5-flash-lite` without failing the user's request.
- **Strict Vector Dimensionality**: Uses `gemini-embedding-001` configured to 1536 dimensions matching Supabase `vector(1536)`.

---

## 🛡️ Quiz Grounding & Anti-Leakage (Root Cause & Solution)

### The Contamination Root Cause
In early iterations, when specification files (like `Project_Requirements.pdf`) were uploaded during testing, generic concept fetching queries without material scoping pulled product architecture concepts (such as *"Spaces and Projects"* or *"User isolation"*) into the quiz generation pool. Furthermore, generic fallback prompts instructed the LLM to use "general knowledge".

### The Fix
1. **Material-Scoped Concept Association**: Quizzes are strictly scoped to the selected learning material (`materials.id`) and its associated concepts (`source_material_id`).
2. **Chunk Scoping**: Retrieval queries fetch only chunks originating from the target material's `material_chunks` records.
3. **Product Meta-Concept Exclusion**: An automated filtering gate (`FORBIDDEN_META_KEYWORDS`) discards any product architecture concepts before prompting the LLM.
4. **Strict Grounding Guard**: System instructions explicitly prohibit the use of external world knowledge. Questions must cite source pages and excerpts from the document.

---

## 📈 Adaptive Engine & Mastery Model

### Multi-Signal Adaptive Selection (`lib/learning/adaptive-selection.ts`)
Rather than a simplistic binary rule, concept selection is deterministic and explainable:

$$\text{Priority Score} = \text{Weakness Weight } (0\text{--}50) + \text{Mistake Weight } (0\text{--}30) + \text{Staleness Weight } (0\text{--}20) + \text{Trend Bonus } (15)$$

- **Weakness**: Concepts with low mastery scores receive higher priority.
- **Mistakes**: Concepts with recorded error history receive urgent review weight.
- **Staleness**: Concepts unassessed for $> 3$ days gain review priority.
- **Target Difficulty**: Dynamically scaled from 1 (foundational) to 5 (synthesis/edge cases) based on learner performance.

### Mastery Calculation (`lib/learning/mastery.ts`)
$$\text{New Mastery} = (\text{Previous Score} \times 0.6) + (\text{Recent Performance} \times 0.4)$$

Updates are persisted to `concept_mastery` and feed directly into the **Growth** and **Recommendations** engines.

---

## 🔍 Grounded RAG & Insufficient Evidence Guard

1. **Dual Query Routing**:
   - **Document Queries** (*"What are the topics in this PDF?"*): Retrieves structural overview chunks across the document to formulate an accurate summary.
   - **Semantic Queries**: Embeds query into 1536 dimensions and performs cosine similarity search in `material_chunks`.
2. **Deterministic Insufficient Evidence Guard**:
   - If retrieved similarity falls below threshold, the tutor strictly returns an `INSUFFICIENT_EVIDENCE` state.
   - **Zero World-Knowledge Hallucination**: Answering off-topic questions (e.g., *"How do I cook chicken biryani?"*) is explicitly refused with 0 source citations and no recipe text.

---

## 📊 Telemetry & Admin Dashboard

The `/admin` route provides authorized administrators with real-time operational telemetry:
- **AI Model Consumption**: Latency (ms), input/output tokens, and estimated USD costs per feature call.
- **Ingestion Pipeline Status**: Active, ready, and failed PDF processing jobs.
- **Audit Logs**: Real-time stream of user registrations, quiz completions, and material uploads.
- **Security Guard**: Server-side authorized check via `profiles.is_admin` with security-definer pattern.

---

## 📋 PRD v3.0 Requirements Coverage Matrix

| PRD Requirement | Specification Level | Implementation File / Module | Status | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & RLS** | MUST HAVE | `lib/supabase/`, RLS migrations | ✅ Verified | Tested cross-user isolation |
| **PDF Ingestion & Processing** | MUST HAVE | `inngest/functions/`, `lib/documents/` | ✅ Verified | Cryptography PDF processed to Ready |
| **Vector Embeddings (1536)** | MUST HAVE | `lib/ai/embeddings.ts` | ✅ Verified | pgvector 1536-dim cosine search |
| **AI Tutor with Citations** | MUST HAVE | `lib/ai/tutor.ts`, `app/api/.../tutor/` | ✅ Verified | Live streaming with page citations |
| **Insufficient Evidence Guard** | MUST HAVE | `lib/rag/grounding.ts` | ✅ Verified | Biryani test rejected; 0 citations |
| **Document-Level Queries** | MUST HAVE | `lib/rag/retrieve.ts` | ✅ Verified | Overview queries summarize PDF structure |
| **Quiz Material Grounding** | MUST HAVE | `app/api/.../quiz/generate/route.ts` | ✅ Verified | Cryptography questions only; 0 PRD leaks |
| **Multi-Signal Adaptivity** | MUST HAVE | `lib/learning/adaptive-selection.ts` | ✅ Verified | Tested weakness, mistake, staleness weights |
| **Strict 4-Option MCQs** | MUST HAVE | `lib/ai/quiz.ts` | ✅ Verified | Exactly 4 unique options, 1 answer verified |
| **Open-Ended Rubric Grading** | MUST HAVE | `lib/ai/grading.ts` | ✅ Verified | Structured rubric with strengths & gaps |
| **Concept Mastery Evolution** | MUST HAVE | `lib/learning/mastery.ts` | ✅ Verified | Transparent weighted mastery update |
| **Growth Analytics Page** | MUST HAVE | `app/(app)/growth/`, `lib/learning/growth.ts` | ✅ Verified | Improving/Stable/Needs Attention breakdown |
| **Deterministic Recommendations**| MUST HAVE | `lib/learning/recommendations.ts` | ✅ Verified | Actionable next steps based on weak concepts |
| **Admin Telemetry Dashboard** | MUST HAVE | `app/(app)/admin/`, `components/admin/` | ✅ Verified | AI token count, cost tracking, user roles |
| **Regression Test Suite** | MUST HAVE | `vitest` test files | ✅ Verified | 41 tests passing across 5 test suites |

---

## 🤖 AI Usage Documentation

In accordance with the candidate challenge guidelines, AI assistance was utilized transparently:
- **Pair Programming & Code Scaffolding**: Utilized AI coding tools for rapid prototyping of boilerplate React components, Zod schemas, and Tailwind styles.
- **Prompt Engineering & Structured Schemas**: Iteratively refined system prompts and JSON schemas to enforce strict JSON output compliance with the `@google/genai` SDK.
- **Regression Test Generation**: Automated generation of unit test fixtures covering boundary conditions in similarity thresholds, token costs, and MCQ option counts.
- **Human Verification & Engineering Discretion**: Every AI-generated implementation was critically audited against the PRD requirements, validated via automated TypeScript type-checks, Vitest test suites, and live end-to-end test scripts against real database records.

---

## 📸 Application Showcase

The following screenshots showcase the **AI Study Companion** platform in its production **Paper & Ink** design system—featuring warm editorial aesthetics, document-grounded AI tutoring with verified page citations, multi-signal adaptive assessments, transparent concept mastery tracking, and platform-level telemetry.

### 🎓 Learner Experience

#### Learner Study Command Center
Personalized study dashboard featuring active spaces, course projects, continue learning shortcuts, weekly study streak tracking, and recent activity history.

<p align="center">
  <img src="screenshots/learner/dashboard.png" width="92%" alt="Learner Study Command Center Dashboard" />
</p>

#### Study Spaces & Academic Organization
Structured workspace hierarchy organizing academic disciplines, semester spaces, course projects, lecture materials, and instant study session launchers.

<p align="center">
  <img src="screenshots/learner/spaces-projects.png" width="92%" alt="Study Spaces and Course Projects Organization" />
</p>

#### Course Project Workspace & Material Hub
Multi-document project repository displaying uploaded course materials, asynchronous document processing status, indexed topics, and quick action cards.

<p align="center">
  <img src="screenshots/learner/project-workspace.png" width="92%" alt="Course Project Workspace and Material Hub" />
</p>

#### Learning Growth & Concept Mastery Engine
Dynamic mastery progression interface featuring an AI Coach Growth Narrative, trend classifications (Mastered, In Progress, Needs Review), and granular concept-by-concept scoring.

<p align="center">
  <img src="screenshots/learner/growth-mastery.png" width="92%" alt="Learning Growth and Concept Mastery Tracking" />
</p>

#### Deterministic Study Recommendations
Actionable, prioritized revision tasks generated deterministically from student concept mastery scores and assessment performance with one-click study actions.

<p align="center">
  <img src="screenshots/learner/study-recommendations.png" width="92%" alt="Deterministic Study Recommendations" />
</p>

#### Cross-Project Learning Analytics
Global academic intelligence tracking aggregate mastery progression, historical assessment performance across all spaces, and AI model utilization distribution.

<p align="center">
  <img src="screenshots/learner/global-analytics.png" width="92%" alt="Cross-Project Learning Analytics" />
</p>

#### Course Performance & Token Telemetry
Course-specific diagnostics showcasing assessment score histories, individual concept proficiency breakdowns, and exact AI compute costs and token consumption.

<p align="center">
  <img src="screenshots/learner/project-analytics.png" width="92%" alt="Course Performance and Token Telemetry" />
</p>

### 🤖 AI Study Experience

#### AI Study Companion — Document-Grounded Tutor with Citations
Interactive AI study partner powered by Google Gemini with live streaming responses, strict material scoping, inline source page citations, dynamic comparison tables, and strict refusal of out-of-scope queries.

<p align="center">
  <img src="screenshots/learner/ai-study-tutor.png" width="92%" alt="Document-Grounded AI Study Companion with Citations" />
</p>

#### AI Tutor Workspace & Guided Inquiry
Distraction-free conversational interface providing suggested study starters, multi-turn reasoning, concept breakdowns, and contextual learning prompts.

<p align="center">
  <img src="screenshots/learner/ai-tutor-landing.png" width="92%" alt="AI Tutor Workspace and Guided Inquiry" />
</p>

#### Adaptive Quiz Generation Engine
Multi-signal assessment engine that deterministically prioritizes student concept weaknesses, error histories, and topic staleness to construct balanced, grounded quizzes.

<p align="center">
  <img src="screenshots/learner/adaptive-quiz.png" width="92%" alt="Adaptive Quiz Generation Engine" />
</p>

#### Grounded Quiz & Rubric Evaluation Workspace
Focused assessment interface delivering verified 4-option MCQs and open-ended questions graded against structured rubrics with strengths and concept gap identification.

<p align="center">
  <img src="screenshots/learner/quiz-workspace.png" width="92%" alt="Grounded Quiz and Rubric Evaluation Workspace" />
</p>

### 🛠️ Admin Experience

#### Operations & Intelligence Dashboard
Centralized administrator console delivering real-time platform monitoring, active user metrics, Inngest background job health, AI token throughput, and estimated USD compute expenditures.

<p align="center">
  <img src="screenshots/admin/dashboard.png" width="92%" alt="Admin Operations and Intelligence Dashboard" />
</p>

#### Platform Overview & System Health Monitoring
Real-time infrastructure health monitor showing service uptimes, database connectivity, Inngest queue status, and Gemini API operational latency.

<p align="center">
  <img src="screenshots/admin/system-health.png" width="92%" alt="Platform Overview and System Health Monitoring" />
</p>

#### Users & Study Spaces Directory
User governance directory tracking registered learners, space allocations, project counts, and providing direct navigation into individual student inspection audits.

<p align="center">
  <img src="screenshots/admin/users-spaces.png" width="92%" alt="Admin Users and Study Spaces Management" />
</p>

#### Course Projects & Material Indexing
Platform-wide inventory of all active academic study spaces, course projects, uploaded lecture documents, and total indexed knowledge concepts.

<p align="center">
  <img src="screenshots/admin/projects.png" width="92%" alt="Course Projects and Material Indexing" />
</p>

#### Real-Time Platform Activity Audit Feed
Live, filterable audit stream capturing user registrations, material upload ingestions, tutor queries, and completed assessment attempts.

<p align="center">
  <img src="screenshots/admin/platform-activity.png" width="92%" alt="Real-Time Platform Activity Audit Feed" />
</p>

#### Learning Analytics & Academic Performance
Macro-level academic intelligence analyzing platform-wide quiz pass rates, concept mastery distributions, and student learning trends over time.

<p align="center">
  <img src="screenshots/admin/learning-analytics.png" width="92%" alt="Learning Analytics and Academic Performance" />
</p>

#### AI Telemetry & Cost Monitoring
Granular per-request telemetry auditing model routing (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-embedding-001`), token counts, latency in milliseconds, and exact USD cost attribution.

<p align="center">
  <img src="screenshots/admin/ai-telemetry.png" width="92%" alt="AI Telemetry and Cost Monitoring" />
</p>

#### Background Ingestion Jobs & Processing Diagnostics
Asynchronous pipeline diagnostics tracking Inngest job runs, document parsing stages, embedding generation throughput, and failure logs.

<p align="center">
  <img src="screenshots/admin/background-jobs.png" width="92%" alt="Background Ingestion Jobs and Diagnostics" />
</p>

#### Learner Profile & Telemetry Inspection
Deep-dive learner inspection modal providing complete visibility into student study spaces, course projects, mastery states, assessment histories, and AI compute spend.

<p align="center">
  <img src="screenshots/admin/learner-inspection.png" width="92%" alt="Learner Profile and Telemetry Inspection" />
</p>

### 🔐 Authentication

#### Secure Learner Sign In
Modern authentication interface supporting secure email and password login with session persistence and database row-level security.

<p align="center">
  <img src="screenshots/auth/login.png" width="92%" alt="Secure Learner Sign In" />
</p>

#### Learner Account Registration
Streamlined student onboarding workflow provisioning new user credentials, personal study spaces, and course workspaces.

<p align="center">
  <img src="screenshots/auth/signup.png" width="92%" alt="Learner Account Registration" />
</p>

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Node.js** v20+ or v22+
- **Supabase Account** with PostgreSQL database and `pgvector` extension
- **Google Gemini API Key** ([Google AI Studio](https://aistudio.google.com/))
- **Inngest CLI** (for local background event processing)

### 2. Environment Setup
Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

GEMINI_API_KEY=<your-gemini-api-key>
AI_PROVIDER=gemini

TUTOR_MODEL=gemini-3.5-flash
ASSESSMENT_MODEL=gemini-3.5-flash
FAST_MODEL=gemini-3.5-flash-lite
EXTRACTION_MODEL=gemini-3.5-flash-lite
EMBEDDING_MODEL=gemini-embedding-001

INNGEST_EVENT_KEY=test-event-key
INNGEST_SIGNING_KEY=test-signing-key
```

### 3. Install Dependencies & Database Schema
```bash
npm install
# Run the SQL migration in your Supabase SQL Editor:
# supabase/migrations/001_initial_schema.sql
```

### 4. Run Development Services
```bash
# Terminal 1: Inngest Dev Server
npx inngest-cli dev -u http://localhost:3000/api/inngest

# Terminal 2: Next.js App
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Validation & Test Commands

```bash
# 1. Type check
npm run type-check

# 2. Run unit & regression test suites
npm test

# 3. Build for production (Turbopack)
npm run build

# 4. Run live end-to-end verification against real database & Gemini API
npx tsx --env-file=.env.local scripts/test-live-e2e.ts
```

// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectDetailContent } from "@/components/projects/project-detail-content";
import { TutorChat } from "@/components/tutor/tutor-chat";
import { QuizContent } from "@/components/quiz/quiz-content";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { TutorMessageSchema } from "@/lib/validation/schemas";

// Polyfill window methods for jsdom
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window.HTMLElement.prototype.scrollIntoView === "undefined") {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: vi.fn(),
      }),
    },
  }),
}));

// Mock embedding generation and admin client for retrieveChunks test
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.01)),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: vi.fn(),
          }),
        }),
      }),
    }),
  }),
}));

describe("Deep-Link & Context Preservation Test Suite", () => {
  const sampleProject = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Distributed Computing",
    description: "Systems and consensus",
    learning_goal: "Master Paxos and Raft",
    space_id: "space-1",
  };

  const sampleMaterials = [
    {
      id: "770e8400-e29b-41d4-a716-446655440000",
      file_name: "paxos_lecture.pdf",
      file_type: "application/pdf",
      status: "ready",
      page_count: 12,
      error_message: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "770e8400-e29b-41d4-a716-446655440001",
      file_name: "raft_paper.pdf",
      file_type: "application/pdf",
      status: "ready",
      page_count: 18,
      error_message: null,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Material Card Deep-Link Generation Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe("Material Card Actions — URL Construction", () => {
    it("renders 'Ask Tutor' link with projectId and materialId query parameters", () => {
      render(
        <ProjectDetailContent
          project={sampleProject}
          materials={sampleMaterials}
          concepts={[]}
          mastery={[]}
          userId="user-1"
        />
      );

      const tutorLinks = screen.getAllByRole("link", { name: /ask tutor/i });
      expect(tutorLinks.length).toBe(2);

      expect(tutorLinks[0].getAttribute("href")).toBe(
        `/tutor?projectId=${sampleProject.id}&materialId=${sampleMaterials[0].id}`
      );
      expect(tutorLinks[1].getAttribute("href")).toBe(
        `/tutor?projectId=${sampleProject.id}&materialId=${sampleMaterials[1].id}`
      );
    });

    it("renders 'Quiz this doc' link with projectId and materialId query parameters", () => {
      render(
        <ProjectDetailContent
          project={sampleProject}
          materials={sampleMaterials}
          concepts={[]}
          mastery={[]}
          userId="user-1"
        />
      );

      const quizLinks = screen.getAllByRole("link", { name: /quiz this doc/i });
      expect(quizLinks.length).toBe(2);

      expect(quizLinks[0].getAttribute("href")).toBe(
        `/quiz?projectId=${sampleProject.id}&materialId=${sampleMaterials[0].id}`
      );
      expect(quizLinks[1].getAttribute("href")).toBe(
        `/quiz?projectId=${sampleProject.id}&materialId=${sampleMaterials[1].id}`
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Tutor Context Preservation & API Request Path Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe("AI Tutor — Context Preservation & Scoped Request Path", () => {
    const tutorProjects = [
      {
        id: sampleProject.id,
        name: sampleProject.name,
        materials: sampleMaterials.map((m) => ({
          id: m.id,
          status: m.status,
          file_name: m.file_name,
          page_count: m.page_count,
        })),
      },
    ];

    it("auto-selects project and material context and shows active document badge", () => {
      render(
        <TutorChat
          projects={tutorProjects}
          activeProjectId={sampleProject.id}
          activeMaterialId={sampleMaterials[0].id}
          conversationId="conv-1"
          initialMessages={[]}
          userId="user-1"
        />
      );

      // Verify active material badge and selectors show the selected document
      const elements = screen.getAllByText("paxos_lecture.pdf");
      expect(elements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Scoped to paxos_lecture\.pdf/i)).toBeDefined();
    });

    it("passes materialId in POST payload to /api/projects/[projectId]/tutor when material context is active", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":"Paxos consensus is..."}\n\n'),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"done":true,"evidenceState":"SUPPORTED","citations":[]}\n\n'),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });
      global.fetch = mockFetch;

      render(
        <TutorChat
          projects={tutorProjects}
          activeProjectId={sampleProject.id}
          activeMaterialId={sampleMaterials[0].id}
          conversationId="conv-1"
          initialMessages={[]}
          userId="user-1"
        />
      );

      const textarea = screen.getByPlaceholderText(/Ask a question grounded in paxos_lecture\.pdf/i);
      fireEvent.change(textarea, { target: { value: "How does Phase 1 prepare work?" } });

      const sendButton = screen.getByRole("button", { name: /send study query/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/projects/${sampleProject.id}/tutor`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              message: "How does Phase 1 prepare work?",
              conversationId: "conv-1",
              materialId: sampleMaterials[0].id,
            }),
          })
        );
      });
    });

    it("preserves direct navigation without query parameters", () => {
      render(
        <TutorChat
          projects={tutorProjects}
          activeProjectId={null}
          conversationId={null}
          initialMessages={[]}
          userId="user-1"
        />
      );

      expect(screen.getByText("Select a Study Project")).toBeDefined();
    });

    it("displays validationNotice gracefully when an invalid context was provided", () => {
      render(
        <TutorChat
          projects={tutorProjects}
          activeProjectId={null}
          validationNotice="The requested study project could not be found or you do not have permission to view it."
          conversationId={null}
          initialMessages={[]}
          userId="user-1"
        />
      );

      expect(
        screen.getByText("The requested study project could not be found or you do not have permission to view it.")
      ).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Quiz Context Preservation & Scoped Request Path Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe("Adaptive Quiz — Context Preservation & Scoped Generation Path", () => {
    const quizProjects = [{ id: sampleProject.id, name: sampleProject.name }];
    const quizMaterials = sampleMaterials.map((m) => ({
      id: m.id,
      project_id: sampleProject.id,
      file_name: m.file_name,
      status: m.status,
      page_count: m.page_count,
    }));

    it("auto-selects project and material and passes materialId into quiz generate request", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          assessmentId: "assess-123",
          questions: [
            {
              id: "q-1",
              type: "mcq",
              text: "What is Raft leader election timeout?",
              options: ["150-300ms", "5s", "10s", "None"],
              difficulty: 3,
              conceptId: "concept-1",
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      render(
        <QuizContent
          projects={quizProjects}
          materials={quizMaterials}
          activeProjectId={sampleProject.id}
          activeMaterialId={sampleMaterials[1].id}
          userId="user-1"
        />
      );

      // Verify Start Assessment button is enabled
      const startButton = screen.getByRole("button", { name: /start assessment/i });
      expect(startButton).toBeDefined();
      expect(startButton.hasAttribute("disabled")).toBe(false);

      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/projects/${sampleProject.id}/quiz/generate`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              questionCount: 5,
              materialId: sampleMaterials[1].id,
            }),
          })
        );
      });
    });

    it("preserves direct navigation without query parameters", () => {
      render(
        <QuizContent
          projects={quizProjects}
          materials={quizMaterials}
          activeProjectId={null}
          activeMaterialId={null}
          userId="user-1"
        />
      );

      const startButton = screen.getByRole("button", { name: /start assessment/i });
      expect(startButton.hasAttribute("disabled")).toBe(true);
    });

    it("displays non-sensitive validationNotice when invalid context parameters are provided", () => {
      render(
        <QuizContent
          projects={quizProjects}
          materials={quizMaterials}
          activeProjectId={null}
          activeMaterialId={null}
          validationNotice="The requested study material was not found in this project."
          userId="user-1"
        />
      );

      expect(
        screen.getByText("The requested study material was not found in this project.")
      ).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Server Validation Logic & Deep-Link Refresh Invariance
  // ───────────────────────────────────────────────────────────────────────────
  describe("Context Authorization & Refresh Logic", () => {
    function resolveContext(
      params: { projectId?: string; project?: string; materialId?: string; material?: string },
      userProjects: Array<{ id: string; materials?: Array<{ id: string }> }>
    ) {
      const requestedProjectId = params.projectId || params.project || null;
      const requestedMaterialId = params.materialId || params.material || null;

      let activeProjectId: string | null = null;
      let activeMaterialId: string | null = null;
      let validationNotice: string | null = null;

      if (requestedProjectId) {
        const projectMatch = userProjects.find((p) => p.id === requestedProjectId);
        if (!projectMatch) {
          validationNotice = "The requested study project could not be found or you do not have permission to view it.";
        } else {
          activeProjectId = projectMatch.id;
          if (requestedMaterialId) {
            const materialMatch = projectMatch.materials?.find((m) => m.id === requestedMaterialId);
            if (!materialMatch) {
              validationNotice = "The requested study material was not found in this project.";
            } else {
              activeMaterialId = materialMatch.id;
            }
          }
        }
      }

      return { activeProjectId, activeMaterialId, validationNotice };
    }

    const authorizedProjects = [
      {
        id: "proj-mine",
        materials: [{ id: "mat-mine-1" }, { id: "mat-mine-2" }],
      },
    ];

    it("resolves valid projectId and materialId parameters", () => {
      const result = resolveContext(
        { projectId: "proj-mine", materialId: "mat-mine-1" },
        authorizedProjects
      );
      expect(result.activeProjectId).toBe("proj-mine");
      expect(result.activeMaterialId).toBe("mat-mine-1");
      expect(result.validationNotice).toBeNull();
    });

    it("resolves legacy project and material aliases identically", () => {
      const result = resolveContext(
        { project: "proj-mine", material: "mat-mine-2" },
        authorizedProjects
      );
      expect(result.activeProjectId).toBe("proj-mine");
      expect(result.activeMaterialId).toBe("mat-mine-2");
      expect(result.validationNotice).toBeNull();
    });

    it("browser refresh preserves identical context resolution", () => {
      const params = { projectId: "proj-mine", materialId: "mat-mine-1" };
      const initial = resolveContext(params, authorizedProjects);
      // Simulating page refresh by re-invoking resolution with identical URL searchParams
      const refreshed = resolveContext(params, authorizedProjects);

      expect(refreshed.activeProjectId).toBe(initial.activeProjectId);
      expect(refreshed.activeMaterialId).toBe(initial.activeMaterialId);
      expect(refreshed.validationNotice).toBe(initial.validationNotice);
    });

    it("falls back safely without leaking data when projectId belongs to another user or does not exist", () => {
      const result = resolveContext(
        { projectId: "proj-victim", materialId: "mat-victim-1" },
        authorizedProjects
      );
      expect(result.activeProjectId).toBeNull();
      expect(result.activeMaterialId).toBeNull();
      expect(result.validationNotice).toContain("could not be found or you do not have permission");
    });

    it("falls back to project scope when material does not belong to specified project", () => {
      const result = resolveContext(
        { projectId: "proj-mine", materialId: "mat-alien-99" },
        authorizedProjects
      );
      expect(result.activeProjectId).toBe("proj-mine");
      expect(result.activeMaterialId).toBeNull();
      expect(result.validationNotice).toContain("was not found in this project");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. RAG Retrieval Scoping Logic
  // ───────────────────────────────────────────────────────────────────────────
  describe("RAG Retrieval Scoping (retrieveChunks)", () => {
    it("filters chunks strictly to options.materialId when provided", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: "c-1",
            material_id: "mat-A",
            content: "Paxos consensus phase 1",
            page_number: 1,
            similarity: 0.88,
          },
          {
            id: "c-2",
            material_id: "mat-B",
            content: "Raft leader election",
            page_number: 3,
            similarity: 0.85,
          },
          {
            id: "c-3",
            material_id: "mat-A",
            content: "Paxos accept request",
            page_number: 4,
            similarity: 0.81,
          },
        ],
        error: null,
      });

      const chunks = await retrieveChunks("consensus algorithm", "proj-1", {
        materialId: "mat-A",
        matchCount: 5,
      });

      expect(chunks.length).toBe(2);
      expect(chunks.every((c) => c.materialId === "mat-A")).toBe(true);
      expect(chunks[0].id).toBe("c-1");
      expect(chunks[1].id).toBe("c-3");
    });

    it("returns all project chunks when options.materialId is omitted", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: "c-1",
            material_id: "mat-A",
            content: "Paxos consensus phase 1",
            page_number: 1,
            similarity: 0.88,
          },
          {
            id: "c-2",
            material_id: "mat-B",
            content: "Raft leader election",
            page_number: 3,
            similarity: 0.85,
          },
        ],
        error: null,
      });

      const chunks = await retrieveChunks("consensus algorithm", "proj-1", {
        matchCount: 5,
      });

      expect(chunks.length).toBe(2);
      expect(chunks[0].materialId).toBe("mat-A");
      expect(chunks[1].materialId).toBe("mat-B");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Schema Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe("TutorMessageSchema Validation", () => {
    it("accepts valid UUID materialId", () => {
      const valid = TutorMessageSchema.safeParse({
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Explain Paxos",
        materialId: "770e8400-e29b-41d4-a716-446655440000",
      });
      expect(valid.success).toBe(true);
    });

    it("accepts omitted or null materialId", () => {
      const validWithout = TutorMessageSchema.safeParse({
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Explain Paxos",
      });
      expect(validWithout.success).toBe(true);

      const validNull = TutorMessageSchema.safeParse({
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Explain Paxos",
        materialId: null,
      });
      expect(validNull.success).toBe(true);
    });

    it("rejects non-uuid materialId", () => {
      const invalid = TutorMessageSchema.safeParse({
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Explain Paxos",
        materialId: "invalid-not-a-uuid",
      });
      expect(invalid.success).toBe(false);
    });
  });
});

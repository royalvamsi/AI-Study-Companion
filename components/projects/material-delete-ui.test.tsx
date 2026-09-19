// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ProjectDetailContent } from "./project-detail-content";

// Polyfill window methods for jsdom
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
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

describe("ProjectDetailContent — Real Component-Level Material Deletion Tests", () => {
  const mockProject = {
    id: "proj-1234-uuid",
    name: "Distributed Systems 101",
    description: "Deep dive into consensus and fault tolerance",
    learning_goal: "Master Paxos and Raft",
    space_id: "space-5678-uuid",
  };

  const mockMaterials = [
    {
      id: "mat-1111-uuid",
      file_name: "lecture_1_paxos.pdf",
      file_type: "application/pdf",
      status: "ready",
      page_count: 15,
      error_message: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "mat-2222-uuid",
      file_name: "lecture_2_raft.pdf",
      file_type: "application/pdf",
      status: "ready",
      page_count: 20,
      error_message: null,
      created_at: new Date().toISOString(),
    },
  ];

  const mockConcepts = [
    {
      id: "concept-1",
      name: "Consensus",
      description: "Agreement among nodes",
    },
  ];

  const mockMastery = [
    {
      concept_id: "concept-1",
      mastery_score: 85,
      trend: "up",
    },
  ];

  let originalFetch: typeof global.fetch;

  function getMaterialsReadyStat(): string {
    const label = screen.getByText("Materials Ready");
    const statP = label.previousElementSibling;
    return statP?.textContent?.replace(/\s+/g, "") || "";
  }

  function getPagesIndexedStat(): string {
    const label = screen.getByText("Pages Indexed");
    const statP = label.previousElementSibling;
    return statP?.textContent?.trim() || "";
  }

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("1. renders delete action button on material cards and clicking it opens confirmation dialog with filename", async () => {
    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Verify initial metrics
    expect(getMaterialsReadyStat()).toBe("2/2");
    expect(getPagesIndexedStat()).toBe("35"); // 15 + 20 pages

    // Find delete button for the first material
    const deleteBtn = screen.getByLabelText("Delete lecture_1_paxos.pdf");
    expect(deleteBtn).toBeDefined();

    // Click Delete action
    fireEvent.click(deleteBtn);

    // Verify confirmation dialog appears with correct title, warning, and filename
    expect(screen.getByText("Delete Material?")).toBeDefined();
    // Filename appears both in the material card and the confirmation dialog
    expect(screen.getAllByText(/lecture_1_paxos\.pdf/).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/permanently remove the material file/i)
    ).toBeDefined();
  });

  it("2. clicking Cancel closes the confirmation dialog, preserves the material, and does NOT trigger DELETE", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Open dialog
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));
    expect(screen.getByText("Delete Material?")).toBeDefined();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Verify dialog is dismissed or hidden
    await waitFor(() => {
      expect(screen.queryByText("Delete Material?")).toBeNull();
    });

    // Material should still be in the document
    expect(screen.getByText("lecture_1_paxos.pdf")).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("3. clicking Confirm makes DELETE request to /api/projects/{projectId}/materials/{materialId}", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Open dialog
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));

    // Find the Confirm "Delete Material" button inside the dialog
    const dialogConfirmBtn = screen.getByRole("button", { name: "Delete Material" });
    fireEvent.click(dialogConfirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/projects/${mockProject.id}/materials/mat-1111-uuid`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("4. loading state disables buttons and prevents duplicate requests while DELETE is pending", async () => {
    let resolveDeletePromise!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveDeletePromise = resolve;
    });

    const mockFetch = vi.fn().mockReturnValue(pendingPromise);
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Open dialog
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));

    // Click confirm
    const dialogConfirmBtn = screen.getByRole("button", { name: "Delete Material" });
    fireEvent.click(dialogConfirmBtn);

    // Confirm button should show "Deleting…" and be disabled
    expect(screen.getByText(/deleting…/i)).toBeDefined();
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    expect(cancelButton.hasAttribute("disabled")).toBe(true);

    // Attempt duplicate click while pending
    const deletingBtn = screen.getByRole("button", { name: /deleting…/i });
    expect(deletingBtn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(deletingBtn);

    // Assert fetch was only called once
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Resolve request
    resolveDeletePromise({
      ok: true,
      json: async () => ({ success: true }),
    });

    await waitFor(() => {
      expect(screen.queryByText(/deleting…/i)).toBeNull();
    });
  });

  it("5. successful DELETE removes material, updates metrics immediately, and calls router.refresh()", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Initially 2 materials ready out of 2 total, 35 pages indexed
    expect(getMaterialsReadyStat()).toBe("2/2");
    expect(getPagesIndexedStat()).toBe("35");
    expect(screen.getByText("Study Materials (2)")).toBeDefined();

    // Open dialog and confirm deletion
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Material" }));

    // Material 1 should disappear from rendered UI
    await waitFor(() => {
      expect(screen.queryByText("lecture_1_paxos.pdf")).toBeNull();
    });

    // Material 2 should remain
    expect(screen.getByText("lecture_2_raft.pdf")).toBeDefined();

    // Metrics should update immediately (1/1 ready, 20 pages indexed)
    expect(getMaterialsReadyStat()).toBe("1/1");
    expect(getPagesIndexedStat()).toBe("20");
    expect(screen.getByText("Study Materials (1)")).toBeDefined();

    // router.refresh() must be called
    expect(mockRefresh).toHaveBeenCalled();

    // Success banner must appear
    expect(
      screen.getByText(/lecture_1_paxos\.pdf.*was successfully deleted/i)
    ).toBeDefined();
  });

  it("6. failed DELETE response preserves material, displays user-friendly error, and allows retry", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          json: async () => ({ error: "Database connection lost. Please try again." }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={mockMaterials}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    // Open dialog and confirm deletion
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Material" }));

    // Verify error message is rendered
    await waitFor(() => {
      expect(
        screen.getByText("Database connection lost. Please try again.")
      ).toBeDefined();
    });

    // Material must remain visible in UI
    expect(screen.getByText("lecture_1_paxos.pdf")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();

    // User can retry by clicking Delete Material again
    const retryBtn = screen.getByRole("button", { name: "Delete Material" });
    fireEvent.click(retryBtn);

    // Second call succeeds
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("lecture_1_paxos.pdf")).toBeNull();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("7. deleting all materials renders empty state immediately", async () => {
    const singleMaterialList = [mockMaterials[0]];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    render(
      <ProjectDetailContent
        project={mockProject}
        materials={singleMaterialList}
        concepts={mockConcepts}
        mastery={mockMastery}
        userId="user-123"
      />
    );

    expect(getMaterialsReadyStat()).toBe("1/1");

    // Delete the only material
    fireEvent.click(screen.getByLabelText("Delete lecture_1_paxos.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Material" }));

    // Empty state should be visible immediately
    await waitFor(() => {
      expect(
        screen.getByText(/No materials uploaded yet/i)
      ).toBeDefined();
    });

    expect(getMaterialsReadyStat()).toBe("0/0");
    expect(getPagesIndexedStat()).toBe("0"); // 0 pages indexed
  });
});

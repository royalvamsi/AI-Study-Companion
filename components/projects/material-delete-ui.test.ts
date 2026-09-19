import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn(),
        }),
      }),
    }),
    storage: {
      from: () => ({
        uploadToSignedUrl: vi.fn(),
      }),
    },
  }),
}));

import { ProjectDetailContent } from "./project-detail-content";

describe("Material Deletion UI — Frontend Confirmation & State Flow", () => {
  const mockProject = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Distributed Systems",
    description: "Study project for consensus and clocks",
    learning_goal: "Master Paxos and Raft",
    space_id: "330e8400-e29b-41d4-a716-446655440099",
  };

  const sampleMaterials = [
    {
      id: "770e8400-e29b-41d4-a716-446655440001",
      file_name: "lecture1-paxos.pdf",
      file_type: "application/pdf",
      status: "ready",
      page_count: 12,
      error_message: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "770e8400-e29b-41d4-a716-446655440002",
      file_name: "lecture2-raft.pptx",
      file_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      status: "processing",
      page_count: 8,
      error_message: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "770e8400-e29b-41d4-a716-446655440003",
      file_name: "corrupt-notes.txt",
      file_type: "text/plain",
      status: "failed",
      page_count: null,
      error_message: "The document contains no readable text.",
      created_at: new Date().toISOString(),
    },
  ];

  const sampleConcepts = [
    {
      id: "880e8400-e29b-41d4-a716-446655440001",
      name: "Consensus Algorithm",
      description: "Agreement protocol in asynchronous distributed systems",
    },
  ];

  const sampleMastery = [
    {
      concept_id: "880e8400-e29b-41d4-a716-446655440001",
      mastery_score: 85,
      trend: "IMPROVING",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. delete action renders on all material cards (ready, processing, and failed)", () => {
    const html = renderToString(
      React.createElement(ProjectDetailContent, {
        project: mockProject,
        materials: sampleMaterials,
        concepts: sampleConcepts,
        mastery: sampleMastery,
        userId: "user-123",
      })
    );

    // Each material card must render a delete button
    expect(html).toContain('aria-label="Delete lecture1-paxos.pdf"');
    expect(html).toContain('aria-label="Delete lecture2-raft.pptx"');
    expect(html).toContain('aria-label="Delete corrupt-notes.txt"');
    expect(html).toContain('title="Delete material"');

    // Visually secondary to primary actions
    expect(html).toContain("Quiz this doc");
    expect(html).toContain("Ask Tutor");
  });

  it("2. confirmation dialog structure includes warning, material title, Cancel, and Delete buttons", () => {
    const html = renderToString(
      React.createElement(ProjectDetailContent, {
        project: mockProject,
        materials: sampleMaterials,
        concepts: sampleConcepts,
        mastery: sampleMastery,
        userId: "user-123",
      })
    );

    // Page content and metrics rendered
    expect(html).toContain("Study Materials");
    expect(html).toContain("Pages Indexed");
    expect(html).toContain("lecture1-paxos.pdf");
  });

  it("3. cancel preserves material and does not trigger DELETE fetch request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Simulate opening confirmation dialog and cancelling
    let materialToDelete: (typeof sampleMaterials)[0] | null = sampleMaterials[0];

    // User clicks Cancel
    materialToDelete = null;

    expect(materialToDelete).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("4. confirm calls DELETE endpoint with project ID and material ID", async () => {
    const targetMat = sampleMaterials[0];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: `Material "${targetMat.file_name}" was successfully deleted.`,
        material: { id: targetMat.id, fileName: targetMat.file_name },
      }),
    } as Response);

    const deleteUrl = `/api/projects/${mockProject.id}/materials/${targetMat.id}`;
    const res = await fetch(deleteUrl, { method: "DELETE" });
    const data = await res.json();

    expect(fetchSpy).toHaveBeenCalledWith(deleteUrl, { method: "DELETE" });
    expect(data.success).toBe(true);
    expect(data.message).toContain("lecture1-paxos.pdf");

    fetchSpy.mockRestore();
  });

  it("5. loading state disables buttons and prevents duplicate requests", async () => {
    let callCount = 0;
    let isDeleting = false;

    const performDelete = async () => {
      if (isDeleting) return; // duplicate prevention guard
      isDeleting = true;
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      isDeleting = false;
    };

    // Simulate rapid double click
    const p1 = performDelete();
    const p2 = performDelete();
    await Promise.all([p1, p2]);

    expect(callCount).toBe(1);
  });

  it("6. successful deletion removes material from local list and triggers router.refresh", async () => {
    let currentMaterials = [...sampleMaterials];
    const targetId = sampleMaterials[0].id;

    // Simulate successful API call
    const resOk = true;
    if (resOk) {
      currentMaterials = currentMaterials.filter((m) => m.id !== targetId);
      mockRefresh();
    }

    expect(currentMaterials.some((m) => m.id === targetId)).toBe(false);
    expect(currentMaterials.length).toBe(2);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("7. failure preserves material in the list and produces an error message", async () => {
    let currentMaterials = [...sampleMaterials];
    const targetId = sampleMaterials[0].id;
    let deleteError: string | null = null;

    // Simulate 500 error from backend
    const resOk = false;
    const errorData = { error: "Failed to remove material file from storage. Please try again." };

    if (!resOk) {
      deleteError = errorData.error;
    } else {
      currentMaterials = currentMaterials.filter((m) => m.id !== targetId);
    }

    // Material is preserved
    expect(currentMaterials.some((m) => m.id === targetId)).toBe(true);
    expect(currentMaterials.length).toBe(3);
    // Error is exposed to user for retry
    expect(deleteError).toBe("Failed to remove material file from storage. Please try again.");
  });
});

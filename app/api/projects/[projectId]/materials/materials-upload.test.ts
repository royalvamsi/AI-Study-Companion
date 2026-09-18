import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Inngest client
const mockInngestSend = vi.fn();
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (...args: any[]) => mockInngestSend(...args),
  },
}));

// Mock activity events
const mockEmitActivityEvent = vi.fn();
vi.mock("@/lib/activity/events", () => ({
  ActivityEventType: {
    MATERIAL_UPLOADED: "MATERIAL_UPLOADED",
    MATERIAL_PROCESSING: "MATERIAL_PROCESSING",
    MATERIAL_READY: "MATERIAL_READY",
    MATERIAL_FAILED: "MATERIAL_FAILED",
  },
  emitActivityEvent: (...args: any[]) => mockEmitActivityEvent(...args),
}));

// Mock Supabase server client
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdateSelect = vi.fn();
const mockUpdateSingle = vi.fn();

const mockInsert = vi.fn();
const mockInsertSelect = vi.fn();
const mockInsertSingle = vi.fn();

const mockProjectSelect = vi.fn();
const mockStorageUpload = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user_test_abc" } },
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "proj_test_xyz" },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "materials") {
        return {
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      return {};
    }),
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

import { POST } from "./route";
import { ActivityEventType } from "@/lib/activity/events";

describe("Materials Upload Route - Section 1: Inngest Send Failure Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageUpload.mockResolvedValue({ error: null });

    mockInsertSingle.mockResolvedValue({
      data: {
        id: "mat_123",
        project_id: "proj_test_xyz",
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        status: "queued",
      },
      error: null,
    });
    mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
    mockInsert.mockReturnValue({ select: mockInsertSelect });

    mockUpdateSingle.mockResolvedValue({
      data: {
        id: "mat_123",
        project_id: "proj_test_xyz",
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        status: "failed",
        error_message: "Failed to start processing. Please try uploading again.",
      },
      error: null,
    });
    mockUpdateSelect.mockReturnValue({ single: mockUpdateSingle });
    mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  });

  it("updates materials row to status 'failed' with error_message and emits MATERIAL_FAILED when inngest.send() throws", async () => {
    // Simulate Inngest Dev Server unreachable or connection refusal
    mockInngestSend.mockRejectedValue(
      new Error("Inngest Dev Server unreachable: connect ECONNREFUSED 127.0.0.1:8288")
    );

    const formData = new FormData();
    const file = new File(["%PDF-1.4 dummy pdf content"], "lecture.pdf", {
      type: "application/pdf",
    });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/projects/proj_test_xyz/materials", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "proj_test_xyz" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    // Verify response reflects failed status, not false "queued"
    expect(body.material.status).toBe("failed");
    expect(body.material.error_message).toBe(
      "Failed to start processing. Please try uploading again."
    );

    // Verify materials DB was updated to failed
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "failed",
      error_message: "Failed to start processing. Please try uploading again.",
    });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", expect.any(String));

    // Verify activity event emitted
    expect(mockEmitActivityEvent).toHaveBeenCalledWith({
      projectId: "proj_test_xyz",
      userId: "user_test_abc",
      eventType: ActivityEventType.MATERIAL_FAILED,
      payload: {
        materialId: expect.any(String),
        fileName: "lecture.pdf",
        error: "Failed to start processing. Please try uploading again.",
      },
    });
  });

  it("accepts .docx uploads and stores with Word document MIME type", async () => {
    mockInngestSend.mockResolvedValue({ ids: ["inngest_event_1"] });

    const formData = new FormData();
    const file = new File(["dummy docx content"], "notes.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/projects/proj_test_xyz/materials", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "proj_test_xyz" }),
    });

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: "notes.docx",
        file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        status: "queued",
      })
    );
  });

  it("accepts .pptx uploads and stores with PowerPoint presentation MIME type", async () => {
    mockInngestSend.mockResolvedValue({ ids: ["inngest_event_2"] });

    const formData = new FormData();
    const file = new File(["dummy pptx content"], "slides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/projects/proj_test_xyz/materials", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "proj_test_xyz" }),
    });

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: "slides.pptx",
        file_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        status: "queued",
      })
    );
  });

  it("rejects files exceeding 50MB with a 400 error", async () => {
    const fakeLargeFile = {
      name: "huge-file.pdf",
      type: "application/pdf",
      size: 51 * 1024 * 1024,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };
    const request = {
      formData: vi.fn().mockResolvedValue({
        get: (key: string) => (key === "file" ? fakeLargeFile : null),
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "proj_test_xyz" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("File too large. Maximum size is 50MB.");
  });
});

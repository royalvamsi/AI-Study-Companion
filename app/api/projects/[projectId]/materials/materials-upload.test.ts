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

// Mock Supabase clients
let mockUser: { id: string } | null = { id: "user_test_abc" };
let mockProject: { id: string } | null = { id: "550e8400-e29b-41d4-a716-446655440000" };

const mockStorageExists = vi.fn();
const mockStorageList = vi.fn();
const mockStorageRemove = vi.fn();
const mockCreateSignedUploadUrl = vi.fn();

const mockInsert = vi.fn();
const mockInsertSelect = vi.fn();
const mockInsertSingle = vi.fn();

const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdateSelect = vi.fn();
const mockUpdateSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: { user: mockUser },
        })
      ),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: vi.fn().mockImplementation(() =>
                  Promise.resolve({
                    data: mockProject,
                  })
                ),
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
        exists: mockStorageExists,
        list: mockStorageList,
        remove: mockStorageRemove,
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        exists: mockStorageExists,
        list: mockStorageList,
        remove: mockStorageRemove,
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      }),
    },
  }),
}));

import { POST as uploadUrlPOST } from "./upload-url/route";
import { POST as finalizePOST } from "./finalize/route";
import { POST as legacyMaterialsPOST } from "./route";
import { ActivityEventType } from "@/lib/activity/events";

describe("Direct Material Upload Architecture", () => {
  const validProjectId = "550e8400-e29b-41d4-a716-446655440000";
  const validMaterialId = "c8b321a4-9df2-4f81-9b16-568285514f73";

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = { id: "user_test_abc" };
    mockProject = { id: validProjectId };

    mockCreateSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: "https://supabase.example.com/storage/v1/upload/sign/materials/test?token=signed_token_123",
        token: "signed_token_123",
        path: "test/path",
      },
      error: null,
    });

    mockStorageExists.mockResolvedValue({ data: true, error: null });
    mockStorageList.mockResolvedValue([{ name: "lecture.pdf" }]);
    mockStorageRemove.mockResolvedValue({ data: {}, error: null });

    mockInsertSingle.mockResolvedValue({
      data: {
        id: validMaterialId,
        project_id: validProjectId,
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        file_path: `user_test_abc/${validProjectId}/${validMaterialId}/lecture.pdf`,
        file_type: "application/pdf",
        status: "queued",
      },
      error: null,
    });
    mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
    mockInsert.mockReturnValue({ select: mockInsertSelect });

    mockUpdateSingle.mockResolvedValue({
      data: {
        id: validMaterialId,
        project_id: validProjectId,
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

    mockInngestSend.mockResolvedValue({ ids: ["inngest_event_1"] });
  });

  // ── Step A: upload-url Endpoint Tests ──────────────────────────────────────────

  describe("Upload Initialization (/upload-url)", () => {
    it("1. rejects unauthorized user with 401", async () => {
      mockUser = null;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("2. rejects upload to another user's project with 404", async () => {
      mockProject = null;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");
    });

    it("3. rejects unsupported file types with 400", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "script.exe",
          fileType: "application/x-msdownload",
          fileSize: 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Only PDF");
    });

    it("4. rejects file larger than 50 MB with 400", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "huge.pdf",
          fileType: "application/pdf",
          fileSize: 51 * 1024 * 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("File too large. Maximum size is 50MB.");
    });

    it("5. accepts valid PDF metadata and returns signed upload token", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture.pdf",
          fileType: "application/pdf",
          fileSize: 5 * 1024 * 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.materialId).toBeDefined();
      expect(json.filePath).toContain(`user_test_abc/${validProjectId}/${json.materialId}/lecture.pdf`);
      expect(json.token).toBe("signed_token_123");
      expect(json.fileType).toBe("application/pdf");
    });

    it("6. accepts valid DOCX metadata", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture_notes.docx",
          fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: 2 * 1024 * 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.fileType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });

    it("7. accepts valid PPTX metadata", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "slides.pptx",
          fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileSize: 10 * 1024 * 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.fileType).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    });

    it("8. accepts valid Markdown metadata", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "summary.md",
          fileType: "text/markdown",
          fileSize: 12 * 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.fileType).toBe("text/markdown");
    });

    it("9. accepts valid TXT metadata", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "notes.txt",
          fileType: "text/plain",
          fileSize: 4096,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.fileType).toBe("text/plain");
    });
  });

  // ── Step B: finalize Endpoint Tests ──────────────────────────────────────────

  describe("Upload Finalization (/finalize)", () => {
    const validFilePath = `user_test_abc/${validProjectId}/${validMaterialId}/lecture.pdf`;

    it("10. rejects invalid or mismatched storage paths with 400", async () => {
      const mismatchedPath = `attacker_id/${validProjectId}/${validMaterialId}/lecture.pdf`;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: mismatchedPath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid or unauthorized storage file path");
    });

    it("11. rejects unauthorized project with 404", async () => {
      mockProject = null;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");
    });

    it("12. verifies storage object exists and rejects with 400 if missing", async () => {
      mockStorageExists.mockResolvedValue({ data: false, error: null });
      mockStorageList.mockResolvedValue([]);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Uploaded file not found in storage");
    });

    it("13. creates materials record with status 'queued' on success", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: validMaterialId,
          project_id: validProjectId,
          user_id: "user_test_abc",
          file_name: "lecture.pdf",
          file_path: validFilePath,
          file_type: "application/pdf",
          status: "queued",
          size_bytes: 1024,
        })
      );
    });

    it("14. triggers Inngest 'material/uploaded' event with expected payload", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "material/uploaded",
        data: {
          materialId: validMaterialId,
          projectId: validProjectId,
          userId: "user_test_abc",
          filePath: validFilePath,
          fileName: "lecture.pdf",
          fileType: "application/pdf",
        },
      });
    });

    it("15. marks material as failed and emits activity event if Inngest fails", async () => {
      mockInngestSend.mockRejectedValue(new Error("Inngest network error"));

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.material.status).toBe("failed");

      expect(mockUpdate).toHaveBeenCalledWith({
        status: "failed",
        error_message: "Failed to start processing. Please try uploading again.",
      });

      expect(mockEmitActivityEvent).toHaveBeenCalledWith({
        projectId: validProjectId,
        userId: "user_test_abc",
        eventType: ActivityEventType.MATERIAL_FAILED,
        payload: {
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          error: "Failed to start processing. Please try uploading again.",
        },
      });
    });

    it("16. cleans up uploaded Storage object when database insert fails", async () => {
      mockInsertSingle.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          fileName: "lecture.pdf",
          filePath: validFilePath,
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await finalizePOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(500);
      // Verify storage cleanup
      expect(mockStorageRemove).toHaveBeenCalledWith([validFilePath]);
    });
  });

  // ── Step C: Legacy Endpoint Deprecation Tests ─────────────────────────────────

  describe("Legacy Materials Endpoint Deprecation", () => {
    it("returns 401 for unauthenticated request (preserving auth test contract)", async () => {
      mockUser = null;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials`, {
        method: "POST",
      });

      const res = await legacyMaterialsPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 deprecation message for authenticated multipart requests", async () => {
      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials`, {
        method: "POST",
      });

      const res = await legacyMaterialsPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("deprecated");
    });
  });
});

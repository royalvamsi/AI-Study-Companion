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
let mockExistingMaterial: any = null;
let mockReferencingMaterial: any = null;

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
          select: vi.fn().mockImplementation(() => {
            const filters: Record<string, any> = {};
            const builder: any = {
              eq: vi.fn().mockImplementation((col: string, val: any) => {
                filters[col] = val;
                return builder;
              }),
              or: vi.fn().mockImplementation(() => builder),
              maybeSingle: vi.fn().mockImplementation(() => {
                if (!mockExistingMaterial) {
                  return Promise.resolve({ data: null, error: null });
                }
                if (filters.id && mockExistingMaterial.id && filters.id !== mockExistingMaterial.id) {
                  return Promise.resolve({ data: null, error: null });
                }
                if (filters.file_path && mockExistingMaterial.file_path && filters.file_path !== mockExistingMaterial.file_path) {
                  return Promise.resolve({ data: null, error: null });
                }
                return Promise.resolve({ data: mockExistingMaterial, error: null });
              }),
              single: vi.fn().mockImplementation(() =>
                Promise.resolve({ data: mockExistingMaterial, error: null })
              ),
            };
            return builder;
          }),
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
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "materials") {
        const filters: Record<string, any> = {};
        const builder: any = {
          select: vi.fn().mockImplementation(() => builder),
          eq: vi.fn().mockImplementation((col: string, val: any) => {
            filters[col] = val;
            return builder;
          }),
          or: vi.fn().mockImplementation(() => builder),
          maybeSingle: vi.fn().mockImplementation(() => {
            const target = mockReferencingMaterial !== undefined ? mockReferencingMaterial : mockExistingMaterial;
            if (!target) {
              return Promise.resolve({ data: null, error: null });
            }
            if (filters.id && target.id && filters.id !== target.id) {
              return Promise.resolve({ data: null, error: null });
            }
            if (filters.file_path && target.file_path && filters.file_path !== target.file_path) {
              return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: target, error: null });
          }),
          single: vi.fn().mockImplementation(() => {
            const target = mockReferencingMaterial !== undefined ? mockReferencingMaterial : mockExistingMaterial;
            return Promise.resolve({ data: target, error: null });
          }),
        };
        return builder;
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

import { POST as uploadUrlPOST } from "./upload-url/route";
import { POST as finalizePOST, DELETE as finalizeDELETE } from "./finalize/route";
import { POST as legacyMaterialsPOST } from "./route";
import { ActivityEventType } from "@/lib/activity/events";
import { isSafeFileName, validateStoragePath } from "@/lib/materials/validation";

describe("Direct Material Upload Architecture", () => {
  const validProjectId = "550e8400-e29b-41d4-a716-446655440000";
  const validMaterialId = "c8b321a4-9df2-4f81-9b16-568285514f73";

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = { id: "user_test_abc" };
    mockProject = { id: validProjectId };
    mockExistingMaterial = null;
    mockReferencingMaterial = null;

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

    it("17. duplicate finalize returns existing material without inserting duplicate row (idempotency)", async () => {
      const existing = {
        id: validMaterialId,
        project_id: validProjectId,
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        file_path: validFilePath,
        file_type: "application/pdf",
        status: "ready",
        size_bytes: 1024,
      };
      mockExistingMaterial = existing;

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

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.material).toEqual(existing);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("18. retry after successful DB insert does not delete Storage object or emit duplicate Inngest event", async () => {
      // First call simulates initial success
      const firstReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
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

      const firstRes = await finalizePOST(firstReq, {
        params: Promise.resolve({ projectId: validProjectId }),
      });
      expect(firstRes.status).toBe(201);
      expect(mockInngestSend).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Simulate a retry caused by a dropped network response: material already in DB
      mockExistingMaterial = {
        id: validMaterialId,
        project_id: validProjectId,
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        file_path: validFilePath,
        file_type: "application/pdf",
        status: "queued",
      };
      mockInngestSend.mockClear();
      mockInsert.mockClear();
      mockStorageRemove.mockClear();

      const retryReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
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

      const retryRes = await finalizePOST(retryReq, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(retryRes.status).toBe(200);
      const retryJson = await retryRes.json();
      expect(retryJson.material.id).toBe(validMaterialId);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("19. safe cleanup preserves Storage object if DB insert fails but referencing record exists", async () => {
      mockInsertSingle.mockResolvedValue({
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      });
      mockExistingMaterial = null; // simulate slipped past first check
      mockReferencingMaterial = {
        id: validMaterialId,
        project_id: validProjectId,
        user_id: "user_test_abc",
        file_name: "lecture.pdf",
        file_path: validFilePath,
        status: "queued",
      };

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

      expect(res.status).toBe(200);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("20. explicit safe-cleanup DELETE contract cleans up orphaned storage object when unreferenced", async () => {
      mockReferencingMaterial = null;

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          filePath: validFilePath,
        }),
      });

      const res = await finalizeDELETE(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockStorageRemove).toHaveBeenCalledWith([validFilePath]);
    });

    it("21. explicit safe-cleanup DELETE contract rejects deletion when storage object is referenced (409)", async () => {
      mockReferencingMaterial = { id: validMaterialId, file_path: validFilePath };

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: validMaterialId,
          filePath: validFilePath,
        }),
      });

      const res = await finalizeDELETE(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("referenced by an existing material record");
      expect(mockStorageRemove).not.toHaveBeenCalled();
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

  // ── Step D: Filename and Path Traversal Validation Regression Tests ──────────

  describe("Filename and Path Traversal Validation", () => {
    it("accepts valid filename with consecutive dots: lecture..pdf", async () => {
      expect(isSafeFileName("lecture..pdf")).toBe(true);

      const filePath = `user_test_abc/${validProjectId}/${validMaterialId}/lecture..pdf`;
      expect(
        validateStoragePath({
          filePath,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "lecture..pdf",
        })
      ).toBe(true);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture..pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filePath).toContain("lecture..pdf");
    });

    it("accepts valid filename with consecutive dots: v1..notes.md", async () => {
      expect(isSafeFileName("v1..notes.md")).toBe(true);

      const filePath = `user_test_abc/${validProjectId}/${validMaterialId}/v1..notes.md`;
      expect(
        validateStoragePath({
          filePath,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "v1..notes.md",
        })
      ).toBe(true);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "v1..notes.md",
          fileType: "text/markdown",
          fileSize: 512,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filePath).toContain("v1..notes.md");
    });

    it("rejects '.' and '..' path segments", async () => {
      expect(isSafeFileName(".")).toBe(false);
      expect(isSafeFileName("..")).toBe(false);

      expect(
        validateStoragePath({
          filePath: `user_test_abc/${validProjectId}/${validMaterialId}/.`,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
        })
      ).toBe(false);

      expect(
        validateStoragePath({
          filePath: `user_test_abc/${validProjectId}/${validMaterialId}/..`,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
        })
      ).toBe(false);

      expect(
        validateStoragePath({
          filePath: `user_test_abc/${validProjectId}/${validMaterialId}/../other/file.pdf`,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
        })
      ).toBe(false);

      const dotReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "..",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });
      const dotRes = await uploadUrlPOST(dotReq, {
        params: Promise.resolve({ projectId: validProjectId }),
      });
      expect(dotRes.status).toBe(400);
    });

    it("rejects '/' and '\\' in filenames", async () => {
      expect(isSafeFileName("folder/lecture.pdf")).toBe(false);
      expect(isSafeFileName("folder\\lecture.pdf")).toBe(false);
      expect(isSafeFileName("../lecture.pdf")).toBe(false);
      expect(isSafeFileName("..\\lecture.pdf")).toBe(false);

      expect(
        validateStoragePath({
          filePath: `user_test_abc/${validProjectId}/${validMaterialId}/sub/lecture.pdf`,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "sub/lecture.pdf",
        })
      ).toBe(false);

      expect(
        validateStoragePath({
          filePath: `user_test_abc/${validProjectId}/${validMaterialId}/sub\\lecture.pdf`,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "sub\\lecture.pdf",
        })
      ).toBe(false);

      // Upload URL rejects / in fileName
      const slashReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "sub/lecture.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });
      const slashRes = await uploadUrlPOST(slashReq, {
        params: Promise.resolve({ projectId: validProjectId }),
      });
      expect(slashRes.status).toBe(400);

      // Upload URL rejects \ in fileName
      const backslashReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "sub\\lecture.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });
      const backslashRes = await uploadUrlPOST(backslashReq, {
        params: Promise.resolve({ projectId: validProjectId }),
      });
      expect(backslashRes.status).toBe(400);
    });

    it("accepts valid filenames containing literal percent signs: lecture%notes.pdf", async () => {
      expect(isSafeFileName("lecture%notes.pdf")).toBe(true);

      const filePath = `user_test_abc/${validProjectId}/${validMaterialId}/lecture%notes.pdf`;
      expect(
        validateStoragePath({
          filePath,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "lecture%notes.pdf",
        })
      ).toBe(true);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "lecture%notes.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filePath).toContain("lecture%notes.pdf");
    });

    it("accepts valid filenames containing literal percent signs: 100%_accuracy.pdf", async () => {
      expect(isSafeFileName("100%_accuracy.pdf")).toBe(true);

      const filePath = `user_test_abc/${validProjectId}/${validMaterialId}/100%_accuracy.pdf`;
      expect(
        validateStoragePath({
          filePath,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "100%_accuracy.pdf",
        })
      ).toBe(true);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "100%_accuracy.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filePath).toContain("100%_accuracy.pdf");
    });

    it("accepts valid filenames containing literal percent signs: chapter%2.pdf", async () => {
      expect(isSafeFileName("chapter%2.pdf")).toBe(true);

      const filePath = `user_test_abc/${validProjectId}/${validMaterialId}/chapter%2.pdf`;
      expect(
        validateStoragePath({
          filePath,
          userId: "user_test_abc",
          projectId: validProjectId,
          materialId: validMaterialId,
          fileName: "chapter%2.pdf",
        })
      ).toBe(true);

      const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "chapter%2.pdf",
          fileType: "application/pdf",
          fileSize: 4096,
        }),
      });

      const res = await uploadUrlPOST(req, {
        params: Promise.resolve({ projectId: validProjectId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filePath).toContain("chapter%2.pdf");
    });

    it("rejects encoded path separators and encoded traversal sequences", () => {
      expect(isSafeFileName("lecture%2fnotes.pdf")).toBe(false);
      expect(isSafeFileName("lecture%2Fnotes.pdf")).toBe(false);
      expect(isSafeFileName("lecture%5cnotes.pdf")).toBe(false);
      expect(isSafeFileName("lecture%5Cnotes.pdf")).toBe(false);
      expect(isSafeFileName("lecture%252fnotes.pdf")).toBe(false);
      expect(isSafeFileName("%2e%2e")).toBe(false);
      expect(isSafeFileName("%2e")).toBe(false);
      expect(isSafeFileName(".%2e")).toBe(false);
      expect(isSafeFileName("%2e.")).toBe(false);
      expect(isSafeFileName("%252e%252e")).toBe(false);
      expect(isSafeFileName("null%00byte.pdf")).toBe(false);
    });
  });

  // ── Step E: PostgREST Filter-Special Character Finalization & Idempotency ───

  describe("PostgREST Filter-Special Characters in Filenames", () => {
    const specialFilenames = [
      "report,final.pdf",
      "report(final).pdf",
      "report%20final.pdf",
      "report&notes.pdf",
    ];

    for (const specialFileName of specialFilenames) {
      describe(`Filename: "${specialFileName}"`, () => {
        const specialFilePath = `user_test_abc/${validProjectId}/${validMaterialId}/${specialFileName}`;

        it("initial finalization works correctly without PostgREST filter parsing breakage", async () => {
          mockInsertSingle.mockResolvedValue({
            data: {
              id: validMaterialId,
              project_id: validProjectId,
              user_id: "user_test_abc",
              file_name: specialFileName,
              file_path: specialFilePath,
              file_type: "application/pdf",
              status: "queued",
              size_bytes: 1024,
            },
            error: null,
          });

          const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: validMaterialId,
              fileName: specialFileName,
              filePath: specialFilePath,
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
              file_name: specialFileName,
              file_path: specialFilePath,
            })
          );
          expect(mockInngestSend).toHaveBeenCalledTimes(1);
        });

        it("idempotency lookup finds existing material on retry and does not create duplicate", async () => {
          const existing = {
            id: validMaterialId,
            project_id: validProjectId,
            user_id: "user_test_abc",
            file_name: specialFileName,
            file_path: specialFilePath,
            file_type: "application/pdf",
            status: "ready",
            size_bytes: 1024,
          };
          mockExistingMaterial = existing;

          const req = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: validMaterialId,
              fileName: specialFileName,
              filePath: specialFilePath,
              fileType: "application/pdf",
              fileSize: 1024,
            }),
          });

          const res = await finalizePOST(req, {
            params: Promise.resolve({ projectId: validProjectId }),
          });

          expect(res.status).toBe(200);
          const json = await res.json();
          expect(json.material.id).toBe(validMaterialId);
          expect(mockInsert).not.toHaveBeenCalled();
          expect(mockStorageRemove).not.toHaveBeenCalled();
          expect(mockInngestSend).not.toHaveBeenCalled();
        });

        it("referenced Storage object is never deleted when record exists", async () => {
          // If DB insert fails because material already exists (concurrent insert or constraint violation)
          mockInsertSingle.mockResolvedValue({
            data: null,
            error: { message: "duplicate key value violates unique constraint" },
          });
          mockExistingMaterial = null;
          mockReferencingMaterial = {
            id: validMaterialId,
            project_id: validProjectId,
            user_id: "user_test_abc",
            file_name: specialFileName,
            file_path: specialFilePath,
            status: "queued",
          };

          const postReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: validMaterialId,
              fileName: specialFileName,
              filePath: specialFilePath,
              fileType: "application/pdf",
              fileSize: 1024,
            }),
          });

          const postRes = await finalizePOST(postReq, {
            params: Promise.resolve({ projectId: validProjectId }),
          });

          expect(postRes.status).toBe(200);
          expect(mockStorageRemove).not.toHaveBeenCalled();

          // And DELETE request must reject with 409 and not delete
          const deleteReq = new Request(`http://localhost/api/projects/${validProjectId}/materials/finalize`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: validMaterialId,
              filePath: specialFilePath,
            }),
          });

          const deleteRes = await finalizeDELETE(deleteReq, {
            params: Promise.resolve({ projectId: validProjectId }),
          });

          expect(deleteRes.status).toBe(409);
          expect(mockStorageRemove).not.toHaveBeenCalled();
        });
      });
    }
  });
});

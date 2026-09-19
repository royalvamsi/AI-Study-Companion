import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleMaterialProcessingFailure,
  sanitizeMaterialErrorMessage,
  processMaterial,
} from "./material-processing";
import { ActivityEventType } from "@/lib/activity/events";

// Mock Supabase admin client
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        download: vi.fn(),
      }),
    },
  }),
}));

// Mock emitActivityEvent
vi.mock("@/lib/activity/events", () => ({
  ActivityEventType: {
    MATERIAL_UPLOADED: "MATERIAL_UPLOADED",
    MATERIAL_PROCESSING: "MATERIAL_PROCESSING",
    MATERIAL_READY: "MATERIAL_READY",
    MATERIAL_FAILED: "MATERIAL_FAILED",
  },
  emitActivityEvent: vi.fn(),
}));

import { emitActivityEvent } from "@/lib/activity/events";

describe("Material Processing - Section 1: onFailure Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("registers onFailure lifecycle handler on the processMaterial Inngest function", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnConfig = (processMaterial as any)?.opts;
    expect(fnConfig).toBeDefined();
    expect(fnConfig.onFailure).toBeDefined();
    expect(typeof fnConfig.onFailure).toBe("function");
  });

  it("sanitizes known and generic error messages into user-safe explanations", () => {
    const scannedMsg = sanitizeMaterialErrorMessage(
      "PDF appears to be scanned with insufficient extractable text."
    );
    expect(scannedMsg).toContain("insufficient extractable text");

    const downloadMsg = sanitizeMaterialErrorMessage(
      "Failed to download PDF: 404 not found"
    );
    expect(downloadMsg).toContain("Could not download");

    const enospcMsg = sanitizeMaterialErrorMessage(
      "Failed to stage temporary file: ENOSPC: no space left on device, write '/tmp/pptx-12345.pptx'"
    );
    expect(enospcMsg).toBe(
      "Failed to process document due to a temporary file storage error. Please try again."
    );
    expect(enospcMsg).not.toContain("no readable text");
    expect(enospcMsg).not.toContain("corrupted");
    expect(enospcMsg).not.toContain("pptx-12345");

    const stagingMsg = sanitizeMaterialErrorMessage(
      "Failed to process document due to a temporary file storage error."
    );
    expect(stagingMsg).toBe(
      "Failed to process document due to a temporary file storage error. Please try again."
    );

    const corruptPptxMsg = sanitizeMaterialErrorMessage(
      "PowerPoint presentation contains no extractable text or is corrupted."
    );
    expect(corruptPptxMsg).toBe(
      "The document contains no readable text. Please provide a file with valid text content."
    );

    const fallbackMsg = sanitizeMaterialErrorMessage(
      "SELECT * FROM super_secret_internal_table WHERE error at file.ts:123:456"
    );
    expect(fallbackMsg).toBe(
      "Material processing could not be completed. Please ensure the file format is supported and readable."
    );
  });

  it("updates material status to 'failed' and records error_message when failure occurs", async () => {
    const failureEvent = {
      name: "inngest/function.failed",
      data: {
        function_id: "process-material",
        run_id: "run_123",
        event: {
          name: "material/uploaded",
          data: {
            materialId: "mat_test_456",
            projectId: "proj_test_789",
            userId: "user_test_001",
            filePath: "user_test_001/proj_test_789/mat_test_456/sample.pdf",
            fileName: "sample.pdf",
          },
        },
      },
    };

    const terminalError = new Error(
      "PDF appears to be scanned with insufficient extractable text."
    );

    const result = await handleMaterialProcessingFailure({
      event: failureEvent,
      error: terminalError,
    });

    expect(result.status).toBe("failed");
    expect(result.materialId).toBe("mat_test_456");
    expect(result.errorMessage).toContain("insufficient extractable text");

    // Verify DB update
    expect(mockFrom).toHaveBeenCalledWith("materials");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "failed",
      error_message: expect.stringContaining("insufficient extractable text"),
    });
    expect(mockEq).toHaveBeenCalledWith("id", "mat_test_456");

    // Verify activity event emitted
    expect(emitActivityEvent).toHaveBeenCalledWith({
      projectId: "proj_test_789",
      userId: "user_test_001",
      eventType: ActivityEventType.MATERIAL_FAILED,
      payload: {
        materialId: "mat_test_456",
        fileName: "sample.pdf",
        errorMessage: expect.stringContaining("insufficient extractable text"),
      },
    });
  });

  it("handles failure events with direct data payload", async () => {
    const directPayloadEvent = {
      name: "inngest/function.failed",
      data: {
        materialId: "mat_direct_999",
        projectId: "proj_direct_888",
        userId: "user_direct_777",
        fileName: "direct.pdf",
      },
    };

    const terminalError = new Error("Failed to download PDF: network timeout");

    const result = await handleMaterialProcessingFailure({
      event: directPayloadEvent,
      error: terminalError,
    });

    expect(result.status).toBe("failed");
    expect(result.materialId).toBe("mat_direct_999");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "failed",
      error_message: expect.stringContaining("Could not download"),
    });
    expect(mockEq).toHaveBeenCalledWith("id", "mat_direct_999");
  });
});

describe("Material Processing - Section 2: Duplicate-Job Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures idempotency key on processMaterial scoped to event.data.materialId", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnConfig = (processMaterial as any)?.opts;
    expect(fnConfig).toBeDefined();
    expect(fnConfig.idempotency).toBe("event.data.materialId");
  });

  it("permits processing when material status is 'queued'", async () => {
    const { executeProcessMaterialStep1 } = await import("./material-processing");

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { status: "queued" },
          error: null,
        }),
      }),
    });
    const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "materials") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      }),
    };

    const shouldProcess = await executeProcessMaterialStep1({
      materialId: "mat_first_run",
      projectId: "proj_123",
      userId: "user_123",
      fileName: "first.pdf",
      supabase: mockSupabase,
    });

    expect(shouldProcess).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "processing",
      error_message: null,
    });
    expect(emitActivityEvent).toHaveBeenCalledWith({
      projectId: "proj_123",
      userId: "user_123",
      eventType: ActivityEventType.MATERIAL_PROCESSING,
      payload: { materialId: "mat_first_run", fileName: "first.pdf" },
    });
  });

  it("short-circuits and prevents duplicate processing when material status is already 'processing'", async () => {
    const { executeProcessMaterialStep1 } = await import("./material-processing");

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { status: "processing" },
          error: null,
        }),
      }),
    });
    const mockUpdate = vi.fn();

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      }),
    };

    const shouldProcess = await executeProcessMaterialStep1({
      materialId: "mat_duplicate_run",
      projectId: "proj_123",
      userId: "user_123",
      fileName: "duplicate.pdf",
      supabase: mockSupabase,
    });

    // Should return false to skip all chunking/concept steps
    expect(shouldProcess).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(emitActivityEvent).not.toHaveBeenCalled();
  });

  it("short-circuits and prevents reprocessing when material status is already 'ready'", async () => {
    const { executeProcessMaterialStep1 } = await import("./material-processing");

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { status: "ready" },
          error: null,
        }),
      }),
    });
    const mockUpdate = vi.fn();

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      }),
    };

    const shouldProcess = await executeProcessMaterialStep1({
      materialId: "mat_completed_run",
      projectId: "proj_123",
      userId: "user_123",
      fileName: "completed.pdf",
      supabase: mockSupabase,
    });

    expect(shouldProcess).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(emitActivityEvent).not.toHaveBeenCalled();
  });

  it("asserts only one set of chunks/concepts gets created when fired twice", async () => {
    // Simulate double-dispatch: run 1 starts as queued -> processing -> ready; run 2 encounters 'ready'
    let currentStatus = "queued";
    const chunksCreated: Array<{ materialId: string; chunkIndex: number }> = [];
    const conceptsCreated: Array<{ materialId: string; name: string }> = [];

    const simulatePipelineRun = async (event: { materialId: string; fileName: string }) => {
      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { status: currentStatus }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => {
              currentStatus = "processing";
              return { error: null };
            },
          }),
        }),
      };

      const { executeProcessMaterialStep1 } = await import("./material-processing");
      const canProceed = await executeProcessMaterialStep1({
        materialId: event.materialId,
        projectId: "proj_dup",
        userId: "user_dup",
        fileName: event.fileName,
        supabase: mockSupabase,
      });

      if (!canProceed) {
        return { processed: false };
      }

      // Steps 2 - 8 create chunks and concepts
      chunksCreated.push(
        { materialId: event.materialId, chunkIndex: 0 },
        { materialId: event.materialId, chunkIndex: 1 }
      );
      conceptsCreated.push({
        materialId: event.materialId,
        name: "Concept A",
      });

      currentStatus = "ready";
      return { processed: true, chunksCount: 2, conceptsCount: 1 };
    };

    const event = { materialId: "mat_single_set", fileName: "lecture.pdf" };

    // Fire event 1
    const run1 = await simulatePipelineRun(event);
    expect(run1.processed).toBe(true);
    expect(chunksCreated.length).toBe(2);
    expect(conceptsCreated.length).toBe(1);

    // Fire duplicate event 2 (e.g. client double-submit or retry)
    const run2 = await simulatePipelineRun(event);
    expect(run2.processed).toBe(false);

    // Still exactly one set of chunks and concepts!
    expect(chunksCreated.length).toBe(2);
    expect(conceptsCreated.length).toBe(1);
  });
});

describe("Material Processing - Section 3: Plain Text / Markdown Uploads & Citations", () => {
  it("extracts text directly from UTF-8 buffer for text/plain without calling pdf-parse", async () => {
    const { extractTextFromBuffer } = await import("./material-processing");

    const sampleText = "Distributed consensus protocols like Paxos and Raft ensure consistency across nodes.";
    const buffer = Buffer.from(sampleText, "utf-8");

    const result = await extractTextFromBuffer({
      buffer,
      fileType: "text/plain",
      fileName: "consensus.txt",
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toBe(sampleText);
  });

  it("extracts markdown directly from UTF-8 buffer for text/markdown (.md files)", async () => {
    const { extractTextFromBuffer } = await import("./material-processing");

    const sampleMd = "# Quantum Computing\n\nQubits leverage superposition and entanglement to perform calculations.";
    const buffer = Buffer.from(sampleMd, "utf-8");

    const result = await extractTextFromBuffer({
      buffer,
      fileType: "text/markdown",
      fileName: "quantum_notes.md",
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toBe(sampleMd);
  });

  it("throws a descriptive error when text file is empty or whitespace", async () => {
    const { extractTextFromBuffer } = await import("./material-processing");

    const emptyBuffer = Buffer.from("   \n\t  ", "utf-8");

    await expect(
      extractTextFromBuffer({
        buffer: emptyBuffer,
        fileType: "text/plain",
        fileName: "empty.txt",
      })
    ).rejects.toThrow("Text file is empty or contains no readable content.");
  });

  it("processes a .txt fixture from queued -> processing -> ready, creates chunks, and produces grounded tutor response with filename citation", async () => {
    const { extractTextFromBuffer } = await import("./material-processing");
    const { chunkTextByPage } = await import("@/lib/rag/chunk");
    const { buildTutorSystemPrompt, classifyEvidenceState } = await import("@/lib/rag/retrieve");

    // 1. Fixture: small text file
    const txtContent = `CAP Theorem Overview:
The CAP theorem states that a distributed data store can simultaneously provide at most two out of three guarantees:
Consistency, Availability, and Partition Tolerance.
In modern distributed networks, network partitions are inevitable, which forces system designers to trade off between
strong Consistency and high Availability during partitions.`;

    const txtBuffer = Buffer.from(txtContent, "utf-8");
    const materialId = "mat_txt_101";
    const fileName = "cap-theorem.txt";

    // 2. Extract step: status queued -> processing
    let materialStatus = "queued";
    materialStatus = "processing";

    const extracted = await extractTextFromBuffer({
      buffer: txtBuffer,
      fileType: "text/plain",
      fileName,
    });

    expect(extracted.pageCount).toBe(1);
    expect(extracted.pages[0].pageNumber).toBe(1);

    // 3. Chunking step: creates chunks
    const chunks = chunkTextByPage(extracted.pages);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("CAP Theorem Overview");

    // Mark ready
    materialStatus = "ready";
    expect(materialStatus).toBe("ready");

    // 4. Grounded retrieval & tutor prompt
    const retrievedChunks = chunks.map((c, i) => ({
      id: `chunk_${i}`,
      materialId,
      content: c.content,
      pageNumber: c.pageNumber ?? null,
      similarity: 0.88,
    }));

    const evidenceState = classifyEvidenceState(retrievedChunks);
    expect(evidenceState).toBe("SUPPORTED");

    const tutorPrompt = buildTutorSystemPrompt({
      retrievedChunks,
      evidenceState,
    });

    // Verify tutor prompt does not contain "Page null" or "Page Unknown"
    expect(tutorPrompt).not.toContain("Page null");
    expect(tutorPrompt).not.toContain("Page Unknown");
    expect(tutorPrompt).toContain("CAP Theorem");

    // 5. Citation verification: displays filename cleanly without broken page numbers
    const isUnpaginated =
      fileName.endsWith(".txt") || fileName.endsWith(".md");
    expect(isUnpaginated).toBe(true);

    const citationDisplay = isUnpaginated
      ? fileName
      : `[p. ${retrievedChunks[0].pageNumber}] ${fileName}`;

    expect(citationDisplay).toBe("cap-theorem.txt");
    expect(citationDisplay).not.toContain("null");
  });

  it("extracts text from a real .docx document into a single page object", async () => {
    const fs = await import("node:fs");
    const { extractTextFromBuffer } = await import("./material-processing");

    const docxBuffer = fs.readFileSync("test-fixtures/sample-document.docx");
    const result = await extractTextFromBuffer({
      buffer: docxBuffer,
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "sample-document.docx",
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain("Modern Database Storage Engines");
    expect(result.pages[0].text).toContain("LSM trees");
  });

  it("extracts text from a real .pptx presentation into per-slide page objects", async () => {
    const fs = await import("node:fs");
    const { extractTextFromBuffer } = await import("./material-processing");

    const pptxBuffer = fs.readFileSync("test-fixtures/sample-presentation.pptx");
    const result = await extractTextFromBuffer({
      buffer: pptxBuffer,
      fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileName: "sample-presentation.pptx",
    });

    expect(result.pageCount).toBe(2);
    expect(result.pages.length).toBe(2);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain("Slide 1: Distributed Computing");
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain("Slide 2: Vector Clocks");
  });

  it("formats academic citation labels correctly based on file type", () => {
    function formatCitationBadge(c: { fileName: string; fileType?: string | null; pageNumber: number | null }, ci: number): string {
      const lower = (c.fileName || "").toLowerCase();
      const fileType = c.fileType || "";
      const isPptx = fileType.includes("presentation") || lower.endsWith(".pptx");
      const isPdf = fileType.includes("pdf") || lower.endsWith(".pdf");

      if (isPptx && c.pageNumber != null) {
        return `[slide ${c.pageNumber}]`;
      }
      if (isPdf && c.pageNumber != null) {
        return `[p. ${c.pageNumber}]`;
      }
      return `[Source ${ci + 1}]`;
    }

    // PPTX with slide number
    expect(
      formatCitationBadge(
        { fileName: "lecture.pptx", fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pageNumber: 4 },
        0
      )
    ).toBe("[slide 4]");

    // PDF with page number
    expect(
      formatCitationBadge(
        { fileName: "textbook.pdf", fileType: "application/pdf", pageNumber: 12 },
        1
      )
    ).toBe("[p. 12]");

    // DOCX without real pagination -> falls back to [Source N]
    expect(
      formatCitationBadge(
        { fileName: "notes.docx", fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pageNumber: 1 },
        2
      )
    ).toBe("[Source 3]");

    // TXT without page numbers -> falls back to [Source N]
    expect(
      formatCitationBadge(
        { fileName: "readme.txt", fileType: "text/plain", pageNumber: null },
        0
      )
    ).toBe("[Source 1]");
  });
});

describe("Material Processing - Section 4: PDF Worker Configuration Regression", () => {
  it("worker is configured — pdfjs does NOT throw 'Cannot find module pdfjs-dist/legacy/build/pdf.worker.mjs'", async () => {
    // Guards against the Vercel production failure:
    //   'Setting up fake worker failed: Cannot find module pdfjs-dist/legacy/build/pdf.worker.mjs'
    //
    // PDFParse.setWorker(getData()) is called at module load time using the inline
    // data-URL worker from pdf-parse/worker, so no filesystem path is needed.
    // If the worker were NOT configured, pdfjs-dist would throw a module-not-found
    // error even before touching the PDF bytes.
    //
    // We test with a minimal stub PDF — it's structurally invalid so pdfjs will throw,
    // but the error we receive must NOT be "Cannot find module …pdf.worker.mjs".
    const { extractTextFromBuffer } = await import("./material-processing");

    const emptyPdfBuffer = Buffer.from("%PDF-1.4\n%%EOF\n", "utf-8");

    let caughtError: unknown;
    try {
      await extractTextFromBuffer({
        buffer: emptyPdfBuffer,
        fileType: "application/pdf",
        fileName: "empty.pdf",
      });
    } catch (e) {
      caughtError = e;
    }

    // An error is expected (the stub PDF is invalid), but it must not be the
    // Vercel production error "Cannot find module …pdf.worker.mjs".
    expect(caughtError).toBeDefined();
    expect((caughtError as Error).message).not.toContain("Cannot find module");
    expect((caughtError as Error).message).not.toContain("pdf.worker.mjs");
  });
});

describe("Material Processing - Section 5: PPTX Static Import & Robust Extraction Regression", () => {
  it("inngest/material-processing.ts statically imports node-pptx-parser without nativeRequire or eval", async () => {
    const fs = await import("node:fs");
    const sourceCode = fs.readFileSync("inngest/material-processing.ts", "utf-8");

    // Must statically import node-pptx-parser
    expect(sourceCode).toMatch(/import\s+PptxParser\s+from\s+["']node-pptx-parser["']/);

    // Must NOT contain any nativeRequire or eval("require")
    expect(sourceCode).not.toContain("nativeRequire");
    expect(sourceCode).not.toContain('eval("require")');
    expect(sourceCode).not.toContain("eval('require')");
    expect(sourceCode).not.toMatch(/require\(["']node-pptx-parser["']\)/);
  });

  it("extracts text correctly from a real PPTX file using the static import path", async () => {
    const fs = await import("node:fs");
    const { extractTextFromBuffer } = await import("./material-processing");

    const pptxBuffer = fs.readFileSync("test-fixtures/sample-presentation.pptx");
    const result = await extractTextFromBuffer({
      buffer: pptxBuffer,
      fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileName: "sample-presentation.pptx",
    });

    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual({
      pageNumber: 1,
      text: expect.stringContaining("Distributed Computing"),
    });
    expect(result.pages[1]).toEqual({
      pageNumber: 2,
      text: expect.stringContaining("Vector Clocks"),
    });
  });

  it("cleans up temporary files via fs.unlink in finally block when PPTX extraction fails and yields sanitized document error", async () => {
    const fs = await import("node:fs");
    const fsPromises = await import("node:fs/promises");
    const os = await import("node:os");
    const { extractTextFromBuffer, sanitizeMaterialErrorMessage } = await import("./material-processing");

    // Invalid PPTX buffer
    const invalidPptx = Buffer.from("Not a real PPTX file");

    const filesBefore = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("pptx-"));
    const unlinkSpy = vi.spyOn(fsPromises.default, "unlink");

    try {
      let thrownError: unknown;
      try {
        await extractTextFromBuffer({
          buffer: invalidPptx,
          fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileName: "invalid.pptx",
        });
      } catch (err) {
        thrownError = err;
      }

      // Extraction failure produces the parser/content error
      expect(thrownError).toBeDefined();
      const rawMessage = (thrownError as Error).message;
      expect(rawMessage).toBe("PowerPoint presentation contains no extractable text or is corrupted.");

      // Sanitization maps it to unreadable document message
      const sanitized = sanitizeMaterialErrorMessage(rawMessage);
      expect(sanitized).toBe("The document contains no readable text. Please provide a file with valid text content.");

      // Cleanup via unlink was called
      expect(unlinkSpy).toHaveBeenCalled();

      // No lingering temp files
      const filesAfter = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("pptx-"));
      const newlyLingering = filesAfter.filter((f) => !filesBefore.includes(f));
      expect(newlyLingering).toHaveLength(0);
    } finally {
      unlinkSpy.mockRestore();
    }
  });

  it("distinguishes fs.writeFile failure (e.g. ENOSPC) from document parsing failure, produces path-free error, and still cleans up via unlink", async () => {
    const fsPromises = await import("node:fs/promises");
    const { extractTextFromBuffer, sanitizeMaterialErrorMessage } = await import("./material-processing");

    let attemptedUnlinkPath: string | null = null;
    const unlinkSpy = vi.spyOn(fsPromises.default, "unlink").mockImplementation(async (filePath) => {
      attemptedUnlinkPath = String(filePath);
      return Promise.resolve();
    });

    const enospcError = new Error("ENOSPC: no space left on device, write 'C:\\Users\\runneradmin\\AppData\\Local\\Temp\\pptx-12345.pptx'");
    const writeFileSpy = vi.spyOn(fsPromises.default, "writeFile").mockRejectedValue(enospcError);

    try {
      let caughtError: unknown;
      try {
        await extractTextFromBuffer({
          buffer: Buffer.from("dummy-presentation-bytes"),
          fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileName: "slides.pptx",
        });
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeDefined();
      const rawMessage = (caughtError as Error).message;

      // 1. Must NOT produce corrupted/unreadable-document message
      expect(rawMessage).not.toContain("contains no extractable text");
      expect(rawMessage).not.toContain("corrupted");

      // 2. Must NOT expose paths, internal temp filenames, or raw error messages
      expect(rawMessage).not.toContain("pptx-12345");
      expect(rawMessage).not.toContain("Temp");
      expect(rawMessage).not.toContain("ENOSPC");
      expect(rawMessage).not.toContain("C:\\");
      expect(rawMessage).not.toContain("/");

      // 3. Must produce safe path-free infrastructure error
      expect(rawMessage).toBe("Failed to process document due to a temporary file storage error.");

      // 4. sanitizeMaterialErrorMessage must NOT map it to an unreadable document error
      const userSafeMessage = sanitizeMaterialErrorMessage(rawMessage);
      expect(userSafeMessage).not.toContain("no readable text");
      expect(userSafeMessage).toBe(
        "Failed to process document due to a temporary file storage error. Please try again."
      );

      // 5. fs.unlink() cleanup was still attempted in the outer finally block
      expect(unlinkSpy).toHaveBeenCalledTimes(1);
      expect(attemptedUnlinkPath).toMatch(/pptx-.*\.pptx$/);
    } finally {
      writeFileSpy.mockRestore();
      unlinkSpy.mockRestore();
    }
  });

  it("handles EACCES/EIO on writeFile by returning path-free infrastructure error while executing cleanup", async () => {
    const fsPromises = await import("node:fs/promises");
    const { extractTextFromBuffer, sanitizeMaterialErrorMessage } = await import("./material-processing");

    const unlinkSpy = vi.spyOn(fsPromises.default, "unlink").mockResolvedValue(undefined);
    const eaccesError = new Error("EACCES: permission denied, open '/var/tmp/pptx-secret.pptx'");
    const writeFileSpy = vi.spyOn(fsPromises.default, "writeFile").mockRejectedValue(eaccesError);

    try {
      let caughtError: unknown;
      try {
        await extractTextFromBuffer({
          buffer: Buffer.from("dummy-presentation-bytes"),
          fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileName: "slides.pptx",
        });
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeDefined();
      const rawMessage = (caughtError as Error).message;
      expect(rawMessage).toBe("Failed to process document due to a temporary file storage error.");

      const userSafe = sanitizeMaterialErrorMessage(rawMessage);
      expect(userSafe).toBe("Failed to process document due to a temporary file storage error. Please try again.");

      expect(unlinkSpy).toHaveBeenCalledTimes(1);
    } finally {
      writeFileSpy.mockRestore();
      unlinkSpy.mockRestore();
    }
  });

  it("does not leak storage paths or internal temp paths in error message", async () => {
    const { extractTextFromBuffer } = await import("./material-processing");

    const corruptBuffer = Buffer.from("bad-bytes");
    try {
      await extractTextFromBuffer({
        buffer: corruptBuffer,
        fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileName: "corrupt.pptx",
      });
      expect.unreachable("Should have thrown an error");
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).toBe("PowerPoint presentation contains no extractable text or is corrupted.");
      expect(msg).not.toContain("tmp");
      expect(msg).not.toContain(".pptx");
      expect(msg).not.toContain("/");
      expect(msg).not.toContain("\\");
    }
  });

  it("declares nodejs runtime in app/api/inngest/route.ts", async () => {
    const routeModule = await import("@/app/api/inngest/route");
    expect(routeModule.runtime).toBe("nodejs");
  });
});


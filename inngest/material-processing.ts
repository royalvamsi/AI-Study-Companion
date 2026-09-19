import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkTextByPage } from "@/lib/rag/chunk";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { extractConcepts } from "@/lib/documents/concepts";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";
import { PDFParse } from "pdf-parse";
import { getData as getPdfWorkerData } from "pdf-parse/worker";
import PptxParser from "node-pptx-parser";
import mammoth from "mammoth";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Polyfill browser globals required by pdfjs-dist / pdf-parse in Node runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(init?: any) {
      if (Array.isArray(init) && init.length === 6) {
        this.a = init[0]; this.b = init[1]; this.c = init[2];
        this.d = init[3]; this.e = init[4]; this.f = init[5];
      }
    }
    multiply() { return this; }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    translate() { return this; }
    translateSelf() { return this; }
    scale() { return this; }
    scaleSelf() { return this; }
    rotate() { return this; }
    rotateSelf() { return this; }
    invertSelf() { return this; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformPoint(p: any) { return p; }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).ImageData === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageData = class ImageDataPolyfill {};
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Path2D === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Path2D = class Path2DPolyfill {
    addPath() {}
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).DOMPoint === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMPoint = class DOMPointPolyfill {};
}

// Configure pdfjs worker using the inline data URL bundled inside pdf-parse/worker.
// getData() returns a self-contained "data:text/javascript;base64,..." string — the
// entire pdfjs worker is embedded inline, so no file-system path is needed and the
// worker is always available in serverless/Vercel deployments where
// pdfjs-dist/legacy/build/pdf.worker.mjs would otherwise be missing from the bundle.
PDFParse.setWorker(getPdfWorkerData());

export interface ProcessMaterialFailureParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any;
  error: Error;
}

export function sanitizeMaterialErrorMessage(rawMessage?: string): string {
  if (!rawMessage) {
    return "Material processing failed due to an unexpected error. Please verify the file and try again.";
  }
  if (rawMessage.includes("scanned with insufficient extractable text")) {
    return "This document appears to have insufficient extractable text (e.g. scanned image). Please upload a document with selectable text.";
  }
  if (rawMessage.includes("Failed to download")) {
    return "Could not download the file from storage. Please try re-uploading.";
  }
  if (
    rawMessage.includes("temporary file storage error") ||
    rawMessage.includes("ENOSPC") ||
    rawMessage.includes("EACCES") ||
    rawMessage.includes("EPERM") ||
    rawMessage.includes("EROFS") ||
    rawMessage.includes("EIO") ||
    rawMessage.includes("EMFILE") ||
    rawMessage.includes("EBUSY")
  ) {
    return "Failed to process document due to a temporary file storage error. Please try again.";
  }
  if (rawMessage.includes("Empty or corrupt text file") || rawMessage.includes("contains no extractable text")) {
    return "The document contains no readable text. Please provide a file with valid text content.";
  }
  if (rawMessage.length <= 250 && !rawMessage.includes("SELECT") && !rawMessage.includes("INSERT") && !rawMessage.includes("at ")) {
    return rawMessage;
  }
  return "Material processing could not be completed. Please ensure the file format is supported and readable.";
}

export async function handleMaterialProcessingFailure({
  event,
  error,
}: ProcessMaterialFailureParams): Promise<{ materialId?: string; status: string; errorMessage: string }> {
  // Server-side logging — never swallow the original error
  console.error("[processMaterial:onFailure] Material processing permanently failed:", error);

  const originalEvent = event?.data?.event;
  const eventData = (originalEvent?.data || event?.data || {}) as {
    materialId?: string;
    projectId?: string;
    userId?: string;
    fileName?: string;
    filePath?: string;
  };

  const { materialId, projectId, userId, fileName } = eventData;
  const userSafeMessage = sanitizeMaterialErrorMessage(error?.message);

  if (!materialId) {
    console.error("[processMaterial:onFailure] Cannot update material status: materialId not found in event payload", event);
    return { status: "failed", errorMessage: userSafeMessage };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  try {
    const { error: dbError } = await supabase
      .from("materials")
      .update({
        status: "failed",
        error_message: userSafeMessage,
      })
      .eq("id", materialId);

    if (dbError) {
      console.error(`[processMaterial:onFailure] Failed to update material ${materialId} to failed status:`, dbError);
    }
  } catch (dbErr) {
    console.error(`[processMaterial:onFailure] Exception updating material ${materialId}:`, dbErr);
  }

  if (userId) {
    try {
      await emitActivityEvent({
        projectId,
        userId,
        eventType: ActivityEventType.MATERIAL_FAILED,
        payload: {
          materialId,
          fileName: fileName || "document",
          errorMessage: userSafeMessage,
        },
      });
    } catch (activityErr) {
      console.error("[processMaterial:onFailure] Failed to emit MATERIAL_FAILED event:", activityErr);
    }
  }

  return { materialId, status: "failed", errorMessage: userSafeMessage };
}

export async function executeProcessMaterialStep1({
  materialId,
  projectId,
  userId,
  fileName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase,
}: {
  materialId: string;
  projectId: string;
  userId: string;
  fileName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}): Promise<boolean> {
  const query = supabase
    .from("materials")
    .select("status")
    .eq("id", materialId);

  const { data: existing, error: fetchError } =
    typeof query.maybeSingle === "function"
      ? await query.maybeSingle()
      : await query.single();

  if (fetchError || !existing) {
    console.warn(
      `[processMaterial] Skipping run for material ${materialId}; record not found or already deleted`
    );
    return false;
  }

  // Defensive check: short-circuit if already processing or ready
  if (existing.status === "processing" || existing.status === "ready") {
    console.warn(
      `[processMaterial] Skipping duplicate run for material ${materialId}; current status is '${existing.status}'`
    );
    return false;
  }

  await supabase
    .from("materials")
    .update({ status: "processing", error_message: null })
    .eq("id", materialId);

  await emitActivityEvent({
    projectId,
    userId,
    eventType: ActivityEventType.MATERIAL_PROCESSING,
    payload: { materialId, fileName },
  });

  return true;
}

export async function extractTextFromBuffer({
  buffer,
  fileType,
  fileName,
}: {
  buffer: Buffer;
  fileType: string;
  fileName: string;
}): Promise<{ pages: Array<{ text: string; pageNumber: number }>; pageCount: number }> {
  const lowerName = fileName.toLowerCase();
  const isTextOrMd =
    fileType === "text/plain" ||
    fileType === "text/markdown" ||
    fileType === "text/x-markdown" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown");

  if (isTextOrMd) {
    const fullText = buffer.toString("utf-8");
    if (fullText.trim().length === 0) {
      throw new Error("Text file is empty or contains no readable content.");
    }
    return {
      pages: [{ text: fullText, pageNumber: 1 }],
      pageCount: 1,
    };
  }

  // Word (.docx) extraction branch
  const isDocx =
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileType === "application/docx" ||
    lowerName.endsWith(".docx");

  if (isDocx) {
    const { value } = await mammoth.extractRawText({ buffer });
    const fullText = value ? value.trim() : "";
    if (fullText.length === 0) {
      throw new Error("Word document contains no extractable text.");
    }
    return {
      pages: [{ text: fullText, pageNumber: 1 }],
      pageCount: 1,
    };
  }

  // PowerPoint (.pptx) extraction branch (slide-level extraction)
  const isPptx =
    fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    fileType === "application/vnd.ms-powerpoint" ||
    fileType === "application/pptx" ||
    lowerName.endsWith(".pptx");

  if (isPptx) {
    const tempFilePath = path.join(
      os.tmpdir(),
      `pptx-${Date.now()}-${Math.random().toString(36).slice(2)}.pptx`
    );
    try {
      try {
        await fs.writeFile(tempFilePath, buffer);
      } catch (ioErr: unknown) {
        const ioMessage = ioErr instanceof Error ? ioErr.message : String(ioErr);
        console.error("[extractTextFromBuffer] Failed to stage PPTX temporary file:", ioMessage);
        throw new Error("Failed to process document due to a temporary file storage error.");
      }

      try {
        const ParserConstructor: typeof PptxParser =
          typeof PptxParser === "function"
            ? PptxParser
            : ((PptxParser as unknown as { default: typeof PptxParser }).default || PptxParser);
        const parser = new ParserConstructor(tempFilePath);
        const rawSlides = await parser.extractText();

        const pages: Array<{ text: string; pageNumber: number }> = [];
        let slideNum = 1;
        for (const slide of rawSlides) {
          const slideText = Array.isArray(slide.text)
            ? slide.text.join("\n").trim()
            : String(slide.text || "").trim();
          if (slideText.length > 0) {
            pages.push({ text: slideText, pageNumber: slideNum });
          }
          slideNum++;
        }

        if (pages.length === 0) {
          throw new Error("PowerPoint presentation contains no extractable text.");
        }

        return {
          pages,
          pageCount: rawSlides.length || pages.length,
        };
      } catch (parserErr: unknown) {
        if (parserErr instanceof Error && parserErr.message === "PowerPoint presentation contains no extractable text.") {
          throw parserErr;
        }
        const message = parserErr instanceof Error ? parserErr.message : String(parserErr);
        console.error("[extractTextFromBuffer] PPTX extraction failed:", message);
        throw new Error("PowerPoint presentation contains no extractable text or is corrupted.");
      }
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  // PDF extraction branch
  // PDFParse is imported statically at the top of the file; worker is already configured.
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  const pageCount = parsed.total || (parsed.pages?.length ?? 1);
  const fullText: string = parsed.text || "";

  const pages = (parsed.pages && parsed.pages.length > 0)
    ? parsed.pages.map((p: { text: string; num: number }) => ({
        text: p.text || "",
        pageNumber: p.num,
      }))
    : [{ text: fullText, pageNumber: 1 }];

  await parser.destroy();

  if (fullText.trim().length < 50) {
    throw new Error("PDF appears to be scanned with insufficient extractable text.");
  }

  return { pages, pageCount };
}

export const processMaterial = inngest.createFunction(
  {
    id: "process-material",
    name: "Process Material",
    retries: 3,
    idempotency: "event.data.materialId",
    throttle: { limit: 5, period: "1m" },
    triggers: [{ event: "material/uploaded" }],
    onFailure: async ({ event, error }) => {
      await handleMaterialProcessingFailure({ event, error });
    },
  },
  async ({ event, step }: { event: { data: { materialId: string; projectId: string; userId: string; filePath: string; fileName: string; fileType?: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T>; sendEvent: (id: string, event: { name: string; data: Record<string, unknown> }) => Promise<void> } }) => {
    const { materialId, projectId, userId, filePath, fileName } = event.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // ── Step 1: Mark as processing (with duplicate-job protection) ───────────
    const shouldProcess = await step.run("mark-processing", async () => {
      return executeProcessMaterialStep1({
        materialId,
        projectId,
        userId,
        fileName,
        supabase,
      });
    });

    if (!shouldProcess) {
      return {
        materialId,
        skipped: true,
        reason: "Material is already processing or ready",
      };
    }

    // ── Step 2: Download file & Extract text (PDF / TXT / MD) ─────────────
    const extractedPages = await step.run("extract-text", async () => {
      let resolvedFileType = event.data.fileType;
      if (!resolvedFileType) {
        const { data: matRecord } = await supabase
          .from("materials")
          .select("file_type")
          .eq("id", materialId)
          .single();
        resolvedFileType = matRecord?.file_type;
      }
      if (!resolvedFileType) {
        const lower = fileName.toLowerCase();
        if (lower.endsWith(".txt")) resolvedFileType = "text/plain";
        else if (lower.endsWith(".md") || lower.endsWith(".markdown")) resolvedFileType = "text/markdown";
        else if (lower.endsWith(".docx")) resolvedFileType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (lower.endsWith(".pptx")) resolvedFileType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        else resolvedFileType = "application/pdf";
      }

      const { data, error } = await supabase.storage
        .from("materials")
        .download(filePath);

      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const result = await extractTextFromBuffer({
        buffer: fileBuffer,
        fileType: resolvedFileType,
        fileName,
      });

      await supabase
        .from("materials")
        .update({ page_count: result.pageCount })
        .eq("id", materialId);

      return result;
    });

    // ── Step 3: Content & Structure Extraction (Chunking) ───────────────────
    const chunks = await step.run("chunk-text", async () => {
      return chunkTextByPage(extractedPages.pages);
    });

    // ── Step 4: Search/Retrieval Representation (Embeddings & Storage) ─────
    await step.run("generate-and-store-chunks", async () => {
      // Race condition protection: ensure material still exists before writing chunks
      const checkQuery = supabase.from("materials").select("id").eq("id", materialId);
      const { data: materialExists } =
        typeof checkQuery.maybeSingle === "function"
          ? await checkQuery.maybeSingle()
          : await checkQuery.single();

      if (!materialExists) {
        console.warn(`[processMaterial] Skipping chunk storage: material ${materialId} was deleted`);
        return;
      }

      const texts = chunks.map((c) => c.content);
      const embeddings = await generateEmbeddings(texts, { userId, projectId });

      const rows = chunks.map((chunk, i) => ({
        material_id: materialId,
        project_id: projectId,
        content: chunk.content,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber ?? null,
        embedding: embeddings[i],
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("material_chunks").insert(batch);
        if (error) throw new Error(`Failed to store chunks: ${error.message}`);
      }
    });

    // ── Step 7: Extract concepts via LLM ─────────────────────────────────────
    await step.run("extract-concepts", async () => {
      // Race condition protection: ensure material still exists before creating concepts
      const checkQuery = supabase.from("materials").select("id").eq("id", materialId);
      const { data: materialExists } =
        typeof checkQuery.maybeSingle === "function"
          ? await checkQuery.maybeSingle()
          : await checkQuery.single();

      if (!materialExists) {
        console.warn(`[processMaterial] Skipping concept extraction: material ${materialId} was deleted`);
        return;
      }

      const fullText = extractedPages.pages.map((p: { text: string; pageNumber: number }) => p.text).join("\n\n");
      const preview = fullText.slice(0, 8000);

      const concepts = await extractConcepts(preview, materialId, userId, projectId);

      if (concepts.length > 0) {
        const { error } = await supabase.from("concepts").insert(
          concepts.map((c) => ({
            project_id: projectId,
            name: c.name,
            description: c.description,
            source_material_id: materialId,
          }))
        );
        if (error) throw new Error(`Failed to store concepts: ${error.message}`);

        const { data: inserted } = await supabase
          .from("concepts")
          .select("id")
          .eq("project_id", projectId)
          .eq("source_material_id", materialId);

        if (inserted && inserted.length > 0) {
          await supabase.from("concept_mastery").upsert(
            inserted.map((c: { id: string }) => ({
              project_id: projectId,
              user_id: userId,
              concept_id: c.id,
              mastery_score: 0,
              assessment_count: 0,
            })),
            { onConflict: "project_id,user_id,concept_id", ignoreDuplicates: true }
          );
        }
      }
    });

    // ── Step 8: Mark ready ───────────────────────────────────────────────────
    await step.run("mark-ready", async () => {
      // Race condition protection: ensure material still exists before updating status
      const checkQuery = supabase.from("materials").select("id").eq("id", materialId);
      const { data: materialExists } =
        typeof checkQuery.maybeSingle === "function"
          ? await checkQuery.maybeSingle()
          : await checkQuery.single();

      if (!materialExists) {
        console.warn(`[processMaterial] Skipping mark-ready: material ${materialId} was deleted`);
        return;
      }

      await supabase
        .from("materials")
        .update({ status: "ready" })
        .eq("id", materialId);

      await emitActivityEvent({
        projectId,
        userId,
        eventType: ActivityEventType.MATERIAL_READY,
        payload: { materialId, fileName, chunkCount: chunks.length },
      });
    });

    return {
      materialId,
      chunks: chunks.length,
      pageCount: extractedPages.pageCount,
    };
  }
);

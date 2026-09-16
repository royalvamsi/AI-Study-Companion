import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkTextByPage } from "@/lib/rag/chunk";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { extractConcepts } from "@/lib/documents/concepts";
import { emitActivityEvent, ActivityEventType } from "@/lib/activity/events";

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

// Ensure pdfjsWorker is registered globally so pdfjs-dist avoids dynamic worker require in Next.js Turbopack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).pdfjsWorker === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeRequire = typeof (globalThis as any).__non_webpack_require__ === "function"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (globalThis as any).__non_webpack_require__
      : eval("require");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).pdfjsWorker = nativeRequire("pdfjs-dist/legacy/build/pdf.worker.mjs");
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createRequire } = require("node:module");
      const req = createRequire(process.cwd());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).pdfjsWorker = req("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } catch (e) {
      console.warn("Unable to preload pdfjsWorker:", e);
    }
  }
}

export const processMaterial = inngest.createFunction(
  {
    id: "process-material",
    name: "Process Material",
    retries: 3,
    throttle: { limit: 5, period: "1m" },
    triggers: [{ event: "material/uploaded" }],
  },
  async ({ event, step }: { event: { data: { materialId: string; projectId: string; userId: string; filePath: string; fileName: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T>; sendEvent: (id: string, event: { name: string; data: Record<string, unknown> }) => Promise<void> } }) => {
    const { materialId, projectId, userId, filePath, fileName } = event.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // ── Step 1: Mark as processing ───────────────────────────────────────────
    await step.run("mark-processing", async () => {
      await supabase
        .from("materials")
        .update({ status: "processing" })
        .eq("id", materialId);

      await emitActivityEvent({
        projectId,
        userId,
        eventType: ActivityEventType.MATERIAL_PROCESSING,
        payload: { materialId, fileName },
      });
    });

    // ── Step 2: Download PDF & Extract text (Processing / OCR) ─────────────
    const extractedPages = await step.run("extract-text", async () => {
      const { data, error } = await supabase.storage
        .from("materials")
        .download(filePath);

      if (error || !data) {
        throw new Error(`Failed to download PDF: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      // Lazy-load pdf-parse via native require at runtime so Turbopack does not bundle or rewrite internal worker imports
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nativeRequire = typeof (globalThis as any).__non_webpack_require__ === "function"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (globalThis as any).__non_webpack_require__
        : eval("require");
      const { PDFParse } = nativeRequire("pdf-parse");
      const parser = new PDFParse({ data: pdfBuffer });
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

      await supabase
        .from("materials")
        .update({ page_count: pageCount })
        .eq("id", materialId);

      return { pages, pageCount };
    });

    // ── Step 3: Content & Structure Extraction (Chunking) ───────────────────
    const chunks = await step.run("chunk-text", async () => {
      return chunkTextByPage(extractedPages.pages);
    });

    // ── Step 4: Search/Retrieval Representation (Embeddings & Storage) ─────
    await step.run("generate-and-store-chunks", async () => {
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

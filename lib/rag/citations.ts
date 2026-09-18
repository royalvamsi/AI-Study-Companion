import { createAdminClient } from "@/lib/supabase/admin";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

export interface Citation {
  materialId: string;
  fileName: string;
  pageNumber: number | null;
  excerpt: string;
  fileType?: string | null;
}

/**
 * Build citations from retrieved chunks by looking up material metadata.
 * Groups chunks by material and picks the most relevant excerpt per material.
 */
export async function buildCitations(
  chunks: RetrievedChunk[]
): Promise<Citation[]> {
  if (chunks.length === 0) return [];

  const supabase = createAdminClient();
  const materialIds = [...new Set(chunks.map((c) => c.materialId))];

  const { data: materialsRaw } = await supabase
    .from("materials")
    .select("id, file_name, file_type")
    .in("id", materialIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materials = materialsRaw as Array<{ id: string; file_name: string; file_type?: string | null }> | null;
  if (!materials) return [];

  const materialMap = new Map(
    materials.map((m) => [m.id, { fileName: m.file_name, fileType: m.file_type }])
  );

  // Group by material, pick the top chunk per material
  const byMaterial = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = byMaterial.get(chunk.materialId);
    if (!existing || chunk.similarity > existing.similarity) {
      byMaterial.set(chunk.materialId, chunk);
    }
  }

  return [...byMaterial.entries()].map(([materialId, chunk]) => {
    const meta = materialMap.get(materialId);
    return {
      materialId,
      fileName: meta?.fileName ?? "Unknown file",
      fileType: meta?.fileType ?? null,
      pageNumber: chunk.pageNumber,
      excerpt: chunk.content.slice(0, 200).trim() + "…",
    };
  });
}

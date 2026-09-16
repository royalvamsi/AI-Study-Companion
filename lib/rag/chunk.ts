/**
 * Text chunking utilities for PDF content.
 * Uses a sliding window with overlap to preserve context across chunk boundaries.
 */

const CHUNK_SIZE = 1000;       // characters per chunk
const CHUNK_OVERLAP = 200;     // overlap between chunks

export interface TextChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
}

/**
 * Split a long text into overlapping chunks suitable for embedding.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): TextChunk[] {
  const size = options?.chunkSize ?? CHUNK_SIZE;
  const overlap = options?.overlap ?? CHUNK_OVERLAP;
  const chunks: TextChunk[] = [];

  // Split on paragraph boundaries first to respect natural structure
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let buffer = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length <= size) {
      buffer += (buffer ? "\n\n" : "") + paragraph;
    } else {
      // Emit current buffer as a chunk
      if (buffer.trim()) {
        chunks.push({ content: buffer.trim(), chunkIndex: chunkIndex++ });
      }
      // Start new buffer with overlap from end of previous buffer
      const overlapText = buffer.slice(-overlap);
      buffer = overlapText + (overlapText ? "\n\n" : "") + paragraph;
    }
  }

  // Emit any remaining buffer
  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), chunkIndex: chunkIndex++ });
  }

  return chunks;
}

/**
 * Split text that has been extracted page-by-page.
 * Each page's text is chunked separately, preserving page numbers.
 */
export function chunkTextByPage(
  pages: Array<{ text: string; pageNumber: number }>
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    if (!page.text.trim()) continue;
    const pageChunks = chunkText(page.text);
    for (const chunk of pageChunks) {
      chunks.push({
        content: chunk.content,
        chunkIndex: globalIndex++,
        pageNumber: page.pageNumber,
      });
    }
  }

  return chunks;
}

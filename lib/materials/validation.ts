/**
 * Material file validation constants and canonical helpers.
 * Supported: PDF, Word (.docx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt).
 * Maximum size: 50MB.
 */

export const MAX_MATERIAL_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const CANONICAL_MIME_TYPES = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  MARKDOWN: "text/markdown",
  TEXT: "text/plain",
} as const;

export const ALLOWED_MIME_TYPES: string[] = [
  CANONICAL_MIME_TYPES.PDF,
  CANONICAL_MIME_TYPES.DOCX,
  CANONICAL_MIME_TYPES.PPTX,
  CANONICAL_MIME_TYPES.MARKDOWN,
  CANONICAL_MIME_TYPES.TEXT,
  // Common browser reported variants
  "application/docx",
  "application/vnd.ms-powerpoint",
  "application/pptx",
  "text/x-markdown",
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a given string is a valid UUIDv4.
 */
export function isValidUUID(uuid?: string | null): boolean {
  if (!uuid || typeof uuid !== "string") return false;
  return UUID_REGEX.test(uuid);
}

/**
 * Resolves canonical MIME type from fileName and/or browser-supplied mimeType.
 * Handles cases where browsers report empty or non-standard MIME types for .docx/.pptx/.md.
 */
export function resolveCanonicalFileType(fileName: string, mimeType?: string): string | null {
  if (!fileName || typeof fileName !== "string") return null;
  const lowerName = fileName.toLowerCase().trim();
  const normalizedMime = (mimeType || "").toLowerCase().trim();

  // 1. PDF
  if (normalizedMime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return CANONICAL_MIME_TYPES.PDF;
  }

  // 2. Word (.docx)
  if (
    normalizedMime === CANONICAL_MIME_TYPES.DOCX ||
    normalizedMime === "application/docx" ||
    lowerName.endsWith(".docx")
  ) {
    return CANONICAL_MIME_TYPES.DOCX;
  }

  // 3. PowerPoint (.pptx)
  if (
    normalizedMime === CANONICAL_MIME_TYPES.PPTX ||
    normalizedMime === "application/vnd.ms-powerpoint" ||
    normalizedMime === "application/pptx" ||
    lowerName.endsWith(".pptx")
  ) {
    return CANONICAL_MIME_TYPES.PPTX;
  }

  // 4. Markdown (.md / .markdown)
  if (
    normalizedMime === "text/markdown" ||
    normalizedMime === "text/x-markdown" ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown")
  ) {
    return CANONICAL_MIME_TYPES.MARKDOWN;
  }

  // 5. Plain text (.txt)
  if (
    normalizedMime === "text/plain" ||
    lowerName.endsWith(".txt")
  ) {
    return CANONICAL_MIME_TYPES.TEXT;
  }

  return null;
}

/**
 * Validates that a filename is safe against directory traversal:
 * - Rejects dangerous path segments such as "." and ".."
 * - Rejects "/" and "\" path separators
 * - Allows legitimate consecutive dots inside filenames (e.g. "lecture..pdf", "v1..notes.md")
 */
export function isSafeFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== "string") return false;
  const trimmed = fileName.trim();
  if (!trimmed) return false;

  // Reject "/" and "\" path separators
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;

  // Reject dangerous path segments "." and ".."
  if (trimmed === "." || trimmed === "..") return false;

  // Check URL-decoded representation to prevent encoded traversal (%2e%2e, %2f, %5c)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded.includes("/") || decoded.includes("\\")) return false;
    if (decoded === "." || decoded === "..") return false;
  } catch {
    return false;
  }

  return true;
}

/**
 * Generates the canonical storage path for study materials:
 * `${userId}/${projectId}/${materialId}/${cleanFileName}`
 */
export function generateStoragePath(
  userId: string,
  projectId: string,
  materialId: string,
  fileName: string
): string {
  const cleanName = fileName.replace(/[\\/]/g, "_").trim();
  return `${userId}/${projectId}/${materialId}/${cleanName}`;
}

/**
 * Validates that an uploaded storage path strictly matches the authorized user,
 * project, and material ID to prevent path traversal or cross-user overwrites.
 * Enforces strict 4-segment structure: `${userId}/${projectId}/${materialId}/${safeFileName}`.
 */
export function validateStoragePath({
  filePath,
  userId,
  projectId,
  materialId,
  fileName,
}: {
  filePath: string;
  userId: string;
  projectId: string;
  materialId: string;
  fileName?: string;
}): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  if (!isValidUUID(projectId) || !isValidUUID(materialId)) return false;

  // Reject backslashes anywhere in the storage path
  if (filePath.includes("\\")) return false;

  const parts = filePath.split("/");
  // Must strictly be 4 segments: userId / projectId / materialId / fileName
  if (parts.length !== 4) return false;

  // Reject empty segments or dangerous path traversal segments in any position
  for (const segment of parts) {
    if (!segment || segment === "." || segment === "..") {
      return false;
    }
  }

  const [pathUserId, pathProjectId, pathMaterialId, pathFileName] = parts;
  if (pathUserId !== userId) return false;
  if (pathProjectId !== projectId) return false;
  if (pathMaterialId !== materialId) return false;

  if (!isSafeFileName(pathFileName)) {
    return false;
  }

  if (fileName) {
    if (!isSafeFileName(fileName)) {
      return false;
    }
    const cleanExpectedName = fileName.replace(/[\\/]/g, "_").trim();
    if (pathFileName !== cleanExpectedName && pathFileName !== fileName) {
      return false;
    }
  }

  return true;
}

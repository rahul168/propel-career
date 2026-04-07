import { extractDocumentText } from "./modifier";

/**
 * Extracts text from a DOCX buffer using the same XML-based extraction
 * that modifier.ts uses for text matching. This guarantees that
 * suggestion.original values returned by the AI are verbatim DOCX text,
 * enabling exact-match replacement.
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  return extractDocumentText(buffer);
}

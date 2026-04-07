import PizZip from "pizzip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Suggestion } from "@/types";

function findWTElements(node: any): any[] {
  const elements: any[] = [];
  if (node.nodeType === 1) {
    const ns = node.lookupNamespaceURI(node.prefix) || "";
    const localName = node.localName || (node.tagName && node.tagName.split(":").pop()) || "";

    if ((ns.includes("wordprocessingml") || node.prefix === "w") && localName === "t") {
      elements.push(node);
    }

    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        elements.push(...findWTElements(node.childNodes[i]));
      }
    }
  }
  return elements;
}

/**
 * Normalize text for fallback comparison — handles whitespace, quotes, dashes, ellipsis.
 * Used only for fallback matching, NOT for the actual replacement.
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019\u201C\u201D]/g, () => "'")
    .replace(/[""]/g, () => '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .trim()
    .toLowerCase();
}

/**
 * Extract all paragraphs from DOCX XML with their text content.
 * Includes empty-text paragraphs (structural spacers) so that paragraph indices
 * align with the joined text produced by extractDocumentText.
 */
function extractAllParagraphs(xmlContent: string): Array<{ paragraphNode: any; text: string; normalizedText: string }> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");
    const allNodes = doc.getElementsByTagName("*");
    const result: Array<{ paragraphNode: any; text: string; normalizedText: string }> = [];

    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      const localName = node.localName || node.tagName?.split(":").pop() || "";

      if ((node.prefix === "w" || node.tagName?.includes("wordprocessingml")) && localName === "p") {
        const textElements = findWTElements(node);
        const text = textElements.map((el: any) => el.textContent || "").join("");
        const normalized = normalizeText(text);
        result.push({ paragraphNode: node, text, normalizedText: normalized });
      }
    }

    return result;
  } catch (err) {
    console.error("[docx-modifier] Failed to extract paragraphs:", err);
    return [];
  }
}

/**
 * Export document text using the same XML extraction used for matching.
 * Guarantees that suggestion.original values returned by the AI are verbatim DOCX text,
 * enabling exact-match replacement in applyChangesToDOCX.
 */
export async function extractDocumentText(docxBuffer: Buffer): Promise<string> {
  const zip = new PizZip(docxBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Invalid DOCX: word/document.xml not found");
  const xmlContent = documentFile.asText();
  const paragraphs = extractAllParagraphs(xmlContent);
  return paragraphs.map(p => p.text).join("\n");
}

type ParagraphEntry = { paragraphNode: any; text: string; normalizedText: string };

/**
 * Find consecutive paragraphs matching a single line of search text.
 * Strategy: exact substring → normalized substring → word-overlap sliding window.
 */
function findSingleLineMatch(
  paragraphs: ParagraphEntry[],
  line: string
): { para: ParagraphEntry; matchScore: number } | null {
  // PRIMARY: exact substring
  for (const para of paragraphs) {
    if (para.text.includes(line)) {
      return { para, matchScore: 1.0 };
    }
  }

  // FALLBACK: normalized substring
  const normalizedLine = normalizeText(line);
  if (normalizedLine.length === 0) return null;

  for (const para of paragraphs) {
    if (para.normalizedText.includes(normalizedLine)) {
      return { para, matchScore: 0.95 };
    }
  }

  // LAST RESORT: word-overlap sliding window over paragraph words
  const searchWords = normalizedLine.split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length === 0) return null;

  let best: { para: ParagraphEntry; matchScore: number } | null = null;

  for (const para of paragraphs) {
    const paraWords = para.normalizedText.split(/\s+/).filter(w => w.length > 2);
    let maxScore = 0;

    for (let pStart = 0; pStart <= paraWords.length - searchWords.length; pStart++) {
      let matched = 0;
      for (let j = 0; j < searchWords.length; j++) {
        if (paraWords[pStart + j] === searchWords[j]) matched++;
      }
      const score = matched / searchWords.length;
      if (score > maxScore) maxScore = score;
    }

    if (maxScore >= 0.8 && (!best || maxScore > best.matchScore)) {
      best = { para, matchScore: maxScore };
    }
  }

  return best;
}

/**
 * Find the paragraph(s) that match suggestion.original.
 *
 * If suggestion.original contains '\n' it spans multiple paragraphs (because
 * extractDocumentText joins paragraphs with '\n'). In that case we split on '\n'
 * and find a consecutive run of paragraphs whose text matches each line in order.
 *
 * Returns matched paragraphs paired with the corresponding replacement lines,
 * or null if no match is found.
 */
function findMatchingParagraphs(
  paragraphs: ParagraphEntry[],
  original: string,
  suggested: string
): Array<{ paragraphNode: any; originalLine: string; suggestedLine: string; matchScore: number }> | null {
  const originalLines = original.split("\n");
  const suggestedLines = suggested.split("\n");

  if (originalLines.length === 1) {
    // Single-paragraph suggestion
    const m = findSingleLineMatch(paragraphs, original);
    if (!m) return null;
    return [{ paragraphNode: m.para.paragraphNode, originalLine: original, suggestedLine: suggested, matchScore: m.matchScore }];
  }

  // Multi-paragraph suggestion: find a consecutive sequence of paragraphs
  // whose text matches each line of originalLines in order.

  // PRIMARY: exact match — paragraphs[i+j].text includes originalLines[j] for all j
  outer:
  for (let i = 0; i <= paragraphs.length - originalLines.length; i++) {
    for (let j = 0; j < originalLines.length; j++) {
      if (!paragraphs[i + j].text.includes(originalLines[j])) continue outer;
    }
    // All lines matched
    return originalLines.map((origLine, j) => ({
      paragraphNode: paragraphs[i + j].paragraphNode,
      originalLine: origLine,
      suggestedLine: suggestedLines[j] ?? "",
      matchScore: 1.0,
    }));
  }

  // FALLBACK: normalized match
  const normalizedLines = originalLines.map(normalizeText);
  outerNorm:
  for (let i = 0; i <= paragraphs.length - originalLines.length; i++) {
    for (let j = 0; j < originalLines.length; j++) {
      if (!paragraphs[i + j].normalizedText.includes(normalizedLines[j])) continue outerNorm;
    }
    console.log("[docx-modifier] Multi-paragraph match via normalized substring");
    return originalLines.map((origLine, j) => ({
      paragraphNode: paragraphs[i + j].paragraphNode,
      originalLine: origLine,
      suggestedLine: suggestedLines[j] ?? "",
      matchScore: 0.95,
    }));
  }

  console.warn(`[docx-modifier] Could not locate multi-paragraph suggestion: "${original.substring(0, 80)}"`);
  return null;
}

/**
 * Collect all <w:r> run nodes that are direct structural children of a paragraph.
 * Returns each run with its concatenated text and character offset within the paragraph.
 */
function collectRuns(paragraphNode: any): Array<{ runNode: any; text: string; start: number; end: number }> {
  const runs: Array<{ runNode: any; text: string; start: number; end: number }> = [];
  let pos = 0;

  for (let i = 0; i < paragraphNode.childNodes.length; i++) {
    const child = paragraphNode.childNodes[i];
    const localName = child.localName || child.tagName?.split(":").pop() || "";
    if ((child.prefix === "w" || child.tagName?.includes("wordprocessingml")) && localName === "r") {
      const textEls = findWTElements(child);
      const runText = textEls.map((el: any) => el.textContent || "").join("");
      runs.push({ runNode: child, text: runText, start: pos, end: pos + runText.length });
      pos += runText.length;
    }
  }

  return runs;
}

/**
 * Apply surgical run-level replacement that preserves formatting on untouched runs.
 *
 * - Runs fully before the match are left untouched.
 * - The first run that overlaps the match receives the replacement text (keeps its <w:rPr>).
 * - Subsequent runs fully within the match are removed.
 * - A run that straddles the match end has its leading matched portion trimmed.
 * - Runs fully after the match are left untouched.
 *
 * When matchScore < 1.0 (word-overlap fallback) the entire paragraph text is replaced.
 */
function applyReplacementToParagraph(
  paragraphNode: any,
  originalLine: string,
  replacementText: string,
  matchScore: number
): void {
  const runs = collectRuns(paragraphNode);
  const paraText = runs.map(r => r.text).join("");

  let matchStart = paraText.indexOf(originalLine);
  let effectiveOriginal = originalLine;

  if (matchStart === -1 && matchScore < 1.0) {
    // Normalized / word-overlap match — replace entire paragraph text
    matchStart = 0;
    effectiveOriginal = paraText;
  }

  if (matchStart === -1) {
    console.warn("[docx-modifier] Could not find original text in matched paragraph for replacement");
    return;
  }

  const matchEnd = matchStart + effectiveOriginal.length;
  const runsToRemove: any[] = [];
  let replacementApplied = false;

  for (const run of runs) {
    const runOverlapsMatch = run.end > matchStart && run.start < matchEnd;
    if (!runOverlapsMatch) continue;

    if (!replacementApplied) {
      const textEls = findWTElements(run.runNode);
      const prefixText = run.start < matchStart ? run.text.slice(0, matchStart - run.start) : "";
      const suffixText = run.end > matchEnd ? run.text.slice(matchEnd - run.start) : "";
      const newRunText = prefixText + replacementText + suffixText;

      if (textEls.length > 0) {
        textEls[0].textContent = newRunText;
        textEls[0].setAttribute("xml:space", "preserve");
        for (let i = 1; i < textEls.length; i++) textEls[i].textContent = "";
      } else {
        const doc = run.runNode.ownerDocument;
        const newTextEl = doc.createElement("w:t");
        newTextEl.setAttribute("xml:space", "preserve");
        newTextEl.textContent = newRunText;
        run.runNode.appendChild(newTextEl);
      }
      replacementApplied = true;
    } else {
      if (run.start >= matchStart && run.end <= matchEnd) {
        runsToRemove.push(run.runNode);
      } else if (run.start < matchEnd && run.end > matchEnd) {
        // Straddles match end — trim leading matched portion
        const textEls = findWTElements(run.runNode);
        const trimmedText = run.text.slice(matchEnd - run.start);
        if (textEls.length > 0) {
          textEls[0].textContent = trimmedText;
          textEls[0].setAttribute("xml:space", "preserve");
          for (let i = 1; i < textEls.length; i++) textEls[i].textContent = "";
        }
      }
    }
  }

  for (const runNode of runsToRemove) {
    runNode.parentNode?.removeChild(runNode);
  }

  if (!replacementApplied) {
    const doc = paragraphNode.ownerDocument;
    const newRun = doc.createElement("w:r");
    const newTextEl = doc.createElement("w:t");
    newTextEl.setAttribute("xml:space", "preserve");
    newTextEl.textContent = replacementText;
    newRun.appendChild(newTextEl);
    paragraphNode.appendChild(newRun);
  }
}

function applyOneSuggestion(xmlContent: string, suggestion: Suggestion): string {
  const paragraphs = extractAllParagraphs(xmlContent);

  if (paragraphs.length === 0) {
    console.warn("[docx-modifier] No paragraphs found in document");
    return xmlContent;
  }

  const matches = findMatchingParagraphs(paragraphs, suggestion.original, suggestion.suggested);

  if (!matches) {
    console.warn(
      `[docx-modifier] Could not locate suggestion: "${suggestion.original.substring(0, 80)}"`
    );
    return xmlContent;
  }

  for (const { paragraphNode, originalLine, suggestedLine, matchScore } of matches) {
    applyReplacementToParagraph(paragraphNode, originalLine, suggestedLine, matchScore);
  }

  try {
    const doc = paragraphs[0].paragraphNode.ownerDocument;
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch (err) {
    console.error("[docx-modifier] Serialization error:", err);
    return xmlContent;
  }
}

export async function applyChangesToDOCX(
  docxBase64: string,
  suggestions: Suggestion[]
): Promise<Buffer> {
  const docxBuffer = Buffer.from(docxBase64, "base64");

  const accepted = suggestions.filter((s) => s.accepted);
  if (accepted.length === 0) return docxBuffer;

  const zip = new PizZip(docxBuffer);

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Invalid DOCX: word/document.xml not found");

  let xmlContent = documentFile.asText();

  for (const suggestion of accepted) {
    xmlContent = applyOneSuggestion(xmlContent, suggestion);
  }

  zip.file("word/document.xml", xmlContent);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * generate-resume/route.test.ts
 *
 * Tests that:
 * - format=pdf calls convertDOCXtoPDF with { userId } (1 credit consumed).
 * - format=docx never calls convertDOCXtoPDF (0 credits consumed).
 * - InsufficientCreditsError for PDF returns HTTP 402.
 * - Unauthenticated requests return HTTP 401.
 * - Invalid request bodies return HTTP 400.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/pdf/converter", () => ({
  convertDOCXtoPDF: jest.fn(),
}));

jest.mock("@/lib/docx/modifier", () => ({
  applyChangesToDOCX: jest.fn(),
}));

jest.mock("@/lib/tracking", () => ({
  logUsage: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { POST } from "./route";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require("@clerk/nextjs/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { convertDOCXtoPDF } = require("@/lib/pdf/converter");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyChangesToDOCX } = require("@/lib/docx/modifier");

class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_DOCX_BUFFER = Buffer.from("applied-docx-bytes");
const FAKE_PDF_BUFFER = Buffer.from("converted-pdf-bytes");
const DOCX_BASE64 = Buffer.from("original-docx-content").toString("base64");

const ACCEPTED_SUGGESTION = {
  id: "s1",
  section: "experience",
  original: "Led team",
  suggested: "Led cross-functional team of 8",
  reason: "More specific",
  accepted: true,
};

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/generate-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  auth.mockResolvedValue({ userId: "user_123" });
  applyChangesToDOCX.mockResolvedValue(FAKE_DOCX_BUFFER);
  convertDOCXtoPDF.mockResolvedValue(FAKE_PDF_BUFFER);
});

// ═════════════════════════════════════════════════════════════════════════════
// format = "pdf"  — 1 credit consumed
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/generate-resume — format=pdf", () => {
  const pdfPayload = {
    resumeText: "John Doe resume text",
    acceptedSuggestions: [ACCEPTED_SUGGESTION],
    docxBase64: DOCX_BASE64,
    format: "pdf",
  };

  it("calls convertDOCXtoPDF with { userId } — 1 credit consumed", async () => {
    const res = await POST(makeRequest(pdfPayload));

    expect(convertDOCXtoPDF).toHaveBeenCalledTimes(1);
    expect(convertDOCXtoPDF).toHaveBeenCalledWith(FAKE_DOCX_BUFFER, { userId: "user_123" });
    expect(res.status).toBe(200);
  });

  it("applies accepted suggestions to the DOCX before converting to PDF", async () => {
    await POST(makeRequest(pdfPayload));

    expect(applyChangesToDOCX).toHaveBeenCalledWith(DOCX_BASE64, [ACCEPTED_SUGGESTION]);
    // The modified DOCX is then passed to the PDF converter
    expect(convertDOCXtoPDF).toHaveBeenCalledWith(FAKE_DOCX_BUFFER, expect.anything());
  });

  it("returns 200 with PDF bytes and correct Content-Type", async () => {
    const res = await POST(makeRequest(pdfPayload));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body).toEqual(FAKE_PDF_BUFFER);
  });

  it("returns 402 when convertDOCXtoPDF throws InsufficientCreditsError", async () => {
    convertDOCXtoPDF.mockRejectedValue(new InsufficientCreditsError());

    const res = await POST(makeRequest(pdfPayload));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient credits/i);
  });

  it("returns 401 when user is not authenticated", async () => {
    auth.mockResolvedValue({ userId: null });

    const res = await POST(makeRequest(pdfPayload));

    expect(res.status).toBe(401);
    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// format = "docx"  — 0 credits consumed
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/generate-resume — format=docx", () => {
  const docxPayload = {
    resumeText: "John Doe resume text",
    acceptedSuggestions: [ACCEPTED_SUGGESTION],
    docxBase64: DOCX_BASE64,
    format: "docx",
  };

  it("does NOT call convertDOCXtoPDF — 0 credits consumed for DOCX download", async () => {
    const res = await POST(makeRequest(docxPayload));

    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("returns 200 with DOCX bytes and correct Content-Type", async () => {
    const res = await POST(makeRequest(docxPayload));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/wordprocessingml/);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body).toEqual(FAKE_DOCX_BUFFER);
  });

  it("applies accepted suggestions before returning the DOCX", async () => {
    await POST(makeRequest(docxPayload));

    expect(applyChangesToDOCX).toHaveBeenCalledWith(DOCX_BASE64, [ACCEPTED_SUGGESTION]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Input validation
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/generate-resume — validation", () => {
  it("returns 400 for missing resumeText", async () => {
    const res = await POST(
      makeRequest({ acceptedSuggestions: [], docxBase64: DOCX_BASE64, format: "pdf" })
    );

    expect(res.status).toBe(400);
    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid format value", async () => {
    const res = await POST(
      makeRequest({ resumeText: "text", acceptedSuggestions: [], format: "xlsx" })
    );

    expect(res.status).toBe(400);
    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
  });
});

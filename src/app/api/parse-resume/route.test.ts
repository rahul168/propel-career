/**
 * parse-resume/route.test.ts
 *
 * Tests that:
 * - Uploading a PDF consumes 1 credit (via convertPDFtoDOCX).
 * - Uploading a DOCX consumes 0 credits.
 * - InsufficientCreditsError from convertPDFtoDOCX returns HTTP 402.
 * - Adobe failures return HTTP 400 with a user-friendly message.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
}));

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { upsert: jest.fn() },
  },
}));

jest.mock("@/lib/pdf/converter", () => ({
  convertPDFtoDOCX: jest.fn(),
}));

jest.mock("@/lib/docx/parser", () => ({
  extractTextFromDOCX: jest.fn(),
}));

jest.mock("@/lib/tracking", () => ({
  logUsage: jest.fn(),
}));

jest.mock("@/lib/credits/consume", () => ({
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() {
      super("Insufficient credits");
      this.name = "InsufficientCreditsError";
    }
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { POST } from "./route";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth, currentUser } = require("@clerk/nextjs/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { convertPDFtoDOCX } = require("@/lib/pdf/converter");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractTextFromDOCX } = require("@/lib/docx/parser");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("@/lib/db/prisma");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InsufficientCreditsError } = require("@/lib/credits/consume");

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Minimal valid PDF magic bytes: %PDF
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Buffer.from("-1.7")]);
// Minimal valid DOCX magic bytes: PK (ZIP)
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.from("docx-content")]);
const FAKE_DOCX_BUFFER = Buffer.from("converted-docx-bytes");

function makeFormData(fileName: string, content: Buffer, mimeType: string): FormData {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });
  const fd = new FormData();
  fd.append("resume", file);
  return fd;
}

function makeRequest(formData: FormData): Request {
  return new Request("http://localhost/api/parse-resume", {
    method: "POST",
    body: formData,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  auth.mockResolvedValue({ userId: "user_123" });
  currentUser.mockResolvedValue({
    primaryEmailAddress: { emailAddress: "test@example.com" },
  });
  prisma.user.upsert.mockResolvedValue({});
  extractTextFromDOCX.mockResolvedValue("Extracted resume text");
  convertPDFtoDOCX.mockResolvedValue(FAKE_DOCX_BUFFER);
});

// ═════════════════════════════════════════════════════════════════════════════
// PDF upload
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/parse-resume — PDF upload", () => {
  it("calls convertPDFtoDOCX with the authenticated userId (1 credit consumed)", async () => {
    const fd = makeFormData("resume.pdf", PDF_MAGIC, "application/pdf");
    const res = await POST(makeRequest(fd));

    expect(convertPDFtoDOCX).toHaveBeenCalledTimes(1);
    expect(convertPDFtoDOCX).toHaveBeenCalledWith(expect.any(Buffer), { userId: "user_123" });
    expect(res.status).toBe(200);
  });

  it("returns 200 with text and docxBase64 on successful PDF conversion", async () => {
    const fd = makeFormData("resume.pdf", PDF_MAGIC, "application/pdf");
    const res = await POST(makeRequest(fd));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("Extracted resume text");
    expect(typeof body.docxBase64).toBe("string");
    expect(body.docxBase64).toBe(FAKE_DOCX_BUFFER.toString("base64"));
  });

  it("returns 402 when PDF conversion throws InsufficientCreditsError", async () => {
    convertPDFtoDOCX.mockRejectedValue(new InsufficientCreditsError());

    const fd = makeFormData("resume.pdf", PDF_MAGIC, "application/pdf");
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient credits/i);
  });

  it("returns 400 with a friendly message when Adobe conversion fails", async () => {
    convertPDFtoDOCX.mockRejectedValue(new Error("Adobe SDK failure"));

    const fd = makeFormData("resume.pdf", PDF_MAGIC, "application/pdf");
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/PDF conversion failed/i);
  });

  it("returns 401 when user is not authenticated", async () => {
    auth.mockResolvedValue({ userId: null });

    const fd = makeFormData("resume.pdf", PDF_MAGIC, "application/pdf");
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(401);
    expect(convertPDFtoDOCX).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DOCX upload (no credit consumed)
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/parse-resume — DOCX upload", () => {
  it("does NOT call convertPDFtoDOCX for a DOCX file (0 credits consumed)", async () => {
    const fd = makeFormData(
      "resume.docx",
      DOCX_MAGIC,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const res = await POST(makeRequest(fd));

    expect(convertPDFtoDOCX).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("returns 200 with text and docxBase64 for a DOCX file", async () => {
    const fd = makeFormData(
      "resume.docx",
      DOCX_MAGIC,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const res = await POST(makeRequest(fd));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("Extracted resume text");
    expect(body.docxBase64).toBe(DOCX_MAGIC.toString("base64"));
  });

  it("returns 400 for unsupported file type", async () => {
    const fd = makeFormData("resume.txt", Buffer.from("plain text"), "text/plain");
    const res = await POST(makeRequest(fd));

    expect(res.status).toBe(400);
    expect(convertPDFtoDOCX).not.toHaveBeenCalled();
  });
});

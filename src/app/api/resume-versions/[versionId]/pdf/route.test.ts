/**
 * resume-versions/[versionId]/pdf/route.test.ts
 *
 * Tests that:
 * - Downloading a version as PDF calls convertDOCXtoPDF with { userId } (1 credit).
 * - InsufficientCreditsError returns HTTP 402.
 * - Adobe failures return HTTP 500.
 * - Unauthenticated requests return HTTP 401.
 * - Requesting a version that belongs to a different user returns HTTP 404.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    resumeVersion: { findFirst: jest.fn() },
  },
}));

jest.mock("@/lib/pdf/converter", () => ({
  convertDOCXtoPDF: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { GET } from "./route";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require("@clerk/nextjs/server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { convertDOCXtoPDF } = require("@/lib/pdf/converter");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("@/lib/db/prisma");

class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_PDF_BUFFER = Buffer.from("fake-pdf-bytes");
const FAKE_DOCX_BYTES = Buffer.from("docx-content");

function makeContext(versionId: string) {
  return { params: Promise.resolve({ versionId }) };
}

function makeRequest() {
  return new Request("http://localhost/api/resume-versions/ver_1/pdf");
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  auth.mockResolvedValue({ userId: "user_123" });
  prisma.resumeVersion.findFirst.mockResolvedValue({
    docxBytes: FAKE_DOCX_BYTES,
    originalFileName: "my-resume.docx",
  });
  convertDOCXtoPDF.mockResolvedValue(FAKE_PDF_BUFFER);
});

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/resume-versions/[versionId]/pdf", () => {
  it("calls convertDOCXtoPDF with { userId } — 1 credit consumed per download", async () => {
    const res = await GET(makeRequest(), makeContext("ver_1"));

    expect(convertDOCXtoPDF).toHaveBeenCalledTimes(1);
    expect(convertDOCXtoPDF).toHaveBeenCalledWith(expect.any(Buffer), { userId: "user_123" });
    expect(res.status).toBe(200);
  });

  it("returns the PDF bytes with correct Content-Type", async () => {
    const res = await GET(makeRequest(), makeContext("ver_1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body).toEqual(FAKE_PDF_BUFFER);
  });

  it("sets Content-Disposition filename based on originalFileName", async () => {
    const res = await GET(makeRequest(), makeContext("ver_1"));

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("my-resume.pdf");
  });

  it("returns 402 when convertDOCXtoPDF throws InsufficientCreditsError", async () => {
    convertDOCXtoPDF.mockRejectedValue(new InsufficientCreditsError());

    const res = await GET(makeRequest(), makeContext("ver_1"));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient credits/i);
  });

  it("returns 500 when convertDOCXtoPDF throws a generic Adobe error", async () => {
    convertDOCXtoPDF.mockRejectedValue(new Error("Adobe API unavailable"));

    const res = await GET(makeRequest(), makeContext("ver_1"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("PDF conversion failed");
  });

  it("returns 401 when user is not authenticated", async () => {
    auth.mockResolvedValue({ userId: null });

    const res = await GET(makeRequest(), makeContext("ver_1"));

    expect(res.status).toBe(401);
    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
  });

  it("returns 404 when the version does not exist or belongs to another user", async () => {
    prisma.resumeVersion.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeContext("ver_999"));

    expect(res.status).toBe(404);
    expect(convertDOCXtoPDF).not.toHaveBeenCalled();
  });

  it("queries the DB with both versionId and userId to prevent cross-user access", async () => {
    await GET(makeRequest(), makeContext("ver_1"));

    expect(prisma.resumeVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "ver_1", userId: "user_123" }),
      })
    );
  });
});

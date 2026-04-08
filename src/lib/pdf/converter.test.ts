/**
 * converter.test.ts
 *
 * Tests that:
 * 1. One credit is consumed before every Adobe API call.
 * 2. Adobe SDK is called with the correct inputs.
 * 3. InsufficientCreditsError propagates without reaching Adobe.
 * 4. Missing credentials throw immediately without touching credits or Adobe.
 * 5. Adobe SDK failures propagate as-is.
 */

// ─── Mock: credits ───────────────────────────────────────────────────────────
jest.mock("@/lib/credits/consume", () => ({
  consumeCreditsOrThrow: jest.fn(),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor(msg = "Insufficient credits") {
      super(msg);
      this.name = "InsufficientCreditsError";
    }
  },
}));

// ─── Mock: Adobe PDF Services SDK ────────────────────────────────────────────
// Instance methods are stored on the constructor so tests can access them via
// (PDFServices as any).__instance.
const adobeInstance = {
  upload: jest.fn(),
  submit: jest.fn(),
  getJobResult: jest.fn(),
  getContent: jest.fn(),
};

jest.mock("@adobe/pdfservices-node-sdk", () => ({
  ServicePrincipalCredentials: jest.fn(),
  PDFServices: jest.fn(() => adobeInstance),
  MimeType: { DOCX: "docx", PDF: "pdf" },
  CreatePDFJob: jest.fn((args: unknown) => args),
  CreatePDFResult: class CreatePDFResult {},
  ExportPDFParams: jest.fn((args: unknown) => args),
  ExportPDFTargetFormat: { DOCX: "docx" },
  ExportPDFJob: jest.fn((args: unknown) => args),
  ExportPDFResult: class ExportPDFResult {},
}));

// ─── Imports (resolved after mocks are hoisted) ───────────────────────────────
import { convertDOCXtoPDF, convertPDFtoDOCX } from "./converter";
import { consumeCreditsOrThrow, InsufficientCreditsError } from "@/lib/credits/consume";

const mockConsumeCredits = consumeCreditsOrThrow as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a minimal async read-stream that yields the provided chunks. */
function makeReadStream(chunks: Buffer[]): AsyncIterable<Buffer> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next(): Promise<IteratorResult<Buffer>> {
          if (i < chunks.length) return Promise.resolve({ value: chunks[i++], done: false });
          return Promise.resolve({ value: undefined as unknown as Buffer, done: true });
        },
      };
    },
  };
}

const FAKE_PDF_CHUNK = Buffer.from("fake-pdf-bytes");
const FAKE_DOCX_CHUNK = Buffer.from("fake-docx-bytes");
const FAKE_INPUT_ASSET = { assetId: "input-asset-1" };
const FAKE_OUTPUT_ASSET = { assetId: "output-asset-2" };
const FAKE_POLLING_URL = "https://adobe.example/poll/abc";

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Provide valid Adobe credentials by default.
  process.env.ADBE_CLIENT_ID = "test-client-id";
  process.env.ADBE_CLIENT_SECRET = "test-client-secret";

  // Default Adobe mock: happy-path returns
  adobeInstance.upload.mockResolvedValue(FAKE_INPUT_ASSET);
  adobeInstance.submit.mockResolvedValue(FAKE_POLLING_URL);
  adobeInstance.getContent.mockResolvedValue({ readStream: makeReadStream([FAKE_PDF_CHUNK]) });

  // Default credit mock: credits available
  mockConsumeCredits.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.ADBE_CLIENT_ID;
  delete process.env.ADBE_CLIENT_SECRET;
});

// ═════════════════════════════════════════════════════════════════════════════
// convertDOCXtoPDF
// ═════════════════════════════════════════════════════════════════════════════

describe("convertDOCXtoPDF", () => {
  const DOCX_INPUT = Buffer.from("docx-content");

  beforeEach(() => {
    adobeInstance.getJobResult.mockResolvedValue({
      result: { asset: FAKE_OUTPUT_ASSET },
    });
    adobeInstance.getContent.mockResolvedValue({
      readStream: makeReadStream([FAKE_PDF_CHUNK]),
    });
  });

  it("consumes exactly 1 credit before calling Adobe", async () => {
    await convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" });

    expect(mockConsumeCredits).toHaveBeenCalledTimes(1);
    expect(mockConsumeCredits).toHaveBeenCalledWith("user_123", 1);
    // Adobe upload must have been called — credit charge happened first
    expect(adobeInstance.upload).toHaveBeenCalled();
  });

  it("credit is charged before the Adobe upload call (order enforcement)", async () => {
    const callOrder: string[] = [];
    mockConsumeCredits.mockImplementation(() => {
      callOrder.push("consume");
      return Promise.resolve();
    });
    adobeInstance.upload.mockImplementation(() => {
      callOrder.push("upload");
      return Promise.resolve(FAKE_INPUT_ASSET);
    });

    await convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" });

    expect(callOrder).toEqual(["consume", "upload"]);
  });

  it("returns the PDF buffer assembled from the Adobe read stream", async () => {
    const chunk1 = Buffer.from("part1");
    const chunk2 = Buffer.from("part2");
    adobeInstance.getContent.mockResolvedValue({
      readStream: makeReadStream([chunk1, chunk2]),
    });

    const result = await convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" });

    expect(result).toEqual(Buffer.concat([chunk1, chunk2]));
  });

  it("throws InsufficientCreditsError and never calls Adobe when credits are exhausted", async () => {
    mockConsumeCredits.mockRejectedValue(new InsufficientCreditsError());

    await expect(convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" })).rejects.toThrow(
      InsufficientCreditsError
    );

    expect(adobeInstance.upload).not.toHaveBeenCalled();
    expect(adobeInstance.submit).not.toHaveBeenCalled();
  });

  it("throws immediately when ADBE_CLIENT_ID is missing — no credits consumed, no Adobe call", async () => {
    delete process.env.ADBE_CLIENT_ID;

    await expect(convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" })).rejects.toThrow(
      "Adobe PDF Services credentials are not configured"
    );

    expect(mockConsumeCredits).not.toHaveBeenCalled();
    expect(adobeInstance.upload).not.toHaveBeenCalled();
  });

  it("throws immediately when ADBE_CLIENT_SECRET is missing — no credits consumed", async () => {
    delete process.env.ADBE_CLIENT_SECRET;

    await expect(convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" })).rejects.toThrow(
      "Adobe PDF Services credentials are not configured"
    );

    expect(mockConsumeCredits).not.toHaveBeenCalled();
  });

  it("throws when Adobe SDK upload fails — error propagates as-is", async () => {
    adobeInstance.upload.mockRejectedValue(new Error("Adobe upload error"));

    await expect(convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" })).rejects.toThrow(
      "Adobe upload error"
    );
  });

  it("throws when Adobe getJobResult returns no result", async () => {
    adobeInstance.getJobResult.mockResolvedValue({ result: null });

    await expect(convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" })).rejects.toThrow(
      "Adobe job completed without a result"
    );
  });

  it("passes the correct DOCX mime type to the upload call", async () => {
    await convertDOCXtoPDF(DOCX_INPUT, { userId: "user_123" });

    const uploadArg = adobeInstance.upload.mock.calls[0][0];
    expect(uploadArg.mimeType).toBe("docx"); // MimeType.DOCX from mock
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// convertPDFtoDOCX
// ═════════════════════════════════════════════════════════════════════════════

describe("convertPDFtoDOCX", () => {
  const PDF_INPUT = Buffer.from("pdf-content");

  beforeEach(() => {
    adobeInstance.getJobResult.mockResolvedValue({
      result: { asset: FAKE_OUTPUT_ASSET },
    });
    adobeInstance.getContent.mockResolvedValue({
      readStream: makeReadStream([FAKE_DOCX_CHUNK]),
    });
  });

  it("consumes exactly 1 credit before calling Adobe", async () => {
    await convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" });

    expect(mockConsumeCredits).toHaveBeenCalledTimes(1);
    expect(mockConsumeCredits).toHaveBeenCalledWith("user_456", 1);
    expect(adobeInstance.upload).toHaveBeenCalled();
  });

  it("credit is charged before the Adobe upload call (order enforcement)", async () => {
    const callOrder: string[] = [];
    mockConsumeCredits.mockImplementation(() => {
      callOrder.push("consume");
      return Promise.resolve();
    });
    adobeInstance.upload.mockImplementation(() => {
      callOrder.push("upload");
      return Promise.resolve(FAKE_INPUT_ASSET);
    });

    await convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" });

    expect(callOrder).toEqual(["consume", "upload"]);
  });

  it("returns the DOCX buffer assembled from the Adobe read stream", async () => {
    const chunk1 = Buffer.from("docx-part1");
    const chunk2 = Buffer.from("docx-part2");
    adobeInstance.getContent.mockResolvedValue({
      readStream: makeReadStream([chunk1, chunk2]),
    });

    const result = await convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" });

    expect(result).toEqual(Buffer.concat([chunk1, chunk2]));
  });

  it("throws InsufficientCreditsError and never calls Adobe when credits are exhausted", async () => {
    mockConsumeCredits.mockRejectedValue(new InsufficientCreditsError());

    await expect(convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" })).rejects.toThrow(
      InsufficientCreditsError
    );

    expect(adobeInstance.upload).not.toHaveBeenCalled();
    expect(adobeInstance.submit).not.toHaveBeenCalled();
  });

  it("throws immediately when ADBE_CLIENT_ID is missing — no credits consumed, no Adobe call", async () => {
    delete process.env.ADBE_CLIENT_ID;

    await expect(convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" })).rejects.toThrow(
      "Adobe PDF Services credentials are not configured"
    );

    expect(mockConsumeCredits).not.toHaveBeenCalled();
    expect(adobeInstance.upload).not.toHaveBeenCalled();
  });

  it("throws immediately when ADBE_CLIENT_SECRET is missing — no credits consumed", async () => {
    delete process.env.ADBE_CLIENT_SECRET;

    await expect(convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" })).rejects.toThrow(
      "Adobe PDF Services credentials are not configured"
    );

    expect(mockConsumeCredits).not.toHaveBeenCalled();
  });

  it("throws when Adobe SDK fails — error propagates as-is", async () => {
    adobeInstance.submit.mockRejectedValue(new Error("Adobe submit error"));

    await expect(convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" })).rejects.toThrow(
      "Adobe submit error"
    );
  });

  it("throws when Adobe getJobResult returns no result", async () => {
    adobeInstance.getJobResult.mockResolvedValue({ result: null });

    await expect(convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" })).rejects.toThrow(
      "Adobe job completed without a result"
    );
  });

  it("passes the correct PDF mime type to the upload call", async () => {
    await convertPDFtoDOCX(PDF_INPUT, { userId: "user_456" });

    const uploadArg = adobeInstance.upload.mock.calls[0][0];
    expect(uploadArg.mimeType).toBe("pdf"); // MimeType.PDF from mock
  });
});

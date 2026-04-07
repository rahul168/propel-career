import { Readable } from "stream";
import { chromium } from "playwright";
import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  CreatePDFJob,
  CreatePDFResult,
  ExportPDFParams,
  ExportPDFTargetFormat,
  ExportPDFJob,
  ExportPDFResult,
} from "@adobe/pdfservices-node-sdk";
import { consumeCreditsOrThrow } from "@/lib/credits/consume";

/**
 * Adobe PDF Services SDK implementation
 * Provides high-fidelity DOCX to PDF conversion with superior layout preservation
 */

/**
 * Converts DOCX to PDF using Adobe PDF Services SDK for high-quality conversion
 * that preserves document layout, fonts, tables, and formatting with pixel-perfect fidelity.
 */
export async function convertDOCXtoPDF(
  docxBuffer: Buffer,
  opts?: { userId?: string }
): Promise<Buffer> {
  const adobeClientId = process.env.ADBE_CLIENT_ID;
  const adobeClientSecret = process.env.ADBE_CLIENT_SECRET;

  // Check if Adobe credentials are configured
  if (!adobeClientId || !adobeClientSecret || adobeClientId === "your-adobe-client-id") {
    console.warn("[convertDOCXtoPDF] Adobe PDF Services credentials not configured, falling back to Playwright conversion");
    return convertDOCXtoPDFViaPlaywright(docxBuffer);
  }

  let inputStream: Readable | undefined;

  try {
    if (!opts?.userId) {
      throw new Error("[convertDOCXtoPDF] userId is required when using Adobe conversion");
    }

    // Charge 1 credit per Adobe conversion job attempt (on attempt).
    await consumeCreditsOrThrow(opts.userId, 1);

    // Create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: adobeClientId,
      clientSecret: adobeClientSecret,
    });

    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Create a readable stream from the DOCX buffer
    inputStream = Readable.from(docxBuffer);

    // Upload the DOCX file as an asset
    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.DOCX,
    });

    // Create a new job instance (params are optional for CreatePDFJob)
    const job = new CreatePDFJob({ inputAsset });

    // Submit the job and get the polling URL
    const pollingURL = await pdfServices.submit({ job });

    // Poll for job completion and get the result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: CreatePDFResult,
    });

    if (!pdfServicesResponse.result) {
      throw new Error("[convertDOCXtoPDF] Adobe job completed without a result");
    }

    // Get the resulting asset
    const resultAsset = pdfServicesResponse.result.asset;

    // Download the resulting PDF content
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Collect the stream data into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    return pdfBuffer;
  } catch (error) {
    console.error("[convertDOCXtoPDF] Adobe PDF Services conversion failed:", error);
    console.warn("[convertDOCXtoPDF] Falling back to Playwright conversion");
    return convertDOCXtoPDFViaPlaywright(docxBuffer);
  } finally {
    // Clean up the stream
    inputStream?.destroy();
  }
}

/**
 * Converts PDF to DOCX using Adobe PDF Services SDK for high-quality conversion
 * that preserves document layout, fonts, tables, and formatting.
 */
export async function convertPDFtoDOCX(
  pdfBuffer: Buffer,
  opts: { userId: string }
): Promise<Buffer> {
  const adobeClientId = process.env.ADBE_CLIENT_ID;
  const adobeClientSecret = process.env.ADBE_CLIENT_SECRET;

  // Check if Adobe credentials are configured
  if (!adobeClientId || !adobeClientSecret || adobeClientId === "your-adobe-client-id") {
    throw new Error("[convertPDFtoDOCX] Adobe PDF Services credentials not configured");
  }

  let inputStream: Readable | undefined;

  try {
    // Charge 1 credit per Adobe conversion job attempt (on attempt).
    await consumeCreditsOrThrow(opts.userId, 1);

    // Create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: adobeClientId,
      clientSecret: adobeClientSecret,
    });

    // Create PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Create a readable stream from the PDF buffer
    inputStream = Readable.from(pdfBuffer);

    // Upload the PDF file as an asset
    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.PDF,
    });

    // Create parameters for the job
    const params = new ExportPDFParams({
      targetFormat: ExportPDFTargetFormat.DOCX,
    });

    // Create a new job instance
    const job = new ExportPDFJob({ inputAsset, params });

    // Submit the job and get the polling URL
    const pollingURL = await pdfServices.submit({ job });

    // Poll for job completion and get the result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExportPDFResult,
    });

    if (!pdfServicesResponse.result) {
      throw new Error("[convertPDFtoDOCX] Adobe job completed without a result");
    }

    // Get the resulting asset
    const resultAsset = pdfServicesResponse.result.asset;

    // Download the resulting DOCX content
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Collect the stream data into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.from(chunk));
    }
    const docxBuffer = Buffer.concat(chunks);

    return docxBuffer;
  } catch (error) {
    console.error("[convertPDFtoDOCX] Adobe PDF Services conversion failed:", error);
    throw error;
  } finally {
    // Clean up the stream
    inputStream?.destroy();
  }
}

/**
 * Fallback conversion using Playwright (mammoth + browser print)
 */
async function convertDOCXtoPDFViaPlaywright(docxBuffer: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as typeof import("mammoth");

  const RESUME_CSS = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Calibri, 'Trebuchet MS', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.15;
      color: #000;
      background: #fff;
    }

    h1 {
      font-size: 18pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 3pt;
    }

    h2 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1.5px solid #000;
      padding-bottom: 1pt;
      margin-top: 10pt;
      margin-bottom: 4pt;
    }

    h3 {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 6pt;
      margin-bottom: 2pt;
    }

    h4 {
      font-size: 10.5pt;
      font-weight: bold;
      font-style: italic;
      margin-top: 4pt;
      margin-bottom: 2pt;
    }

    p {
      margin-bottom: 4pt;
      orphans: 2;
      widows: 2;
    }

    strong, b {
      font-weight: bold;
    }

    em, i {
      font-style: italic;
    }

    ul, ol {
      margin-left: 18pt;
      margin-bottom: 4pt;
    }

    li {
      margin-bottom: 1pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6pt;
    }

    td, th {
      padding: 2pt 4pt;
      vertical-align: top;
    }

    a {
      color: #000;
      text-decoration: none;
    }
  `;

  function buildHtmlDocument(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>${RESUME_CSS}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  }

  const result = await mammoth.convertToHtml(
    { buffer: docxBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
      ],
    }
  );

  const html = buildHtmlDocument(result.value);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    await page.setContent(html, { waitUntil: "load" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

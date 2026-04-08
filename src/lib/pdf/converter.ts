import { Readable } from "stream";
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
 * Converts DOCX to PDF using Adobe PDF Services SDK.
 * Requires valid Adobe credentials (ADBE_CLIENT_ID / ADBE_CLIENT_SECRET) and a userId.
 */
export async function convertDOCXtoPDF(
  docxBuffer: Buffer,
  opts: { userId: string }
): Promise<Buffer> {
  const adobeClientId = process.env.ADBE_CLIENT_ID;
  const adobeClientSecret = process.env.ADBE_CLIENT_SECRET;

  if (!adobeClientId || !adobeClientSecret) {
    throw new Error("[convertDOCXtoPDF] Adobe PDF Services credentials are not configured");
  }

  // Charge 1 credit per conversion attempt.
  await consumeCreditsOrThrow(opts.userId, 1);

  let inputStream: Readable | undefined;

  try {
    const credentials = new ServicePrincipalCredentials({
      clientId: adobeClientId,
      clientSecret: adobeClientSecret,
    });

    const pdfServices = new PDFServices({ credentials });

    inputStream = Readable.from(docxBuffer);

    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.DOCX,
    });

    const job = new CreatePDFJob({ inputAsset });
    const pollingURL = await pdfServices.submit({ job });

    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: CreatePDFResult,
    });

    if (!pdfServicesResponse.result) {
      throw new Error("[convertDOCXtoPDF] Adobe job completed without a result");
    }

    const streamAsset = await pdfServices.getContent({ asset: pdfServicesResponse.result.asset });

    const chunks: Buffer[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } finally {
    inputStream?.destroy();
  }
}

/**
 * Converts PDF to DOCX using Adobe PDF Services SDK.
 * Requires valid Adobe credentials (ADBE_CLIENT_ID / ADBE_CLIENT_SECRET) and a userId.
 */
export async function convertPDFtoDOCX(
  pdfBuffer: Buffer,
  opts: { userId: string }
): Promise<Buffer> {
  const adobeClientId = process.env.ADBE_CLIENT_ID;
  const adobeClientSecret = process.env.ADBE_CLIENT_SECRET;

  if (!adobeClientId || !adobeClientSecret) {
    throw new Error("[convertPDFtoDOCX] Adobe PDF Services credentials are not configured");
  }

  // Charge 1 credit per conversion attempt.
  await consumeCreditsOrThrow(opts.userId, 1);

  let inputStream: Readable | undefined;

  try {
    const credentials = new ServicePrincipalCredentials({
      clientId: adobeClientId,
      clientSecret: adobeClientSecret,
    });

    const pdfServices = new PDFServices({ credentials });

    inputStream = Readable.from(pdfBuffer);

    const inputAsset = await pdfServices.upload({
      readStream: inputStream,
      mimeType: MimeType.PDF,
    });

    const params = new ExportPDFParams({
      targetFormat: ExportPDFTargetFormat.DOCX,
    });

    const job = new ExportPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });

    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExportPDFResult,
    });

    if (!pdfServicesResponse.result) {
      throw new Error("[convertPDFtoDOCX] Adobe job completed without a result");
    }

    const streamAsset = await pdfServices.getContent({ asset: pdfServicesResponse.result.asset });

    const chunks: Buffer[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } finally {
    inputStream?.destroy();
  }
}

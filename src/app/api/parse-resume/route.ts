import { auth, currentUser } from "@clerk/nextjs/server";
import { extractTextFromDOCX } from "@/lib/docx/parser";
import { convertPDFtoDOCX } from "@/lib/pdf/converter";
import { prisma } from "@/lib/db/prisma";
import { logUsage } from "@/lib/tracking";
import { InsufficientCreditsError } from "@/lib/credits/consume";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure user row exists so logUsage FK constraint is satisfied
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, credits: 0 },
    update: {},
  });

  const start = Date.now();

  const formData = await request.formData();
  const file = formData.get("resume") as File | null;

  if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });

  const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const pdfMime = "application/pdf";

  // Check if file is DOCX or PDF
  const isDOCX = file.type === docxMime || file.name.toLowerCase().endsWith(".docx");
  const isPDF = file.type === pdfMime || file.name.toLowerCase().endsWith(".pdf");

  if (!isDOCX && !isPDF) {
    return Response.json({ error: "Only DOCX and PDF files are accepted" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let docxBuffer: Buffer;
  let extractedText: string;
  const feature = isPDF ? "parse-resume-adobe" : "parse-resume";

  if (isPDF) {
    // Validate PDF magic bytes (%PDF)
    if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return Response.json({ error: "Invalid PDF file" }, { status: 400 });
    }

    try {
      // Convert PDF to DOCX using Adobe Services
      docxBuffer = await convertPDFtoDOCX(buffer, { userId });
      extractedText = await extractTextFromDOCX(docxBuffer);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return Response.json({ error: "Insufficient credits for PDF conversion" }, { status: 402 });
      }
      console.error("[parse-resume] PDF to DOCX conversion failed:", err);
      return Response.json({ error: "PDF conversion failed. Please upload a DOCX file instead." }, { status: 400 });
    }
  } else {
    // Validate DOCX magic bytes (ZIP format: PK = 0x50 0x4B)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return Response.json({ error: "Invalid DOCX file" }, { status: 400 });
    }

    docxBuffer = buffer;
    extractedText = await extractTextFromDOCX(buffer);
  }

  void logUsage(userId, feature, 200, Date.now() - start);

  return Response.json({ text: extractedText, fileName: file.name, docxBase64: docxBuffer.toString("base64") });
}

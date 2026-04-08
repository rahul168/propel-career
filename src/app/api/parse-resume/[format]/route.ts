import { auth, currentUser } from "@clerk/nextjs/server";
import { extractTextFromDOCX } from "@/lib/docx/parser";
import { convertPDFtoDOCX } from "@/lib/pdf/converter";
import { prisma } from "@/lib/db/prisma";
import { logUsage } from "@/lib/tracking";
import { InsufficientCreditsError } from "@/lib/credits/consume";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ format: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { format } = await params;
  if (format !== "docx" && format !== "pdf") {
    return Response.json({ error: "Invalid format. Use 'docx' or 'pdf'." }, { status: 400 });
  }

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

  const buffer = Buffer.from(await file.arrayBuffer());

  if (format === "docx") {
    const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDOCX = file.type === docxMime || file.name.toLowerCase().endsWith(".docx");
    if (!isDOCX) return Response.json({ error: "Only DOCX files are accepted" }, { status: 400 });

    // Validate DOCX magic bytes (ZIP: PK = 0x50 0x4B)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return Response.json({ error: "Invalid DOCX file" }, { status: 400 });
    }

    const text = await extractTextFromDOCX(buffer);
    void logUsage(userId, "parse-resume", 200, Date.now() - start);
    return Response.json({ text, fileName: file.name, docxBase64: buffer.toString("base64") });
  }

  // format === "pdf"
  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPDF) return Response.json({ error: "Only PDF files are accepted" }, { status: 400 });

  // Validate PDF magic bytes (%PDF = 0x25 0x50 0x44 0x46)
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return Response.json({ error: "Invalid PDF file" }, { status: 400 });
  }

  try {
    const docxBuffer = await convertPDFtoDOCX(buffer, { userId });
    const text = await extractTextFromDOCX(docxBuffer);
    const fileName = file.name.replace(/\.pdf$/i, ".docx");
    void logUsage(userId, "parse-resume-adobe", 200, Date.now() - start);
    return Response.json({ text, fileName, docxBase64: docxBuffer.toString("base64") });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return Response.json({ error: "Insufficient credits for PDF conversion" }, { status: 402 });
    }
    console.error("[parse-resume/pdf] Conversion failed:", err);
    return Response.json(
      { error: "PDF conversion failed. Please upload a DOCX file instead." },
      { status: 400 }
    );
  }
}

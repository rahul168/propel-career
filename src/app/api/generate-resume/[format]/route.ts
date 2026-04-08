import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { convertDOCXtoPDF } from "@/lib/pdf/converter";
import { applyChangesToDOCX } from "@/lib/docx/modifier";
import { logUsage } from "@/lib/tracking";
import { InsufficientCreditsError } from "@/lib/credits/consume";

export const runtime = "nodejs";

const suggestionSchema = z.object({
  id: z.string(),
  section: z.string(),
  original: z.string(),
  suggested: z.string(),
  reason: z.string(),
  accepted: z.boolean(),
});

const schema = z.object({
  resumeText: z.string().min(1),
  acceptedSuggestions: z.array(suggestionSchema),
  docxBase64: z.string().optional(),
});

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

  const start = Date.now();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { resumeText: _resumeText, acceptedSuggestions, docxBase64 } = parsed.data;

  if (format === "docx") {
    if (!docxBase64) {
      return Response.json({ error: "docxBase64 is required for DOCX download" }, { status: 400 });
    }
    const buf = await applyChangesToDOCX(docxBase64, acceptedSuggestions);
    void logUsage(userId, "generate-resume", 200, Date.now() - start);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="optimized-resume.docx"',
      },
    });
  }

  // format === "pdf"
  if (!docxBase64) {
    return Response.json({ error: "docxBase64 is required for PDF download" }, { status: 400 });
  }

  try {
    const modifiedDocx = await applyChangesToDOCX(docxBase64, acceptedSuggestions);
    const buf = await convertDOCXtoPDF(modifiedDocx, { userId });
    void logUsage(userId, "generate-resume-adobe", 200, Date.now() - start);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="optimized-resume.pdf"',
      },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return Response.json({ error: "Insufficient credits for PDF conversion" }, { status: 402 });
    }
    console.error("[generate-resume/pdf] DOCX→PDF conversion failed:", err);
    return Response.json({ error: "PDF generation failed. Please try again." }, { status: 500 });
  }
}

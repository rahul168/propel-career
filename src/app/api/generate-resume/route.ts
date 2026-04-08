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
  format: z.enum(["docx", "pdf"]).default("pdf"),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const start = Date.now();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { resumeText, acceptedSuggestions, docxBase64, format } = parsed.data;

  if (format === "docx") {
    if (!docxBase64 || docxBase64.length === 0) {
      return Response.json({ error: "docxBase64 is required for DOCX download" }, { status: 400 });
    }
    const buf = await applyChangesToDOCX(docxBase64, acceptedSuggestions);
    void logUsage(userId, "generate-resume", 200, Date.now() - start);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="optimized-resume.docx"',
      },
    });
  }

  // format === "pdf" — derive from the modified DOCX to preserve layout
  if (docxBase64 && docxBase64.length > 0) {
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
      console.error("[generate-resume] DOCX→PDF conversion failed, try again later:", err);
    }
  }
}

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { convertDOCXtoPDF } from "@/lib/pdf/converter";
import { InsufficientCreditsError } from "@/lib/credits/consume";

export const runtime = "nodejs";

function toSafePdfName(name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "resume.pdf";
  const base = trimmed.replace(/\.(pdf|docx)$/i, "");
  return `${base || "resume"}.pdf`;
}

export async function GET(_: Request, context: { params: Promise<{ versionId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await context.params;

  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: { docxBytes: true, originalFileName: true },
  });
  if (!version) return Response.json({ error: "Not found" }, { status: 404 });

  const adobeConfigured =
    !!process.env.ADBE_CLIENT_ID &&
    !!process.env.ADBE_CLIENT_SECRET &&
    process.env.ADBE_CLIENT_ID !== "your-adobe-client-id";

  try {
    const buf = await convertDOCXtoPDF(Buffer.from(version.docxBytes), adobeConfigured ? { userId } : undefined);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${toSafePdfName(version.originalFileName)}"`,
      },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return Response.json({ error: "Insufficient credits for PDF conversion" }, { status: 402 });
    }
    return Response.json({ error: "PDF conversion failed" }, { status: 500 });
  }
}


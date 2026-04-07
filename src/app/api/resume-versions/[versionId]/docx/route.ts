import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function toSafeDocxName(name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "resume.docx";
  const base = trimmed.replace(/\.(pdf|docx)$/i, "");
  return `${base || "resume"}.docx`;
}

export async function GET(_: Request, context: { params: Promise<{ versionId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await context.params;

  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: { docxBytes: true, originalFileName: true, label: true, runNumber: true },
  });

  if (!version) return Response.json({ error: "Not found" }, { status: 404 });

  const filename = toSafeDocxName(version.originalFileName);

  return new Response(new Uint8Array(version.docxBytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Resume-Version-Label": version.label,
      "X-Resume-Version-Run": String(version.runNumber),
    },
  });
}


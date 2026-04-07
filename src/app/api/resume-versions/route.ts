import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const schema = z.object({
  projectId: z.string().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  source: z.string().trim().min(1).max(32),
  originalFileName: z.string().trim().min(1).max(255),
  docxBase64: z.string().min(1),
  runNumber: z.number().int().min(0).optional(),
});

function deriveLabel(runNumber: number) {
  if (runNumber === 0) return "Original";
  return `Optimized v${runNumber}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { projectId, docxBase64, source, originalFileName } = parsed.data;

  const project = await prisma.resumeProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  let docxBytes: Buffer;
  try {
    docxBytes = Buffer.from(docxBase64, "base64");
  } catch {
    return Response.json({ error: "Invalid base64" }, { status: 400 });
  }

  // Basic DOCX validation: DOCX is a ZIP => starts with "PK"
  if (docxBytes.length < 2 || docxBytes[0] !== 0x50 || docxBytes[1] !== 0x4b) {
    return Response.json({ error: "Invalid DOCX" }, { status: 400 });
  }

  // Guardrail: avoid storing very large blobs in DB (10MB)
  if (docxBytes.length > 10 * 1024 * 1024) {
    return Response.json({ error: "DOCX too large" }, { status: 413 });
  }

  const runNumber =
    parsed.data.runNumber ??
    ((await prisma.resumeVersion.count({ where: { projectId, userId } })) || 0);

  const label = (parsed.data.label && parsed.data.label.trim()) || deriveLabel(runNumber);

  const created = await prisma.resumeVersion.create({
    data: {
      userId,
      projectId,
      runNumber,
      label,
      source,
      originalFileName,
      // Prisma `Bytes` expects Uint8Array; Buffer is compatible at runtime but not always in TS.
      docxBytes: new Uint8Array(docxBytes),
    },
    select: { id: true, runNumber: true, label: true, createdAt: true },
  });

  return Response.json({
    versionId: created.id,
    runNumber: created.runNumber,
    label: created.label,
    createdAt: created.createdAt,
  });
}


import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await context.params;

  const project = await prisma.resumeProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.resumeVersion.findMany({
    where: { projectId, userId },
    orderBy: [{ runNumber: "asc" }],
    select: {
      id: true,
      runNumber: true,
      label: true,
      source: true,
      originalFileName: true,
      createdAt: true,
    },
  });

  return Response.json({ projectId, versions });
}


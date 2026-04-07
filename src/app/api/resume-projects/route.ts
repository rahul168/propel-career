import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const project = await prisma.resumeProject.create({
    data: {
      userId,
      title: parsed.data.title,
    },
    select: { id: true, createdAt: true },
  });

  return Response.json({ projectId: project.id, createdAt: project.createdAt });
}


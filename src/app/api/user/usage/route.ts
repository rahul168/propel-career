import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.usageEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { llmUsage: true },
  });

  return Response.json({ events });
}

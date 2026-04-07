import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [featureStats, llmStats] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["feature"],
      _count: { id: true },
      _avg: { durationMs: true },
    }),
    prisma.llmUsage.groupBy({
      by: ["provider", "model", "operation"],
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsdMicros: true },
      _count: { id: true },
    }),
  ]);

  return Response.json({ featureStats, llmStats });
}

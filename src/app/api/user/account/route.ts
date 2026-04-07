import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { CREDIT_THRESHOLDS, getCreditStatus } from "@/lib/credits/thresholds";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [user, recentEvents] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.usageEvent.findMany({
      where: { userId, statusCode: 200 },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, feature: true, createdAt: true, durationMs: true },
    }),
  ]);

  const credits = user?.credits ?? 0;
  const FEATURE_CREDITS_USED: Record<string, number> = {
    "analyze-match": 1,
    "parse-resume-adobe": 1,
    "generate-resume-adobe": 1,
  };
  const creditsUsed = recentEvents.reduce((sum, e) => sum + (FEATURE_CREDITS_USED[e.feature] ?? 0), 0);

  return Response.json({
    credits,
    status: getCreditStatus(credits),
    thresholds: CREDIT_THRESHOLDS,
    creditsUsed,
    recentUsage: recentEvents.map((e) => ({
      id: e.id,
      feature: e.feature,
      createdAt: e.createdAt,
    })),
  });
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { analyzeMatch } from "@/lib/ai";
import { prisma } from "@/lib/db/prisma";
import { logUsage, logLlmUsage } from "@/lib/tracking";

export const runtime = "nodejs";

const schema = z.object({
  resumeText: z.string().min(50),
  jobDescription: z.string().min(50),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { resumeText, jobDescription } = parsed.data;

  // Ensure user row exists (new Clerk users may not have visited /analyze yet)
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const user = await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, credits: 0 },
    update: {},
  });
  const hasPaid = user.credits >= 1;

  // Only deduct a credit for paid users — free users get the category score for free
  if (hasPaid) {
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 1 } },
    });
  }

  const start = Date.now();
  const { data, usage } = await analyzeMatch(resumeText, jobDescription);
  const durationMs = Date.now() - start;

  void logUsage(userId, "analyze-match", 200, durationMs).then((eventId) =>
    logLlmUsage(eventId, "analyzeMatch", usage)
  );

  return Response.json(data);
}

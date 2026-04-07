import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { suggestImprovements } from "@/lib/ai";
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
  if (user.credits < 1) {
    return Response.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const start = Date.now();
  const { data, usage } = await suggestImprovements(resumeText, jobDescription);
  const durationMs = Date.now() - start;

  void logUsage(userId, "suggest-improvements", 200, durationMs).then((eventId) =>
    logLlmUsage(eventId, "suggestImprovements", usage)
  );

  return Response.json(data);
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string(),
  credits: z.number().int().min(0),
});

export async function PATCH(request: Request) {
  const { userId: adminId, sessionClaims } = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!adminId || (sessionClaims as any)?.publicMetadata?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { userId: targetUserId, credits } = parsed.data;

  const [targetUser, adminUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetUserId } }),
    prisma.user.findUnique({ where: { id: adminId } }),
  ]);

  if (!targetUser) return Response.json({ error: "User not found" }, { status: 404 });

  const adminClerkUser = await currentUser();
  const adminEmail = adminClerkUser?.emailAddresses[0]?.emailAddress ?? adminId;

  const oldCredits = targetUser.credits;
  await prisma.user.update({ where: { id: targetUserId }, data: { credits } });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      adminEmail,
      action: "Credit Update",
      targetUserId,
      targetEmail: targetUser.email,
      detail: `${oldCredits} → ${credits} credits`,
    },
  });

  return Response.json({ success: true });
}

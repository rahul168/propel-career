import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import {
  sendAdminTicketNotification,
  sendUserTicketConfirmation,
} from "@/lib/email/sendgrid";

export const runtime = "nodejs";

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  category: z.enum(["general", "billing", "technical", "other"]),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
    },
  });

  if (user?.email) {
    const emailParams = {
      ticketId: ticket.id,
      userEmail: user.email,
      subject: ticket.subject,
      category: ticket.category,
      message: ticket.message,
    };
    // Fire-and-forget — don't fail the request if email delivery fails
    Promise.all([
      sendAdminTicketNotification(emailParams),
      sendUserTicketConfirmation(emailParams),
    ]).catch((err) => console.error("[support] email send failed:", err));
  }

  return Response.json({ id: ticket.id }, { status: 201 });
}

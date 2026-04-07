import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id!;
    const credits = Number(session.metadata?.credits ?? 0);

    await prisma.user.upsert({
      where: { id: userId },
      update: { credits: { increment: credits } },
      create: {
        id: userId,
        email: session.customer_details?.email ?? "",
        credits,
      },
    });

    await prisma.purchase.create({
      data: {
        userId,
        stripeSessionId: session.id,
        creditsAdded: credits,
        amountPaid: session.amount_total ?? 0,
      },
    });
  }

  return Response.json({ received: true });
}

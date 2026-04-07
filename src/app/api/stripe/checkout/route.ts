import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe/client";
import { CREDIT_PACKS } from "@/lib/stripe/products";

export const runtime = "nodejs";

const schema = z.object({ packId: z.enum(["starter", "pro"]) });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid pack" }, { status: 400 });

  const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.packId)!;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: pack.priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: { credits: String(pack.credits) },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[stripe/checkout] failed:", err);
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ url: session.url });
}

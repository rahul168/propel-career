import Link from "next/link";
import { stripe } from "@/lib/stripe/client";
import { CREDIT_PACKS } from "@/lib/stripe/products";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;

  let creditsAdded = 0;
  let packName = "";
  let amountPaid = "$0.00";

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      creditsAdded = Number(session.metadata?.credits ?? 0);
      amountPaid = `$${((session.amount_total ?? 0) / 100).toFixed(2)}`;
      const pack = CREDIT_PACKS.find((p) => p.credits === creditsAdded);
      packName = pack?.label ?? "";
    } catch {
      // Invalid session ID — show generic success
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="text-7xl mb-6">🎉</div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-3">Payment Successful!</h1>

      {creditsAdded > 0 ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-7 mb-8">
          <div className="text-4xl font-black text-green-700 mb-1">{creditsAdded}</div>
          <div className="text-lg font-bold text-green-700 mb-1">Credits Added</div>
          {packName && (
            <div className="text-slate-500 text-sm mt-1">
              {packName} Pack · {amountPaid}
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-500 mb-8">Your credits have been added to your account.</p>
      )}

      <div className="space-y-3">
        <Link
          href="/analyze"
          className="block bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-px"
        >
          Start Analyzing →
        </Link>
        <Link
          href="/account"
          className="block text-blue-600 hover:text-blue-800 text-sm transition-colors"
        >
          View My Account
        </Link>
      </div>
    </div>
  );
}

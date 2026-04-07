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
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-bold mb-3 text-gray-900">Payment Successful!</h1>

      {creditsAdded > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <div className="text-2xl font-bold text-green-700">{creditsAdded} Credits Added</div>
          {packName && (
            <div className="text-gray-600 mt-1">
              {packName} Pack · {amountPaid}
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 mb-8">Your credits have been added to your account.</p>
      )}

      <div className="space-y-3">
        <Link
          href="/analyze"
          className="block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Start Analyzing →
        </Link>
        <Link
          href="/account"
          className="block text-blue-600 hover:text-blue-800 text-sm"
        >
          View My Account
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { getCreditStatus, CREDIT_THRESHOLDS } from "@/lib/credits/thresholds";
import { CreditStatusBanner } from "@/components/CreditStatusBanner";

const FEATURE_LABELS: Record<string, string> = {
  "analyze-match": "Resume Analysis",
  "suggest-improvements": "Suggestions",
  "parse-resume": "Resume Upload",
  "parse-resume-adobe": "Resume Upload (PDF)",
  "generate-resume": "PDF Generation",
  "generate-resume-adobe": "PDF Generation (Adobe)",
};

const FEATURE_CREDITS_USED: Record<string, number> = {
  "analyze-match": 1,
  "parse-resume-adobe": 1,
  "generate-resume-adobe": 1,
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function AccountPage() {
  const { userId } = await auth();

  const [user, usageEvents, purchases] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId! } }),
    prisma.usageEvent.findMany({
      where: { userId: userId!, statusCode: 200 },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, feature: true, createdAt: true },
    }),
    prisma.purchase.findMany({
      where: { userId: userId! },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const credits = user?.credits ?? 0;
  const status = getCreditStatus(credits);
  const creditsUsed = usageEvents.reduce((sum, e) => sum + (FEATURE_CREDITS_USED[e.feature] ?? 0), 0);
  const totalCreditsPurchased = purchases.reduce((sum, p) => sum + p.creditsAdded, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Account</h1>

      <CreditStatusBanner status={status} credits={credits} />

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Credit Balance</div>
          <div className="text-4xl font-bold text-gray-900">{credits}</div>
          <div className="text-xs text-gray-400 mt-1">
            Reminder at ≤{CREDIT_THRESHOLDS.reminder} · Warning at ≤{CREDIT_THRESHOLDS.warning}
          </div>
          <Link
            href="/pricing"
            className="mt-3 inline-block text-sm text-blue-600 font-medium hover:underline"
          >
            Buy More Credits →
          </Link>
        </div>

        <div className="bg-white border rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Credits Used (All Time)</div>
          <div className="text-4xl font-bold text-gray-900">{creditsUsed}</div>
          <div className="text-sm text-gray-400 mt-1">
            {totalCreditsPurchased} total purchased
          </div>
        </div>
      </div>

      {usageEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Usage History</h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Feature</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Credits Used</th>
                </tr>
              </thead>
              <tbody>
                {usageEvents.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="px-4 py-3 text-gray-700">
                      {FEATURE_LABELS[event.feature] ?? event.feature}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(event.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {FEATURE_CREDITS_USED[event.feature] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {purchases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Purchase History</h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Pack</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 text-gray-700">{p.creditsAdded} credits</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ${(p.amountPaid / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link
          href="/analyze"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
        >
          Start New Analysis
        </Link>
        <Link
          href="/pricing"
          className="bg-white border text-gray-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-sm"
        >
          Buy More Credits
        </Link>
      </div>
    </div>
  );
}

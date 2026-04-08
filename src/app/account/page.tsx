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
  "generate-resume-adobe": "PDF Generation",
};

const FEATURE_CREDITS_USED: Record<string, number> = {
  "analyze-match": 1,
  "parse-resume-adobe": 1,
  "generate-resume-adobe": 1,
};

type CreditHistoryEntry =
  | { kind: "consumed"; id: string; label: string; amount: number; date: Date }
  | { kind: "added"; id: string; label: string; amount: number; date: Date; paid: number };

type FilterType = "all" | "added" | "used" | "free";
type SortKey = "date" | "credits";
type SortDir = "asc" | "desc";
type SortType = `${SortKey}_${SortDir}`;

const PAGE_SIZE = 10;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildUrl(params: Record<string, string | number>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  return `/account?${sp.toString()}`;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; sort?: string }>;
}) {
  const { userId } = await auth();
  const { filter: rawFilter, page: rawPage, sort: rawSort } = await searchParams;

  const filter: FilterType =
    rawFilter === "added" || rawFilter === "used" || rawFilter === "free"
      ? rawFilter
      : "all";
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
  const sort: SortType =
    rawSort === "date_asc" || rawSort === "credits_asc" || rawSort === "credits_desc"
      ? rawSort
      : "date_desc";

  const [user, usageEvents, purchases] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId! } }),
    prisma.usageEvent.findMany({
      where: { userId: userId!, statusCode: 200 },
      orderBy: { createdAt: "desc" },
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

  const allHistory: CreditHistoryEntry[] = [
    ...usageEvents.map((e): CreditHistoryEntry => ({
      kind: "consumed",
      id: `usage-${e.id}`,
      label: FEATURE_LABELS[e.feature] ?? e.feature,
      amount: FEATURE_CREDITS_USED[e.feature] ?? 0,
      date: e.createdAt,
    })),
    ...purchases.map((p): CreditHistoryEntry => ({
      kind: "added",
      id: `purchase-${p.id}`,
      label: "Credits purchased",
      amount: p.creditsAdded,
      date: p.createdAt,
      paid: p.amountPaid,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filtered = allHistory
    .filter((e) => {
      if (filter === "all") return true;
      if (filter === "added") return e.kind === "added";
      if (filter === "free") return e.kind === "consumed" && e.amount === 0;
      if (filter === "used") return e.kind === "consumed" && e.amount > 0;
      return true;
    })
    .sort((a, b) => {
      if (sort === "date_asc") return a.date.getTime() - b.date.getTime();
      if (sort === "credits_desc") return b.amount - a.amount;
      if (sort === "credits_asc") return a.amount - b.amount;
      return b.date.getTime() - a.date.getTime(); // date_desc default
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filterCounts: Record<FilterType, number> = {
    all: allHistory.length,
    added: allHistory.filter((e) => e.kind === "added").length,
    used: allHistory.filter((e) => e.kind === "consumed" && e.amount > 0).length,
    free: allHistory.filter((e) => e.kind === "consumed" && e.amount === 0).length,
  };

  const FILTER_TABS: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "added", label: "Added" },
    { key: "used", label: "Used" },
    { key: "free", label: "Free" },
  ];

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

      {allHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Credit History</h2>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-3">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = filter === key;
              return (
                <Link
                  key={key}
                  href={buildUrl({ filter: key, page: 1, sort })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "bg-white border text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {filterCounts[key]}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            {pageItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                No entries for this filter.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      <Link
                        href={buildUrl({ filter, page: 1, sort: sort === "date_desc" ? "date_asc" : "date_desc" })}
                        className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                      >
                        Date
                        <span className="text-[11px]">
                          {sort === "date_desc" ? "↓" : sort === "date_asc" ? "↑" : "↕"}
                        </span>
                      </Link>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      <Link
                        href={buildUrl({ filter, page: 1, sort: sort === "credits_desc" ? "credits_asc" : "credits_desc" })}
                        className="inline-flex items-center justify-end gap-1 w-full hover:text-gray-800 transition-colors"
                      >
                        Credits
                        <span className="text-[11px]">
                          {sort === "credits_desc" ? "↓" : sort === "credits_asc" ? "↑" : "↕"}
                        </span>
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) =>
                    entry.kind === "added" ? (
                      <tr key={entry.id} className="border-t bg-green-50/40 hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            Added
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {entry.label}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          +{entry.amount}
                        </td>
                      </tr>
                    ) : entry.amount === 0 ? (
                      <tr key={entry.id} className="border-t bg-gray-50/60 hover:bg-gray-100/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                            Free
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{entry.label}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-400">0</td>
                      </tr>
                    ) : (
                      <tr key={entry.id} className="border-t hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                            Used
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{entry.label}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">
                          −{entry.amount}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <span className="text-xs text-gray-500">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildUrl({ filter, page: currentPage - 1, sort })}
                    aria-disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      currentPage === 1
                        ? "pointer-events-none text-gray-300 border-gray-200 bg-white"
                        : "text-gray-600 border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    ← Previous
                  </Link>
                  <span className="text-xs text-gray-500 px-1">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Link
                    href={buildUrl({ filter, page: currentPage + 1, sort })}
                    aria-disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      currentPage === totalPages
                        ? "pointer-events-none text-gray-300 border-gray-200 bg-white"
                        : "text-gray-600 border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    Next →
                  </Link>
                </div>
              </div>
            )}
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

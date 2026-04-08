"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreditStatus } from "@/lib/credits/thresholds";

interface Props {
  status: CreditStatus;
  credits: number;
}

export function CreditStatusBanner({ status, credits }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (status === "ok" || status === "empty" || dismissed) return null;

  const isWarning = status === "warning";

  return (
    <div
      className={`rounded-lg px-4 py-3 flex items-center justify-between mb-4 text-sm font-medium ${
        isWarning
          ? "bg-red-50 border border-red-200 text-red-800"
          : "bg-yellow-50 border border-yellow-200 text-yellow-800"
      }`}
    >
      <span>
        {isWarning
          ? `⚠️ Only ${credits} credit${credits === 1 ? "" : "s"} remaining — top up to keep analyzing.`
          : `💡 You have ${credits} credits left. Consider buying more soon.`}
      </span>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <Link href="/pricing" className="font-semibold underline underline-offset-2 whitespace-nowrap hover:no-underline transition-all">
          Buy Credits →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-current opacity-50 hover:opacity-100 text-xl leading-none transition-opacity"
        >
          ×
        </button>
      </div>
    </div>
  );
}

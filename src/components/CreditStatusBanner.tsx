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
      className={`rounded-md px-4 py-3 flex items-center justify-between mb-4 ${
        isWarning
          ? "bg-red-50 border border-red-300 text-red-800"
          : "bg-yellow-50 border border-yellow-300 text-yellow-800"
      }`}
    >
      <span className="text-sm">
        {isWarning
          ? `⚠️ Only ${credits} credit${credits === 1 ? "" : "s"} remaining — top up to keep analyzing.`
          : `💡 You have ${credits} credits left. Consider buying more soon.`}
      </span>
      <div className="flex items-center gap-3 ml-4">
        <Link href="/pricing" className="font-semibold underline text-sm whitespace-nowrap">
          Buy Credits →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

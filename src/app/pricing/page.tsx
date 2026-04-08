"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";

const plans = [
  {
    id: "free",
    name: "Free Preview",
    price: "$0",
    priceSub: "No credits needed",
    priceDesc: "Free account required",
    credits: null,
    perAnalysis: null,
    highlight: false,
    free: true,
    cta: "Try Free Now →",
    ctaHref: "/analyze",
    features: {
      category: true,
      score: false,
      keywords: false,
      suggestions: false,
      pdf: false,
    },
  },
  {
    id: "starter",
    name: "Starter",
    price: "$2.99",
    priceSub: "10 credits",
    priceDesc: "$0.30 / analysis",
    credits: 10,
    perAnalysis: "$0.30",
    highlight: false,
    free: false,
    cta: "Buy Starter Pack →",
    ctaHref: null,
    features: {
      category: true,
      score: true,
      keywords: true,
      suggestions: true,
      pdf: true,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4.80",
    priceSub: "20 credits",
    priceDesc: "$0.24 / analysis",
    credits: 20,
    perAnalysis: "$0.24",
    highlight: true,
    free: false,
    cta: "Buy Pro Pack →",
    ctaHref: null,
    badge: "Best Value — Save 20%",
    features: {
      category: true,
      score: true,
      keywords: true,
      suggestions: true,
      pdf: true,
    },
  },
];

const featureRows = [
  { label: "Match Category (Low / Med / High / Excellent)", key: "category" },
  { label: "Exact ATS Score (0–100)", key: "score" },
  { label: "Keyword Breakdown", key: "keywords" },
  { label: "AI Wording Suggestions", key: "suggestions" },
  { label: "PDF Download", key: "pdf" },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (packId: "starter" | "pro") => {
    setLoading(packId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Checkout failed. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Checkout failed. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-14">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          Simple, Pay-As-You-Go Pricing
        </h1>
        <p className="text-slate-600 text-base">One credit = one complete resume analysis. No subscription, no expiry.</p>
        <p className="text-slate-400 text-base">(pdf upload/download costs additional credits)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border-2 p-7 flex flex-col transition-all ${
              plan.free
                ? "border-green-400 bg-gradient-to-b from-green-50 to-white"
                : plan.highlight
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : "border-slate-200 bg-white"
            }`}
          >
            {/* Badge */}
            {"badge" in plan && plan.badge && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-[10px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
                {plan.badge}
              </div>
            )}
            {plan.free && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
                🆓 FREE for a limited time
              </div>
            )}

            <h2 className="text-lg font-bold text-slate-900 mb-1 mt-1">{plan.name}</h2>

            <div className={`text-4xl font-black mb-1 ${plan.free ? "text-green-700" : "text-slate-900"}`}>
              {plan.price}
            </div>
            <div className={`text-sm font-semibold mb-0.5 ${plan.free ? "text-green-600" : "text-blue-600"}`}>
              {plan.priceSub}
            </div>
            <div className="text-xs text-slate-400 mb-5">{plan.priceDesc}</div>

            {/* Feature list */}
            <ul className="flex-1 mb-6 space-y-2">
              {featureRows.map((row) => {
                const included = plan.features[row.key as keyof typeof plan.features];
                return (
                  <li key={row.key} className="flex items-start gap-2 text-xs text-slate-600">
                    {included ? (
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />
                    )}
                    <span className={included ? "" : "text-slate-400"}>{row.label}</span>
                  </li>
                );
              })}
            </ul>

            {/* CTA */}
            {plan.ctaHref ? (
              <Link
                href={plan.ctaHref}
                className={`block text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-[0.98] shadow-sm ${
                  plan.free
                    ? "bg-green-600 text-white hover:bg-green-700 hover:-translate-y-px hover:shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {plan.cta}
              </Link>
            ) : (
              <button
                onClick={() => handleBuy(plan.id as "starter" | "pro")}
                disabled={loading === plan.id}
                className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:pointer-events-none ${
                  plan.highlight
                    ? "bg-blue-700 text-white hover:bg-blue-800 hover:-translate-y-px hover:shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {loading === plan.id ? "Loading…" : plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Full Feature Comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className={`text-center px-4 py-3 font-semibold text-sm ${p.highlight ? "text-blue-700" : "text-slate-700"}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureRows.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                <td className="px-6 py-3 text-slate-600">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center px-4 py-3">
                    {p.features[row.key as keyof typeof p.features] ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

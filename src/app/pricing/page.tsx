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
    credits: null,
    perAnalysis: null,
    highlight: false,
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
    credits: 10,
    perAnalysis: "$0.30",
    highlight: false,
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
    credits: 20,
    perAnalysis: "$0.24",
    highlight: true,
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
  { label: "Match Category (Low/Med/High/Excellent)", key: "category" },
  { label: "Exact ATS Score", key: "score" },
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
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-3">Simple, Pay-As-You-Go Pricing</h1>
      <p className="text-center text-gray-500 mb-12">No subscription. Credits never expire.</p>

      <div className="grid grid-cols-3 gap-6 mb-12">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl border-2 p-8 flex flex-col ${
              plan.highlight ? "border-blue-500 shadow-lg" : "border-gray-200"
            }`}
          >
            {"badge" in plan && plan.badge && (
              <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full self-start mb-4">
                {plan.badge}
              </div>
            )}
            <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
            <div className="text-4xl font-bold text-gray-900 mb-1">{plan.price}</div>
            {plan.credits ? (
              <div className="text-sm text-gray-500 mb-6">
                {plan.credits} credits · {plan.perAnalysis}/analysis
              </div>
            ) : (
              <div className="text-sm text-gray-500 mb-6">Match category only</div>
            )}

            {plan.ctaHref ? (
              <Link
                href={plan.ctaHref}
                className={`block text-center py-2.5 px-4 rounded-lg font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {plan.cta}
              </Link>
            ) : (
              <button
                onClick={() => handleBuy(plan.id as "starter" | "pro")}
                disabled={loading === plan.id}
                className={`py-2.5 px-4 rounded-lg font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                {loading === plan.id ? "Loading..." : plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="text-center px-4 py-3 font-semibold">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureRows.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-6 py-3 text-gray-700">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center px-4 py-3">
                    {p.features[row.key as keyof typeof p.features] ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 mx-auto" />
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

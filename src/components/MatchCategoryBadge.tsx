import type { MatchCategory } from "@/types";
import { getCategoryFromScore } from "@/types";

interface MatchCategoryBadgeProps {
  score: number;
}

const categoryConfig: Record<
  MatchCategory,
  { styles: string; label: string; icon: string; range: string }
> = {
  Low: {
    styles: "bg-red-50 border-red-300 text-red-800",
    label: "LOW MATCH",
    icon: "⚠️",
    range: "Score range: 0%–49%",
  },
  Medium: {
    styles: "bg-orange-50 border-orange-300 text-orange-800",
    label: "MEDIUM MATCH",
    icon: "📊",
    range: "Score range: 50%–69%",
  },
  High: {
    styles: "bg-yellow-50 border-yellow-300 text-yellow-800",
    label: "HIGH MATCH",
    icon: "✨",
    range: "Score range: 70%–79%",
  },
  Excellent: {
    styles: "bg-green-50 border-green-300 text-green-800",
    label: "EXCELLENT MATCH",
    icon: "🎯",
    range: "Score range: 80%–100%",
  },
};

export function MatchCategoryBadge({ score }: MatchCategoryBadgeProps) {
  const category = getCategoryFromScore(score);
  const config = categoryConfig[category];

  return (
    <div className={`border-2 rounded-xl p-8 text-center ${config.styles}`}>
      <div className="text-4xl mb-3">{config.icon}</div>
      <div className="text-3xl font-bold tracking-wide">{config.label}</div>
      <div className="text-sm mt-2 opacity-75">{config.range}</div>
      <p className="mt-4 text-sm">
        Your resume has been analyzed. Unlock the full report to see your exact score, keyword
        breakdown, and personalized suggestions.
      </p>
    </div>
  );
}

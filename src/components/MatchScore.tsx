import type { MatchAnalysis } from "@/types";

interface MatchScoreProps {
  analysis: MatchAnalysis;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-500";
  return "text-red-600";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 70) return "bg-yellow-500";
  if (score >= 50) return "bg-orange-400";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 70) return "High Match";
  if (score >= 50) return "Medium Match";
  return "Low Match";
}

export function MatchScore({ analysis }: MatchScoreProps) {
  const { score, matchedKeywords, missingKeywords } = analysis;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`text-6xl font-bold ${getScoreColor(score)}`}>{score}</div>
        <div className="text-gray-500 text-sm mt-1">out of 100</div>
        <div className={`font-semibold mt-2 ${getScoreColor(score)}`}>{getScoreLabel(score)}</div>
        <div className="mt-3 bg-gray-200 rounded-full h-3 max-w-xs mx-auto">
          <div
            className={`h-3 rounded-full transition-all ${getBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold text-green-700 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            Matched Keywords ({matchedKeywords.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {matchedKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
            Missing Keywords ({missingKeywords.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {missingKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

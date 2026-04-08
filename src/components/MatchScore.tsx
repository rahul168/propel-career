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
      {/* Score */}
      <div className="text-center py-2">
        <div className={`text-[72px] font-black leading-none ${getScoreColor(score)}`}>{score}</div>
        <div className="text-slate-400 text-sm mt-1">out of 100</div>
        <div className={`font-bold text-base mt-2 ${getScoreColor(score)}`}>{getScoreLabel(score)}</div>
        <div className="mt-4 bg-slate-100 rounded-full h-2.5 max-w-xs mx-auto overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Keywords */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            Matched Keywords
            <span className="ml-auto text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
              {matchedKeywords.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {matchedKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded-full text-xs font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
            Missing Keywords
            <span className="ml-auto text-xs font-normal text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
              {missingKeywords.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {missingKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded-full text-xs font-medium"
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

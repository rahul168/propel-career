export interface MatchAnalysis {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}

export interface Suggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  accepted: boolean;
}

export interface ResumeStructure {
  name: string;
  contact: string;
  sections: { title: string; content: string }[];
}

export type MatchCategory = "Low" | "Medium" | "High" | "Excellent";

export function getCategoryFromScore(score: number): MatchCategory {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

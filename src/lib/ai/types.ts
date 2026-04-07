import type { MatchAnalysis, Suggestion } from "@/types";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

export interface AIResult<T> {
  data: T;
  usage: TokenUsage;
}

export interface AIProvider {
  analyzeMatch(resumeText: string, jobDescription: string): Promise<AIResult<MatchAnalysis>>;
  suggestImprovements(resumeText: string, jobDescription: string): Promise<AIResult<{ suggestions: Suggestion[] }>>;
}

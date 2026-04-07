import type { AIProvider, AIResult, TokenUsage } from "./types";
import type { MatchAnalysis, Suggestion } from "@/types";

const MOCK_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  model: "mock",
  provider: "mock",
};

const SECTIONS = ["Experience", "Skills", "Summary", "Education", "Projects"];

function extractWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9+#.]/g, ""))
    .filter((w) => w.length > 3);
}

function shuffleWords(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words.join(" ");
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  while (result.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function extractPhrases(text: string): string[] {
  return text
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4 && s.split(/\s+/).length <= 12);
}

export class MockProvider implements AIProvider {
  async analyzeMatch(resumeText: string, jobDescription: string): Promise<AIResult<MatchAnalysis>> {
    const resumeWords = new Set(extractWords(resumeText).map((w) => w.toLowerCase()));
    const jdWords = extractWords(jobDescription);

    const unique = [...new Set(jdWords.map((w) => w.toLowerCase()))];
    const matched = unique.filter((w) => resumeWords.has(w));
    const missing = unique.filter((w) => !resumeWords.has(w));

    const score = Math.min(
      100,
      Math.max(20, Math.round(30 + (matched.length / Math.max(1, unique.length)) * 50 + Math.random() * 10))
    );

    const data: MatchAnalysis = {
      score,
      matchedKeywords: pickRandom(matched, Math.min(8, matched.length)).map(
        (w) => w.charAt(0).toUpperCase() + w.slice(1)
      ),
      missingKeywords: pickRandom(missing, Math.min(6, missing.length)).map(
        (w) => w.charAt(0).toUpperCase() + w.slice(1)
      ),
    };

    return { data, usage: MOCK_USAGE };
  }

  async suggestImprovements(
    resumeText: string,
    _jobDescription: string
  ): Promise<AIResult<{ suggestions: Suggestion[] }>> {
    const phrases = extractPhrases(resumeText);
    const selected = pickRandom(phrases, Math.min(8, phrases.length));

    const suggestions: Suggestion[] = selected.map((original, i) => ({
      id: `mock-${i}`,
      section: SECTIONS[i % SECTIONS.length],
      original,
      suggested: shuffleWords(original),
      reason: "Mock mode: words reordered from original text — no LLM call made.",
      accepted: true,
    }));

    return { data: { suggestions }, usage: MOCK_USAGE };
  }
}

import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";
import { MockProvider } from "./mock";
import type { AIProvider } from "./types";

let _provider: AIProvider | null = null;

function getProvider(): AIProvider {
  if (!_provider) {
    if (process.env.AI_MOCK_MODE === "true") {
      _provider = new MockProvider();
    } else {
      _provider = process.env.AI_PROVIDER === "openai" ? new OpenAIProvider() : new ClaudeProvider();
    }
  }
  return _provider;
}

export function analyzeMatch(resumeText: string, jobDescription: string) {
  return getProvider().analyzeMatch(resumeText, jobDescription);
}

export function suggestImprovements(resumeText: string, jobDescription: string) {
  return getProvider().suggestImprovements(resumeText, jobDescription);
}

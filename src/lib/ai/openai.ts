import OpenAI from "openai";
import { z } from "zod";
import type { AIProvider, AIResult, TokenUsage } from "./types";
import type { MatchAnalysis, Suggestion } from "@/types";

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const MatchAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
});

const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      section: z.string(),
      original: z.string(),
      suggested: z.string(),
      reason: z.string(),
      accepted: z.boolean().optional().default(true),
    })
  ),
});

async function chatWithSchema<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const client = getClient();
  const MODEL = process.env.AI_MODEL ?? "gpt-4o";

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");
  const data = schema.parse(raw);
  return {
    data,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

export class OpenAIProvider implements AIProvider {
  async analyzeMatch(resumeText: string, jobDescription: string): Promise<AIResult<MatchAnalysis>> {
    const MODEL = process.env.AI_MODEL ?? "gpt-4o";
    const result = await chatWithSchema(
      `You are an expert ATS analyzer. Score how well a resume matches a job description on a 0-100 scale.
Scoring: 40% keyword match, 25% role alignment, 25% responsibility overlap, 10% completeness.
Calibration: 70+ = genuinely competitive; most resumes score 30-60 before optimization.
Return JSON with fields: score (number), matchedKeywords (string[]), missingKeywords (string[]).`,
      `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`,
      MatchAnalysisSchema
    );

    const usage: TokenUsage = {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: MODEL,
      provider: "openai",
    };
    return { data: result.data, usage };
  }

  async suggestImprovements(
    resumeText: string,
    jobDescription: string
  ): Promise<AIResult<{ suggestions: Suggestion[] }>> {
    const MODEL = process.env.AI_MODEL ?? "gpt-4o";
    const result = await chatWithSchema(
      `You are an expert resume optimizer. Generate 8-12 specific wording improvements to increase ATS match score.
Rules: original must be verbatim resume text; suggested is a drop-in replacement; NEVER fabricate skills; each reason names specific JD keywords.
Return JSON with field: suggestions (array of {id (string like "s1"), section, original, suggested, reason, accepted: true}).`,
      `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`,
      SuggestionsSchema
    );

    const usage: TokenUsage = {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: MODEL,
      provider: "openai",
    };
    return { data: result.data, usage };
  }
}

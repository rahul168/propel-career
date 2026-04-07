import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AIProvider, AIResult, TokenUsage } from "./types";
import type { MatchAnalysis, Suggestion } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const matchAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
});

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      section: z.string(),
      original: z.string(),
      suggested: z.string(),
      reason: z.string(),
      accepted: z.boolean().optional().default(true),
    })
  ),
});

export class ClaudeProvider implements AIProvider {
  async analyzeMatch(resumeText: string, jobDescription: string): Promise<AIResult<MatchAnalysis>> {
    const client = getClient();
    const MODEL = process.env.AI_MODEL ?? "claude-opus-4-6";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      system: `You are an expert ATS (Applicant Tracking System) analyzer. Score how well a resume matches a job description on a 0-100 scale.

Scoring criteria:
- 40%: Keyword match (specific tech, tools, certifications — no generic soft skills)
- 25%: Role/seniority level alignment
- 25%: Responsibility overlap
- 10%: Resume completeness

Calibration: 70+ = genuinely competitive; most resumes score 30-60 before optimization. Be precise and realistic.`,
      messages: [
        {
          role: "user",
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`,
        },
      ],
      tools: [
        {
          name: "report_match_analysis",
          description: "Report the ATS match analysis result",
          input_schema: {
            type: "object" as const,
            properties: {
              score: { type: "number", description: "Match score 0-100" },
              matchedKeywords: {
                type: "array",
                items: { type: "string" },
                description: "Keywords found in both resume and JD",
              },
              missingKeywords: {
                type: "array",
                items: { type: "string" },
                description: "Important JD keywords missing from resume",
              },
            },
            required: ["score", "matchedKeywords", "missingKeywords"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "report_match_analysis" },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");

    const data = matchAnalysisSchema.parse(toolUse.input);
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
      provider: "claude",
    };
    return { data, usage };
  }

  async suggestImprovements(
    resumeText: string,
    jobDescription: string
  ): Promise<AIResult<{ suggestions: Suggestion[] }>> {
    const client = getClient();
    const MODEL = process.env.AI_MODEL ?? "claude-opus-4-6";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: `You are an expert resume optimizer. Generate 8-12 specific wording improvements to increase ATS match score.

Rules:
- original: must be verbatim text from the resume
- suggested: must be a direct drop-in replacement
- NEVER fabricate experience or skills
- Each reason must name specific JD keywords being addressed
- Order by impact (highest first)`,
      messages: [
        {
          role: "user",
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`,
        },
      ],
      tools: [
        {
          name: "report_suggestions",
          description: "Report the list of resume improvement suggestions",
          input_schema: {
            type: "object" as const,
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    section: { type: "string" },
                    original: { type: "string" },
                    suggested: { type: "string" },
                    reason: { type: "string" },
                    accepted: { type: "boolean" },
                  },
                  required: ["id", "section", "original", "suggested", "reason", "accepted"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "report_suggestions" },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");

    const data = suggestionsSchema.parse(toolUse.input);
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
      provider: "claude",
    };
    return { data, usage };
  }
}

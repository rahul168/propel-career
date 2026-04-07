export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15_000_000, output: 75_000_000 },
  "claude-sonnet-4-6": { input: 3_000_000, output: 15_000_000 },
  "gpt-4o": { input: 5_000_000, output: 15_000_000 },
  "gpt-4o-mini": { input: 150_000, output: 600_000 },
};

export function calculateCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["claude-opus-4-6"];
  return Math.round((inputTokens * p.input + outputTokens * p.output) / 1_000_000);
}

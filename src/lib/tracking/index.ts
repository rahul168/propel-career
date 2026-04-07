import { prisma } from "@/lib/db/prisma";
import { calculateCostMicros } from "@/lib/ai/pricing";
import type { TokenUsage } from "@/lib/ai/types";

export async function logUsage(
  userId: string,
  feature: string,
  statusCode: number,
  durationMs: number
): Promise<string> {
  try {
    const event = await prisma.usageEvent.create({
      data: { userId, feature, statusCode, durationMs },
    });
    return event.id;
  } catch (err) {
    // Non-fatal — don't let tracking failures break the user-facing response
    console.error("[logUsage] failed:", err);
    return "";
  }
}

export async function logLlmUsage(
  usageEventId: string,
  operation: string,
  usage: TokenUsage
): Promise<void> {
  if (!usageEventId) return;
  try {
    const totalTokens = usage.inputTokens + usage.outputTokens;
    const costUsdMicros = calculateCostMicros(usage.model, usage.inputTokens, usage.outputTokens);
    await prisma.llmUsage.create({
      data: {
        usageEventId,
        provider: usage.provider,
        model: usage.model,
        operation,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens,
        costUsdMicros,
      },
    });
  } catch (err) {
    // Non-fatal — don't let tracking failures break the user-facing response
    console.error("[logLlmUsage] failed:", err);
  }
}

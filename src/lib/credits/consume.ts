import { prisma } from "@/lib/db/prisma";

export class InsufficientCreditsError extends Error {
  constructor(message = "Insufficient credits") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Atomically consumes credits from a user's balance.
 * Returns true if credits were consumed, false if user has insufficient balance (or doesn't exist).
 */
export async function tryConsumeCredits(userId: string, amount = 1): Promise<boolean> {
  if (!userId) return false;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid credit amount: ${amount}`);
  }

  const res = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });

  return res.count === 1;
}

/**
 * Consumes credits or throws InsufficientCreditsError.
 */
export async function consumeCreditsOrThrow(userId: string, amount = 1): Promise<void> {
  const ok = await tryConsumeCredits(userId, amount);
  if (!ok) throw new InsufficientCreditsError();
}

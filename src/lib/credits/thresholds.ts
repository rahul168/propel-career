export const CREDIT_THRESHOLDS = {
  reminder: parseInt(process.env.CREDIT_REMINDER_THRESHOLD ?? "3", 10),
  warning: parseInt(process.env.CREDIT_WARNING_THRESHOLD ?? "1", 10),
} as const;

export type CreditStatus = "ok" | "reminder" | "warning" | "empty";

export function getCreditStatus(credits: number): CreditStatus {
  if (credits <= 0) return "empty";
  if (credits <= CREDIT_THRESHOLDS.warning) return "warning";
  if (credits <= CREDIT_THRESHOLDS.reminder) return "reminder";
  return "ok";
}

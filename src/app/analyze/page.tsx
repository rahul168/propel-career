import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { getCreditStatus } from "@/lib/credits/thresholds";
import { AnalyzeFlow } from "@/components/AnalyzeFlow";
import { CreditStatusBanner } from "@/components/CreditStatusBanner";

export default async function AnalyzePage() {
  const clerkUser = await currentUser();
  const userId = clerkUser!.id;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";

  // Auto-provision DB row on first visit (new Clerk users have no User row yet)
  const user = await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, credits: 0 },
    update: {},
  });
  const credits = user.credits;
  const hasPaid = credits > 0;
  const status = getCreditStatus(credits);

  return (
    <div className="max-w-[81.12rem] mx-auto px-4 pt-6">
      {hasPaid && <CreditStatusBanner status={status} credits={credits} />}
      <AnalyzeFlow hasPaid={hasPaid} />
    </div>
  );
}

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") {
    redirect("/");
  }
  const userId = user.id;

  const [users, purchases, usageEvents, llmUsage, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.purchase.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.usageEvent.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.llmUsage.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const totalRevenue = purchases.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalLlmCost = llmUsage.reduce((sum, l) => sum + l.costUsdMicros, 0);
  const grossMargin =
    totalRevenue > 0
      ? (((totalRevenue - totalLlmCost / 1_000_000) / totalRevenue) * 100).toFixed(1)
      : "0.0";
  const totalAnalyses = usageEvents.filter((e) => e.feature === "analyze-match").length;

  return (
    <AdminDashboard
      users={JSON.parse(JSON.stringify(users))}
      purchases={JSON.parse(JSON.stringify(purchases))}
      usageEvents={JSON.parse(JSON.stringify(usageEvents))}
      llmUsage={JSON.parse(JSON.stringify(llmUsage))}
      auditLogs={JSON.parse(JSON.stringify(auditLogs))}
      stats={{ totalRevenue, totalLlmCost, grossMargin, totalAnalyses }}
    />
  );
}

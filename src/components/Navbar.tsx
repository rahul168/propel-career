import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { getCreditStatus } from "@/lib/credits/thresholds";
import { Shield } from "lucide-react";

const badgeColors: Record<string, string> = {
  ok: "bg-gray-100 text-gray-700",
  reminder: "bg-yellow-100 text-yellow-800",
  warning: "bg-red-100 text-red-700",
  empty: "bg-red-200 text-red-900",
};

export async function Navbar() {
  const { userId, sessionClaims } = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (sessionClaims as any)?.publicMetadata?.role === "admin";

  let credits = 0;
  if (userId && !isAdmin) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    credits = user?.credits ?? 0;
  }
  const status = getCreditStatus(credits);

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-blue-600">
          Propel Career
        </Link>

        <div className="flex items-center gap-4">
          {userId ? (
            isAdmin ? (
              <>
                <Link
                  href="/admin"
                  className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link href="/analyze" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150">
                  Optimizer
                </Link>
                <Link href="/account" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150">
                  My Account
                </Link>
                <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150">
                  Pricing
                </Link>
                <Link href="/api-docs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150">
                  API Docs
                </Link>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeColors[status]}`}
                >
                  {credits} credits
                </span>
                <UserButton />
              </>
            )
          ) : (
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 hover:-translate-y-px hover:shadow-md transition-all duration-150 active:scale-[0.98]"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

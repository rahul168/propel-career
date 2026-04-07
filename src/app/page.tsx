import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { FileText, Zap, Download } from "lucide-react";

export default async function LandingPage() {
  const { userId, sessionClaims } = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (sessionClaims as any)?.publicMetadata?.role === "admin";

  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-4">
        Optimize Your Resume for{" "}
        <span className="text-blue-600">Any Job in Seconds</span>
      </h1>
      <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
        Upload your resume, paste a job description, and get an instant ATS match result — free with
        a quick sign-up.
      </p>

      <div className="flex gap-4 justify-center mb-16">
        {userId ? (
          isAdmin ? (
            <Link
              href="/admin"
              className="bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Go to Admin Dashboard
            </Link>
          ) : (
            <Link
              href="/analyze"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Optimizer →
            </Link>
          )
        ) : (
          <>
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Free - Sign Up
            </Link>
            <Link
              href="/sign-in"
              className="bg-white text-blue-600 border border-blue-300 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-8 text-left">
        <div className="bg-white rounded-xl border p-6">
          <FileText className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Instant ATS Scoring</h3>
          <p className="text-sm text-gray-500">
            Get a 0–100 match score showing how well your resume aligns with the job description.
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <Zap className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">AI-Powered Suggestions</h3>
          <p className="text-sm text-gray-500">
            Receive 8–12 specific, targeted wording improvements — not generic advice.
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <Download className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">One-Click PDF Export</h3>
          <p className="text-sm text-gray-500">
            Accept the changes you want and download a polished, updated resume instantly.
          </p>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { FileText, Zap, Download } from "lucide-react";

export default async function LandingPage() {
  const { userId, sessionClaims } = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (sessionClaims as any)?.publicMetadata?.role === "admin";

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center px-6 py-14 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="inline-block mb-4 px-3.5 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">
          ✨ AI-Powered Resume Optimizer
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight mb-4 leading-tight bg-gradient-to-r from-blue-700 to-violet-600 bg-clip-text text-transparent">
          Land more interviews with<br className="hidden sm:block" /> a perfectly matched resume
        </h1>

        <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto leading-relaxed">
          Upload your resume, paste a job description, and get an instant ATS match result —{" "}
          <strong className="text-slate-700">free with a quick sign-up</strong>. Unlock the exact
          score, missing keywords, and AI rewrites when you&apos;re ready.
        </p>

        {/* Free / Paid info pills */}
        <div className="flex flex-wrap gap-2.5 justify-center mb-9">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-xs font-semibold text-green-800">
            🆓 Free: see match category (Low / Medium / High / Excellent)
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs font-semibold text-blue-800">
            💳 Paid: exact score + AI suggestions + downloadable PDF
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-3 justify-center">
          {userId ? (
            isAdmin ? (
              <Link
                href="/admin"
                className="bg-red-600 text-white px-7 py-3 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm"
              >
                Go to Admin Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/analyze"
                  className="bg-blue-700 text-white px-7 py-3 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-px"
                >
                  Go to Optimizer →
                </Link>
                <Link
                  href="/account"
                  className="bg-white text-slate-700 border border-slate-300 px-7 py-3 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  My Account
                </Link>
              </>
            )
          ) : (
            <>
              <Link
                href="/sign-up"
                className="bg-blue-700 text-white px-7 py-3 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-px"
              >
                Try Free — Sign Up
              </Link>
              <Link
                href="/sign-in"
                className="bg-white text-blue-700 border border-blue-300 px-7 py-3 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/features/ats-scoring"
          className="group bg-white rounded-xl border border-slate-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all"
        >
          <FileText className="h-9 w-9 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
            ATS Match Score
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            See exactly how well your resume matches a job — scored 0–100 using keyword, role, and
            responsibility analysis.
          </p>
          <span className="mt-3 inline-block text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Learn more →
          </span>
        </Link>

        <Link
          href="/features/ai-suggestions"
          className="group bg-white rounded-xl border border-slate-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all"
        >
          <Zap className="h-9 w-9 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
            AI Rewrite Suggestions
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Get 8–12 specific wording improvements, each showing the original vs suggested text with
            the reason why it helps.
          </p>
          <span className="mt-3 inline-block text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Learn more →
          </span>
        </Link>

        <Link
          href="/features/pdf-export"
          className="group bg-white rounded-xl border border-slate-200 p-6 text-center hover:border-blue-300 hover:shadow-md transition-all"
        >
          <Download className="h-9 w-9 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
            Download New PDF
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Accept the suggestions you want and download a polished, print-ready PDF resume — ready
            to send in seconds.
          </p>
          <span className="mt-3 inline-block text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Learn more →
          </span>
        </Link>
      </div>

      {/* ── Footer tagline ────────────────────────────────────────────────── */}
      <div className="text-center pb-12 text-xs text-slate-400">
        Pay-as-you-go · No subscription · 1 credit per analysis
      </div>
    </div>
  );
}

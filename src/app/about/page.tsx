import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Upload, Zap, Download, ShieldCheck, CreditCard, Users } from "lucide-react";

export default async function AboutPage() {
  const { userId } = await auth();

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center px-6 py-14 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="inline-block mb-4 px-3.5 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">
          Our Mission
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight bg-gradient-to-r from-blue-700 to-violet-600 bg-clip-text text-transparent">
          Helping job seekers land<br className="hidden sm:block" /> more interviews, faster
        </h1>
        <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">
          Propel8Career was built by engineers who experienced firsthand how frustrating and opaque
          the modern hiring process can be. We combined AI with ATS expertise to give every job
          seeker a fair shot at getting noticed.
        </p>
        <Link
          href={userId ? "/analyze" : "/sign-up"}
          className="bg-blue-700 text-white px-7 py-3 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-px"
        >
          {userId ? "Go to Optimizer →" : "Try Free — Sign Up"}
        </Link>
      </div>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">How it works</h2>
        <p className="text-sm text-slate-500 text-center mb-8">Three steps, under a minute.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <Upload className="h-9 w-9 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">1. Upload your resume</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Upload a PDF or DOCX — we parse it instantly so you never have to copy-paste text.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <Zap className="h-9 w-9 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">2. Paste the job description</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Our AI scores your resume against the role, surfaces missing keywords, and writes
              targeted improvement suggestions.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <Download className="h-9 w-9 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">3. Download your new resume</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Accept the suggestions you want, then download a polished PDF — ready to apply in
              seconds.
            </p>
          </div>
        </div>
      </div>

      {/* ── Values ───────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 border-t border-slate-100 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">What we stand for</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <CreditCard className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">Pay only for what you use</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                No subscriptions, no monthly fees. Buy credits when you need them and they never
                expire.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <ShieldCheck className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">Privacy first</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your resume content is used only to generate your results. We never sell or share
                your data with third parties.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <Users className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">Built for job seekers</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every feature was designed around the real pain points of applying for jobs — not
                recruiter workflows.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer tagline ────────────────────────────────────────────────── */}
      <div className="text-center py-10 text-xs text-slate-400">
        Pay-as-you-go · No subscription · 1 credit per analysis
      </div>
    </div>
  );
}

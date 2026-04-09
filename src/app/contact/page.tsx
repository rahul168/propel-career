import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Mail, Clock, LogIn } from "lucide-react";
import { SupportTicketForm } from "@/components/SupportTicketForm";

export default async function ContactPage() {
  const { userId } = await auth();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Contact Us</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          Have a question, spotted a bug, or need help with your account? We&apos;d love to hear
          from you.
        </p>
      </div>

      {/* ── Contact info cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 items-start">
          <Mail className="h-6 w-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-900 mb-0.5">Email us</h3>
            <p className="text-sm text-slate-500">
              Send us a message at{" "}
              <a
                href="mailto:support@propel8.com"
                className="text-blue-600 hover:underline font-medium"
              >
                support@propel8.com
              </a>
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 items-start">
          <Clock className="h-6 w-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-900 mb-0.5">Response time</h3>
            <p className="text-sm text-slate-500">
              We typically reply within <strong className="text-slate-700">1–2 business days</strong>.
              Billing issues are prioritised.
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 mb-10" />

      {/* ── Support Ticket section ───────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Raise a Support Ticket</h2>
        <p className="text-sm text-slate-500 mb-6">
          Use the form below to open a ticket. We&apos;ll follow up via your account email.
        </p>

        {userId ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <SupportTicketForm />
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex gap-4 items-start">
            <LogIn className="h-6 w-6 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Sign in to raise a ticket</h3>
              <p className="text-sm text-slate-500 mb-4">
                Support tickets are linked to your account so we can look up your usage and credits.
                Please sign in first.
              </p>
              <Link
                href="/sign-in?redirect_url=/contact"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 hover:-translate-y-px hover:shadow-md transition-all duration-150"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

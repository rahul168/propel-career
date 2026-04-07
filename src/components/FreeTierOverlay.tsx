import Link from "next/link";
import { Lock } from "lucide-react";

export function FreeTierOverlay() {
  return (
    <div className="relative">
      {/* Blurred background content */}
      <div className="filter blur-sm pointer-events-none select-none h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <div className="text-4xl font-bold">72</div>
          <div className="text-sm">ATS Score</div>
          <div className="flex gap-2 mt-2 flex-wrap justify-center">
            {["React", "TypeScript", "Node.js", "AWS", "Docker"].map((kw) => (
              <span key={kw} className="bg-green-200 px-2 py-0.5 rounded text-xs">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-6 shadow-2xl text-center max-w-sm mx-4">
          <Lock className="h-8 w-8 mx-auto mb-3 opacity-90" />
          <h3 className="text-xl font-bold mb-2">Unlock Full Results</h3>
          <p className="text-blue-100 text-sm mb-4">
            Get your exact ATS score, keyword breakdown, and 8–12 personalized suggestions to boost
            your match.
          </p>
          <Link
            href="/pricing"
            className="block bg-white text-blue-700 font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Buy Credits →
          </Link>
          <p className="text-blue-200 text-xs mt-3">Starting at $2.99 · No subscription</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

interface MarkdownBlogProps {
  content: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function MarkdownBlog({
  content,
  ctaLabel = "Go to Optimizer",
  ctaHref = "/analyze",
}: MarkdownBlogProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Top CTA */}
      <div className="mb-10 flex justify-end">
        <Link
          href={ctaHref}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm shadow-sm"
        >
          {ctaLabel} →
        </Link>
      </div>

      {/* Article body */}
      <article className="prose-blog">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-8 leading-tight">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-semibold text-gray-800 mb-3 mt-8 leading-snug">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold text-gray-700 mb-2 mt-6">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-gray-600 leading-relaxed mb-4">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 mb-4 text-gray-600 pl-2">
                {children}
              </ul>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-300 pl-4 py-1 my-4 text-gray-500 italic bg-blue-50 rounded-r-lg">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="my-8 border-gray-200" />,
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-800">{children}</strong>
            ),
            code: ({ children }) => (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      {/* Bottom CTA — prominent */}
      <div className="mt-12 rounded-2xl bg-blue-600 px-8 py-10 text-center shadow-lg">
        <p className="text-white text-xl font-semibold mb-2">Ready to optimize your resume?</p>
        <p className="text-blue-100 text-sm mb-6">
          Upload your resume and get an instant ATS score — free with a quick sign-up.
        </p>
        <Link
          href={ctaHref}
          className="inline-block bg-white text-blue-700 font-bold px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors shadow text-sm"
        >
          {ctaLabel} →
        </Link>
      </div>
    </div>
  );
}

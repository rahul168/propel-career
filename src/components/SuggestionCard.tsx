"use client";

import { useRef, useEffect } from "react";
import type { Suggestion } from "@/types";
import { Check, X } from "lucide-react";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onToggle: (id: string) => void;
  onEdit: (id: string, suggested: string) => void;
}

export function SuggestionCard({ suggestion, onToggle, onEdit }: SuggestionCardProps) {
  const { id, section, original, suggested, reason, accepted } = suggestion;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep textarea height in sync with content
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [suggested]);

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        accepted ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
          {section}
        </span>
        <button
          onClick={() => onToggle(id)}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            accepted
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-gray-300 text-gray-600 hover:bg-gray-400"
          }`}
        >
          {accepted ? (
            <>
              <Check className="h-3 w-3" /> Accepted
            </>
          ) : (
            <>
              <X className="h-3 w-3" /> Rejected
            </>
          )}
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-xs font-medium text-red-600 uppercase">Before</span>
          <p className="mt-0.5 text-gray-700 bg-red-50 border border-red-200 rounded p-2 line-through">
            {original}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-green-600 uppercase">After</span>
          <textarea
            ref={textareaRef}
            value={suggested}
            rows={1}
            onChange={(e) => {
              onEdit(id, e.target.value);
              autoResize(e.target);
            }}
            className="mt-0.5 w-full text-gray-700 bg-green-50 border border-green-200 rounded p-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500 italic">
        <strong>Why:</strong> {reason}
      </p>
    </div>
  );
}

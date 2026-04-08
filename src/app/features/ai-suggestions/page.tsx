import { readFileSync } from "fs";
import path from "path";
import { MarkdownBlog } from "@/components/MarkdownBlog";

export const metadata = {
  title: "AI-Powered Resume Suggestions — Propel Career",
  description:
    "Discover how AI-powered resume suggestions help you beat ATS filters and land more interviews in 2026.",
};

export default function AISuggestionsPage() {
  const content = readFileSync(
    path.join(process.cwd(), "src/static/AI-Suggestions.md"),
    "utf-8"
  );

  return <MarkdownBlog content={content} />;
}

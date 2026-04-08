import { readFileSync } from "fs";
import path from "path";
import { MarkdownBlog } from "@/components/MarkdownBlog";

export const metadata = {
  title: "Instant ATS Scoring — Propel Career",
  description:
    "Learn how ATS scoring works in 2026 and how to optimize your resume to get past automated screening systems.",
};

export default function ATSScoringPage() {
  const content = readFileSync(
    path.join(process.cwd(), "src/static/ATS.md"),
    "utf-8"
  );

  return <MarkdownBlog content={content} />;
}

import { readFileSync } from "fs";
import path from "path";
import { MarkdownBlog } from "@/components/MarkdownBlog";

export const metadata = {
  title: "One-Click PDF Export — Propel Career",
  description:
    "See how One-Click PDF export delivers a perfectly formatted, professional resume every time.",
};

export default function PDFExportPage() {
  const content = readFileSync(
    path.join(process.cwd(), "src/static/PDF-Converter.md"),
    "utf-8"
  );

  return <MarkdownBlog content={content} />;
}

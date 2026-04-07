import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";
import type { ResumeStructure, Suggestion } from "@/types";

const SECTION_HEADERS =
  /^(SUMMARY|OBJECTIVE|EXPERIENCE|WORK EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|AWARDS|PUBLICATIONS|VOLUNTEER|LANGUAGES|INTERESTS|REFERENCES|PROFILE|PROFESSIONAL SUMMARY)\s*$/im;

function inferResumeStructure(rawText: string): ResumeStructure {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let name = "";
  let contact = "";
  const sections: { title: string; content: string }[] = [];

  if (lines.length > 0) name = lines[0];
  if (lines.length > 1) contact = lines[1];

  let currentSection: { title: string; lines: string[] } | null = null;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_HEADERS.test(line)) {
      if (currentSection) {
        sections.push({ title: currentSection.title, content: currentSection.lines.join("\n") });
      }
      currentSection = { title: line.toUpperCase(), lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.push({ title: currentSection.title, content: currentSection.lines.join("\n") });
  }

  return { name, contact, sections };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    color: "#1a1a1a",
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: "#555",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 2,
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#333",
  },
});

function applySuggestions(structure: ResumeStructure, suggestions: Suggestion[]): ResumeStructure {
  const accepted = suggestions.filter((s) => s.accepted);
  if (accepted.length === 0) return structure;

  return {
    ...structure,
    sections: structure.sections.map((section) => {
      let content = section.content;
      for (const suggestion of accepted) {
        const normalizedContent = content.replace(/\s+/g, " ");
        const normalizedOriginal = suggestion.original.replace(/\s+/g, " ").trim();
        if (normalizedContent.includes(normalizedOriginal)) {
          content = normalizedContent.replace(normalizedOriginal, suggestion.suggested);
        }
      }
      return { ...section, content };
    }),
  };
}

export async function generateResumePDF(
  resumeText: string,
  acceptedSuggestions: Suggestion[]
): Promise<Buffer> {
  const structure = inferResumeStructure(resumeText);
  const updated = applySuggestions(structure, acceptedSuggestions);

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.name }, updated.name),
      React.createElement(Text, { style: styles.contact }, updated.contact),
      ...updated.sections.map((section) =>
        React.createElement(
          View,
          { key: section.title },
          React.createElement(Text, { style: styles.sectionTitle }, section.title),
          React.createElement(Text, { style: styles.sectionContent }, section.content)
        )
      )
    )
  );

  const pdfInstance = pdf(doc);
  const blob = await pdfInstance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

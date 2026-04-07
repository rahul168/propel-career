import type { Page } from "@playwright/test";

export const MOCK_ANALYSIS = {
  score: 75,
  matchedKeywords: ["React", "TypeScript", "Node.js", "REST APIs", "Git"],
  missingKeywords: ["AWS", "Docker", "Kubernetes"],
};

export const MOCK_SUGGESTIONS = [
  {
    id: "s1",
    section: "EXPERIENCE",
    original: "Worked with cloud services",
    suggested: "Deployed and managed applications on AWS EC2 and S3, reducing infrastructure costs by 20%",
    reason: "Addresses missing AWS keyword from JD",
    accepted: true,
  },
  {
    id: "s2",
    section: "SKILLS",
    original: "Familiar with containers",
    suggested: "Docker containerization and Docker Compose for microservices deployment",
    reason: "Addresses missing Docker and Kubernetes keywords",
    accepted: true,
  },
];

export async function mockAIRoutes(page: Page) {
  await page.route("**/api/analyze-match", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ANALYSIS) })
  );
  await page.route("**/api/suggest-improvements", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ suggestions: MOCK_SUGGESTIONS }),
    })
  );
}

export async function mockGenerateResume(page: Page) {
  // Return a minimal valid PDF binary
  const minimalPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF";
  await page.route("**/api/generate-resume", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "Content-Disposition": 'attachment; filename="resume.pdf"' },
      body: Buffer.from(minimalPdf),
    })
  );
}

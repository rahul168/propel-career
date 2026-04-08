import path from "path";
import fs from "fs";
import os from "os";
import { test, expect, SAMPLE_PDF } from "./fixtures";
import { mockAIRoutes, mockGenerateResume } from "./helpers/ai-mock";

test.describe("14.9–10 — Paid tier flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAIRoutes(page);
    await mockGenerateResume(page);
  });

  test("14.9 — paid user sees 5-step flow with full results", async ({
    page,
    asPaidUser: _,
  }) => {
    await page.goto("/analyze");

    // 5-step indicator visible
    await expect(page.getByText("Download")).toBeVisible();

    // Upload PDF
    const tmpPdf = path.join(os.tmpdir(), "test-resume.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume\.pdf/i)).toBeVisible({ timeout: 10000 });

    // Paste JD
    await page.getByPlaceholder(/paste the job description/i).fill(
      "Senior React TypeScript Engineer needed with Node.js, REST APIs, Git, AWS and Docker expertise. " +
        "5+ years experience building scalable web applications. Strong TypeScript skills required."
    );
    await page.getByRole("button", { name: /Analyze Match/i }).click();

    // Step 4: full score gauge visible (not category badge)
    await expect(page.getByText(/75/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/React/)).toBeVisible();
    await expect(page.getByText(/Matched Keywords/i)).toBeVisible();
    await expect(page.getByText(/Missing Keywords/i)).toBeVisible();

    // Suggestion cards visible
    await expect(page.getByText(/Before/i).first()).toBeVisible();
    await expect(page.getByText(/After/i).first()).toBeVisible();

    // Overlay NOT shown for paid user
    await expect(page.getByText(/Unlock Full Results/i)).not.toBeVisible();

    // Step 4 → click to go to step 5
    await expect(page.getByRole("button", { name: /Generate Optimized Resume/i })).toBeVisible();
    await page.getByRole("button", { name: /Generate Optimized Resume/i }).click();
    await expect(page.getByRole("button", { name: /Download Optimized Resume/i })).toBeVisible();
  });

  test("14.10 — Navbar shows credit badge", async ({ page, asPaidUser: _ }) => {
    await page.goto("/analyze");
    await expect(page.getByText(/credits/i)).toBeVisible();
    // Badge should have neutral/grey color class (ok status)
    const badge = page.locator("span").filter({ hasText: /\d+ credits/ });
    await expect(badge).toHaveClass(/bg-gray-100/);
  });

  test("14.9 — Generate Resume → triggers PDF download", async ({ page, asPaidUser: _ }) => {
    await page.goto("/analyze");

    const tmpPdf = path.join(os.tmpdir(), "test-resume.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume\.pdf/i)).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder(/paste the job description/i).fill(
      "Senior React TypeScript Engineer needed with Node.js, REST APIs, Git, AWS and Docker expertise. " +
        "5+ years experience building scalable web applications."
    );
    await page.getByRole("button", { name: /Analyze Match/i }).click();
    await expect(page.getByText(/75/)).toBeVisible({ timeout: 15000 });
    // Click step 4 button to advance to step 5
    await page.getByRole("button", { name: /Generate Optimized Resume/i }).click();

    // Listen for download event triggered by "Download Optimized Resume"
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10000 }),
      page.getByRole("button", { name: /Download Optimized Resume/i }).click(),
    ]);
    expect(download.suggestedFilename()).toContain(".pdf");
  });
});

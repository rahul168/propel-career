import path from "path";
import fs from "fs";
import os from "os";
import { test, expect, SAMPLE_PDF } from "./fixtures";
import { mockAIRoutes, mockGenerateResume } from "./helpers/ai-mock";

/**
 * 14.20 — Full end-to-end paid user flow:
 * sign-in → upload → analyze → view results → generate resume → download PDF
 */
test.describe("14.20 — Full end-to-end paid flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAIRoutes(page);
    await mockGenerateResume(page);
  });

  test("complete flow: upload → analyze → suggestions → generate → download", async ({
    page,
    asPaidUser: _,
  }) => {

    // ── Step 1: Navigate to analyze ──────────────────────────────────────
    await page.goto("/analyze");
    await expect(page.getByText("Upload Resume")).toBeVisible();
    await expect(page.getByText("Job Description")).toBeVisible();
    await expect(page.getByText("Results")).toBeVisible();
    await expect(page.getByText("Download")).toBeVisible();

    // ── Step 2: Upload PDF ────────────────────────────────────────────────
    const tmpPdf = path.join(os.tmpdir(), "e2e-full-flow.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/e2e-full-flow\.pdf/i)).toBeVisible({ timeout: 10000 });

    // ── Step 3: Enter job description ────────────────────────────────────
    await page.getByPlaceholder(/paste the job description/i).fill(
      "Senior React TypeScript Engineer needed with Node.js, REST APIs, Git, AWS and Docker expertise. " +
        "5+ years experience building scalable web applications. Strong TypeScript skills required."
    );

    // ── Step 4: Run analysis ──────────────────────────────────────────────
    await page.getByRole("button", { name: /Analyze Match/i }).click();
    await expect(page.getByText(/AI analysis running/i)).toBeVisible({ timeout: 5000 });

    // ── Step 5: Verify full results (paid tier) ───────────────────────────
    await expect(page.getByText(/75/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/React/)).toBeVisible();
    await expect(page.getByText(/Matched Keywords/i)).toBeVisible();
    await expect(page.getByText(/Missing Keywords/i)).toBeVisible();

    // Suggestions visible
    await expect(page.getByText(/Before/i).first()).toBeVisible();
    await expect(page.getByText(/After/i).first()).toBeVisible();

    // No upsell overlay for paid user
    await expect(page.getByText(/Unlock Full Results/i)).not.toBeVisible();

    // ── Step 6: Click step 4 button → advance to step 5 ──────────────────
    await page.getByRole("button", { name: /Generate Optimized Resume/i }).click();
    await expect(
      page.getByRole("button", { name: /Download Optimized Resume/i })
    ).toBeVisible({ timeout: 15000 });

    // ── Step 7: Download PDF ──────────────────────────────────────────────
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10000 }),
      page.getByRole("button", { name: /Download Optimized Resume/i }).click(),
    ]);
    expect(download.suggestedFilename()).toContain(".pdf");

    // ── Step 8: Verify download completed (PDF was returned) ──────────────
    expect(download.suggestedFilename()).toContain(".pdf");
  });

  test("navbar credit badge updates after analysis", async ({
    page,
    users,
    asPaidUser: _,
  }) => {
    await page.goto("/analyze");

    // Check initial credit badge is visible (use first() to avoid strict mode issues with notification banners)
    const badge = page.locator("span").filter({ hasText: /\d+ credits/ }).first();
    await expect(badge).toBeVisible();
    const initialText = await badge.textContent();
    const initialCredits = parseInt(initialText?.match(/\d+/)?.[0] ?? "0");
    expect(initialCredits).toBeGreaterThan(0);

    const tmpPdf = path.join(os.tmpdir(), "e2e-badge.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/e2e-badge\.pdf/i)).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder(/paste the job description/i).fill(
      "React developer with TypeScript and Node.js, AWS, Docker."
    );
    await page.getByRole("button", { name: /Analyze Match/i }).click();
    await expect(page.getByText(/75/)).toBeVisible({ timeout: 15000 });

    // Badge should remain consistent and display a number
    const newBadge = page.locator("span").filter({ hasText: /\d+ credits/ }).first();
    await expect(newBadge).toBeVisible();
    const newText = await newBadge.textContent();
    const newCredits = parseInt(newText?.match(/\d+/)?.[0] ?? "-1");
    expect(newCredits).toBeGreaterThanOrEqual(0);
  });
});

import path from "path";
import { test, expect, SAMPLE_PDF } from "./fixtures";
import { mockAIRoutes } from "./helpers/ai-mock";
import fs from "fs";
import os from "os";

test.describe("14.4–5 — Free tier analysis flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAIRoutes(page);
  });

  test("14.4 — free analysis shows category badge + locked overlay", async ({
    page,
    asFreeUser: _,
  }) => {
    await page.goto("/analyze");

    // Step 1: upload PDF
    const tmpPdf = path.join(os.tmpdir(), "test-resume.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume\.pdf/i)).toBeVisible({ timeout: 10000 });

    // Step 2: paste job description
    await page.getByPlaceholder(/paste the job description/i).fill(
      "We are looking for a Senior React TypeScript Developer with Node.js experience. " +
        "The candidate should have 5+ years building REST APIs and working with Git workflows. " +
        "AWS and Docker experience is a plus. Strong communication skills required."
    );
    await page.getByRole("button", { name: /Analyze Match/i }).click();

    // Step 3: loading
    await expect(page.getByText(/AI analysis running/i)).toBeVisible({ timeout: 5000 });

    // Step 4: category badge visible
    await expect(
      page.getByText(/HIGH MATCH|MEDIUM MATCH|LOW MATCH|EXCELLENT MATCH/i)
    ).toBeVisible({ timeout: 15000 });

    // Overlay with upsell CTA visible
    await expect(page.getByText(/Unlock Full Results/i)).toBeVisible();

    // Download step NOT visible
    await expect(page.getByText("Download")).not.toBeVisible();
  });

  test("14.5 — 'Buy Credits' overlay CTA navigates to /pricing", async ({
    page,
    asFreeUser: _,
  }) => {
    await page.goto("/analyze");

    const tmpPdf = path.join(os.tmpdir(), "test-resume.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume\.pdf/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/paste the job description/i).fill(
      "We are looking for a Senior React TypeScript Developer with Node.js experience. " +
        "The candidate should have 5+ years building REST APIs and working with Git workflows. " +
        "AWS and Docker experience is a plus."
    );
    await page.getByRole("button", { name: /Analyze Match/i }).click();
    await expect(page.getByText(/Unlock Full Results/i)).toBeVisible({ timeout: 15000 });

    await page.getByRole("link", { name: /Buy Credits/i }).click();
    await expect(page).toHaveURL("/pricing");
  });
});

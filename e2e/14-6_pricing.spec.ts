import { test, expect } from "./fixtures";

test.describe("14.6 — Pricing page", () => {
  test.beforeEach(async ({ page, asFreeUser: _ }) => {
    await page.goto("/pricing");
  });

  test("shows 3 plan columns", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Free Preview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  });

  test("shows correct prices", async ({ page }) => {
    // The free plan price heading ($0) may appear multiple times; just check at least one is visible
    await expect(page.getByText("$0").first()).toBeVisible();
    await expect(page.getByText("$2.99").first()).toBeVisible();
    await expect(page.getByText("$4.80").first()).toBeVisible();
  });

  test("shows correct credit counts", async ({ page }) => {
    await expect(page.getByText(/10 credits/i)).toBeVisible();
    await expect(page.getByText(/20 credits/i)).toBeVisible();
  });

  test("shows feature comparison table", async ({ page }) => {
    await expect(page.getByText(/Exact ATS Score/i)).toBeVisible();
    await expect(page.getByText(/Keyword Breakdown/i)).toBeVisible();
    await expect(page.getByText(/AI Wording Suggestions/i)).toBeVisible();
    await expect(page.getByText(/PDF Download/i)).toBeVisible();
  });

  test("Free Preview CTA links to /analyze", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Try Free Now/i })).toHaveAttribute(
      "href",
      "/analyze"
    );
  });

  test("Buy Starter and Buy Pro buttons are present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Buy Starter Pack/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy Pro Pack/i })).toBeVisible();
  });
});

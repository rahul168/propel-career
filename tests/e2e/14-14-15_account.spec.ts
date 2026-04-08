import { test, expect } from "./fixtures";
import path from "path";
import fs from "fs";
import { getUserCredits } from "./helpers/db";

test.describe("14.14–15 — Account page", () => {
  test("14.14 — account page shows credit balance", async ({
    page,
    asPaidUser: _,
  }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /My Account/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Credit Balance/i)).toBeVisible();
    // Paid user starts with 10 credits
    await expect(page.getByText(/10/).first()).toBeVisible();
  });

  test("14.14 — account page has buy more credits link", async ({
    page,
    asPaidUser: _,
  }) => {
    await page.goto("/account");
    await expect(page.getByRole("link", { name: /Buy More Credits/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test("14.15 — /api/user/account returns credits", async ({
    page,
    asPaidUser: _,
  }) => {
    const response = await page.request.get("/api/user/account");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("credits");
    expect(typeof body.credits).toBe("number");
    expect(body.credits).toBeGreaterThanOrEqual(0);
  });

  test("14.14 — account page shows credits used stat", async ({
    page,
    asPaidUser: _,
  }) => {
    await page.goto("/account");
    await expect(
      page.getByText(/Credits Used/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("account reflects Adobe credit usage (generate-resume)", async ({
    page,
    users,
    resetCredits,
    asPaidUser: _,
  }) => {
    const adobeConfigured =
      !!process.env.ADBE_CLIENT_ID &&
      !!process.env.ADBE_CLIENT_SECRET &&
      process.env.ADBE_CLIENT_ID !== "your-adobe-client-id";

    // Deterministic start
    await resetCredits(users.paidUser.id, 10);
    const before = await getUserCredits(users.paidUser.id);
    expect(before).toBe(10);

    const docxPath = path.join(process.cwd(), "public", "Rahul_Anand_Latest.docx");
    const docxBase64 = fs.readFileSync(docxPath).toString("base64");

    const response = await page.request.post("/api/generate-resume", {
      data: {
        resumeText: "stub",
        acceptedSuggestions: [],
        docxBase64,
        format: "pdf",
      },
    });
    expect([200, 402]).toContain(response.status());

    const after = await getUserCredits(users.paidUser.id);
    if (adobeConfigured) {
      expect(after).toBe(9);
    } else {
      // No Adobe creds → Playwright fallback → no credit consumed
      expect(after).toBe(10);
    }

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /My Account/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Credit Balance/i)).toBeVisible();
    await expect(page.getByText(String(after)).first()).toBeVisible();

    if (adobeConfigured && response.status() === 200) {
      // Usage history should show Adobe PDF generation as 1 credit used.
      await expect(page.getByText(/PDF Generation \(Adobe\)/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("cell", { name: "1" }).first()).toBeVisible();
    }
  });
});

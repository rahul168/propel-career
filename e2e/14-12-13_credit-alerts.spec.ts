import { test, expect } from "./fixtures";
import { setUserCredits } from "./helpers/db";

test.describe("14.12–13 — Credit alert badges", () => {
  test("14.12 — low credit user (1 credit) sees red/warning badge in navbar", async ({
    page,
    users,
    asFreeUser: _,
  }) => {
    // Set to 1 credit → "warning" status → red badge
    await setUserCredits(users.freeUser.id, 1);
    await page.goto("/analyze");

    // Use first() to avoid strict mode violation (notification span also matches)
    const badge = page.locator("span").filter({ hasText: /\d+ credits/ }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-red-|text-red-/);
  });

  test("14.13 — zero credit user sees red badge", async ({
    page,
    users,
    asFreeUser: _,
  }) => {
    await setUserCredits(users.freeUser.id, 0);
    await page.goto("/analyze");

    const badge = page.locator("span").filter({ hasText: /0 credits/ }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-red-|text-red-/);
  });

  test("14.12 — reminder credit user (2–3 credits) sees yellow/amber badge", async ({
    page,
    users,
    asFreeUser: _,
  }) => {
    // 2 credits → "reminder" status → yellow badge
    await setUserCredits(users.freeUser.id, 2);
    await page.goto("/analyze");

    const badge = page.locator("span").filter({ hasText: /2 credits/ }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-yellow-|text-yellow-/);
  });

  test("14.10 — ok credit user (≥4) sees neutral/grey badge", async ({
    page,
    users,
    asPaidUser: _,
  }) => {
    // Paid user has 10 credits → "ok" status → gray badge
    await page.goto("/analyze");
    const badge = page.locator("span").filter({ hasText: /\d+ credits/ }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/bg-gray-/);
  });
});

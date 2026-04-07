import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

const PROTECTED_ROUTES = [
  "/analyze",
  "/account",
  "/pricing",
  "/payment-success",
];

const PROTECTED_API_ROUTES = [
  "/api/parse-resume",
  "/api/analyze-match",
  "/api/user/account",
];

test.describe("14.19 — Auth protection (unauthenticated browser)", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects unauthenticated user to sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in|accounts\.clerk\.dev/, { timeout: 10000 });
    });
  }

  for (const route of PROTECTED_API_ROUTES) {
    test(`${route} returns 401 without auth`, async ({ request }) => {
      const response = await request.post(`http://localhost:3000${route}`, {
        data: {},
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      });
      const status = response.status();
      const url = response.url();
      // Clerk returns 401 for API requests with Accept: application/json,
      // or redirects to sign-in for all other requests — both indicate protection
      const isProtected =
        [401, 403].includes(status) ||
        url.includes("sign-in") ||
        url.includes("clerk.accounts");
      expect(isProtected).toBeTruthy();
    });
  }

  test("/api/docs is publicly accessible", async ({ request }) => {
    const response = await request.get("http://localhost:3000/api/docs");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("openapi");
  });

  test("landing page / is publicly accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("body")).toBeVisible();
  });
});

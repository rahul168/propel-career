import { test, expect } from "@playwright/test";

test.describe("14.1 — Landing page", () => {
  test("shows Try Free - Sign Up and Sign In CTAs when signed out", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Propel Career/);
    await expect(page.getByRole("link", { name: /Try Free - Sign Up/i })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("Sign Up link navigates to /sign-up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Try Free - Sign Up/i }).click();
    await expect(page).toHaveURL("/sign-up");
  });

  test("Sign In link navigates to /sign-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/sign-in");
  });
});

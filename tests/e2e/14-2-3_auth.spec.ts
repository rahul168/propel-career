import { test, expect } from "./fixtures";
import { signInViaUI, signOutViaUI } from "./helpers/auth";

test.describe("14.2–3 & 14.11 — Auth flow", () => {
  test("14.2 — sign-up page renders Clerk form", async ({ page }) => {
    await page.goto("/sign-up");
    // Clerk renders an iframe or embedded form
    await expect(page.locator("form, [data-clerk-component]").first()).toBeVisible({ timeout: 10000 });
  });

  test("14.3 — sign in with free user lands on app (not sign-in page)", async ({ page, users }) => {
    await signInViaUI(page, users.freeUser.email, users.freeUser.password);
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("14.11 — sign out redirects to landing page", async ({ page, users, asFreeUser: _ }) => {
    await page.goto("/analyze");
    await signOutViaUI(page);
    await expect(page).toHaveURL("/");
    // Signed-out CTAs visible again
    await expect(page.getByRole("link", { name: /Try Free - Sign Up/i })).toBeVisible();
  });

  test("14.3 — /analyze shows 4 steps for free user (no step 5)", async ({ page, asFreeUser: _ }) => {
    await page.goto("/analyze");
    // StepIndicator shows steps 1–4 but not step 5
    await expect(page.getByText("Upload Resume")).toBeVisible();
    await expect(page.getByText("Job Description")).toBeVisible();
    await expect(page.getByText("Results")).toBeVisible();
    await expect(page.getByText("Download")).not.toBeVisible();
  });
});

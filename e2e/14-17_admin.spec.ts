import { test, expect } from "./fixtures";

test.describe("14.17 — Admin dashboard", () => {
  test("14.17 — admin user can access /admin page", async ({
    page,
    asAdminUser: _,
  }) => {
    await page.goto("/admin");
    // Should not redirect to sign-in
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByText(/admin/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("14.17 — admin page shows usage table or stats", async ({
    page,
    asAdminUser: _,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByText(/usage|users|credits|events/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("14.17 — /api/admin/usage returns data for admin user", async ({
    page,
    asAdminUser: _,
  }) => {
    const response = await page.request.get("/api/admin/usage");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Should be an array or object with usage data
    expect(body).toBeDefined();
  });

  test("14.17 — non-admin user is forbidden from /api/admin/usage", async ({
    page,
    asPaidUser: _,
  }) => {
    const response = await page.request.get("/api/admin/usage");
    expect([401, 403]).toContain(response.status());
  });

  test("14.17 — non-admin user is redirected away from /admin page", async ({
    page,
    asPaidUser: _,
  }) => {
    await page.goto("/admin");
    // Should redirect to sign-in or show forbidden, not render admin content
    const url = page.url();
    const isRedirected = url.includes("sign-in") || url.includes("/") && !url.includes("/admin");
    const hasForbidden = await page.getByText(/forbidden|not authorized|access denied/i).isVisible().catch(() => false);
    expect(isRedirected || hasForbidden).toBeTruthy();
  });
});

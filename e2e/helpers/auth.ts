import type { Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Signs in via Clerk testing helpers (bypasses UI forms, uses JS SDK directly).
 * Requires CLERK_SECRET_KEY env var.
 */
export async function signInViaUI(page: Page, email: string, _password: string) {
  // Navigate to a page that loads Clerk JS before using the helper
  await page.goto("/");
  await setupClerkTestingToken({ page });
  // Use email-based ticket strategy — most reliable, no bot detection issues
  await clerk.signIn({ page, emailAddress: email });
}

/**
 * Signs out via Clerk testing helper.
 */
export async function signOutViaUI(page: Page) {
  await clerk.signOut({ page });
}

/**
 * Generates a unique test email for sign-up tests.
 */
export function uniqueEmail(prefix = "test") {
  return `${prefix}+pw_${Date.now()}@propeltest.dev`;
}

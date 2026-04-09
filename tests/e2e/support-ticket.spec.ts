/**
 * E2E tests — Contact page and Support Ticket submission flow.
 *
 * Email delivery (server → SendGrid) cannot be intercepted by Playwright since
 * it happens server-side. Email content is verified in the Jest unit tests at
 * src/lib/email/sendgrid.test.ts. These tests cover:
 *   - Contact page renders correctly for signed-out and signed-in users
 *   - Support ticket form submits successfully and creates a DB record
 *   - Form validates required fields before submitting
 *   - /api/support returns 401 for unauthenticated requests
 */

import { test, expect } from "./fixtures";
import {
  getLatestSupportTicket,
  cleanupSupportTickets,
} from "./helpers/db";

test.describe("Contact page — signed out", () => {
  test("shows contact info and sign-in prompt, no form", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByRole("heading", { name: /Contact Us/i })).toBeVisible();
    await expect(page.getByText("support@propel8.com")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Raise a Support Ticket/i })).toBeVisible();

    // Sign-in nudge visible, form not present
    await expect(page.getByText(/Sign in to raise a ticket/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit Ticket/i })).not.toBeVisible();
  });

  test("Sign In link on contact page redirects back to /contact after login", async ({ page }) => {
    await page.goto("/contact");
    const signInLink = page.getByRole("link", { name: "Sign In" }).last();
    const href = await signInLink.getAttribute("href");
    expect(href).toContain("redirect_url=/contact");
  });
});

test.describe("Contact page — signed in", () => {
  test.beforeEach(async ({ asFreeUser: _ }) => {});

  test("shows support ticket form, no sign-in nudge", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByRole("heading", { name: /Raise a Support Ticket/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit Ticket/i })).toBeVisible();
    await expect(page.getByText(/Sign in to raise a ticket/i)).not.toBeVisible();
  });

  test("about and contact links are visible in navbar", async ({ page }) => {
    await page.goto("/contact");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Contact" })).toBeVisible();
  });
});

test.describe("Support ticket form submission", () => {
  test.beforeEach(async ({ asFreeUser: _ }) => {});

  test("submits successfully and shows confirmation, creates DB record", async ({
    page,
    users,
  }) => {
    await cleanupSupportTickets(users.freeUser.id);

    await page.goto("/contact");

    await page.getByLabel(/Subject/i).fill("Cannot download my resume PDF");
    await page.getByLabel(/Category/i).selectOption("technical");
    await page.getByLabel(/Message/i).fill(
      "When I click the Download PDF button nothing happens. I am using Chrome on Windows 11."
    );

    await page.getByRole("button", { name: /Submit Ticket/i }).click();

    // Success state
    await expect(page.getByText(/Ticket submitted/i)).toBeVisible();
    await expect(page.getByText(/1–2 business days/i)).toBeVisible();

    // DB record created with correct data
    const ticket = await getLatestSupportTicket(users.freeUser.id);
    expect(ticket).not.toBeNull();
    expect(ticket.subject).toBe("Cannot download my resume PDF");
    expect(ticket.category).toBe("technical");
    expect(ticket.status).toBe("open");
  });

  test("allows submitting another ticket after success", async ({ page, users }) => {
    await cleanupSupportTickets(users.freeUser.id);
    await page.goto("/contact");

    await page.getByLabel(/Subject/i).fill("First ticket");
    await page.getByLabel(/Category/i).selectOption("general");
    await page.getByLabel(/Message/i).fill("This is at least ten characters long.");
    await page.getByRole("button", { name: /Submit Ticket/i }).click();
    await expect(page.getByText(/Ticket submitted/i)).toBeVisible();

    await page.getByText(/Submit another ticket/i).click();
    await expect(page.getByRole("button", { name: /Submit Ticket/i })).toBeVisible();
    await expect(page.getByLabel(/Subject/i)).toHaveValue("");
  });
});

test.describe("Support ticket form validation", () => {
  test.beforeEach(async ({ asFreeUser: _ }) => {});

  test("shows API error when message is too short", async ({ page }) => {
    await page.goto("/contact");

    await page.getByLabel(/Subject/i).fill("Short message test");
    // Leave message fewer than 10 chars (bypassing HTML required via JS)
    await page.evaluate(() => {
      const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
      if (textarea) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(textarea, "Too short");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    // Intercept the API and force it through (remove HTML validation)
    const responsePromise = page.waitForResponse("**/api/support");
    await page.evaluate(() => {
      const form = document.querySelector("form") as HTMLFormElement;
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const response = await responsePromise;
    expect(response.status()).toBe(400);
  });
});

test.describe("POST /api/support — auth protection", () => {
  test("returns 401 when not authenticated", async ({ page }) => {
    const response = await page.request.post("/api/support", {
      data: {
        subject: "Test",
        category: "general",
        message: "Testing auth protection on the API.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(401);
  });
});

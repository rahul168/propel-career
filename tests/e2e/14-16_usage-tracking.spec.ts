import path from "path";
import fs from "fs";
import os from "os";
import { test, expect, SAMPLE_PDF } from "./fixtures";
import { mockAIRoutes } from "./helpers/ai-mock";
import { getUsageEvents } from "./helpers/db";

test.describe("14.16 — Usage tracking", () => {
  test.beforeEach(async ({ page }) => {
    await mockAIRoutes(page);
  });

  test("14.16 — uploading resume creates a UsageEvent in DB", async ({
    page,
    users,
    asPaidUser: _,
  }) => {
    // Count events before
    const eventsBefore = await getUsageEvents(users.paidUser.id);
    const countBefore = eventsBefore.length;

    await page.goto("/analyze");

    const tmpPdf = path.join(os.tmpdir(), "test-resume-usage.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume-usage\.pdf/i)).toBeVisible({ timeout: 10000 });

    // Give the DB write a moment to complete after parse-resume
    await page.waitForTimeout(2000);

    const eventsAfter = await getUsageEvents(users.paidUser.id);
    expect(eventsAfter.length).toBeGreaterThan(countBefore);

    // parse-resume should be logged
    const latestEvent = eventsAfter[0];
    expect(latestEvent).toHaveProperty("feature");
    expect(latestEvent.statusCode).toBe(200);
  });

  test("14.16 — UsageEvent has required fields", async ({
    page,
    users,
    asPaidUser: _,
  }) => {
    await page.goto("/analyze");

    const tmpPdf = path.join(os.tmpdir(), "test-resume-fields.pdf");
    fs.writeFileSync(tmpPdf, SAMPLE_PDF);
    await page.locator('input[type="file"]').setInputFiles(tmpPdf);
    await expect(page.getByText(/test-resume-fields\.pdf/i)).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const events = await getUsageEvents(users.paidUser.id);
    expect(events.length).toBeGreaterThan(0);

    const event = events[0];
    expect(event).toHaveProperty("feature");
    expect(event).toHaveProperty("userId");
    expect(event.userId).toBe(users.paidUser.id);
    expect(event).toHaveProperty("durationMs");
    expect(event).toHaveProperty("statusCode");
  });
});

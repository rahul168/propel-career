import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never", outputFolder: "tests/playwright-report" }], ["list"]],
  outputDir: "tests/test-results",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});

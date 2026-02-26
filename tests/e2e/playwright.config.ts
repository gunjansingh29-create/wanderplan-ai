import { defineConfig, devices } from "@playwright/test";
import path from "path";

export const STORAGE_STATE = path.resolve(__dirname, ".auth/user.json");

export default defineConfig({
  globalSetup: require.resolve("./global.setup"),
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "test-results",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  globalTimeout: 10 * 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10_000,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: STORAGE_STATE,
      },
      testIgnore: ["**/04-responsive.spec.ts"],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
        storageState: STORAGE_STATE,
      },
      testMatch: "**/04-responsive.spec.ts",
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: STORAGE_STATE,
      },
      testIgnore: ["**/04-responsive.spec.ts", "**/05-accessibility.spec.ts"],
    },
    {
      name: "a11y",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: STORAGE_STATE,
      },
      testMatch: "**/05-accessibility.spec.ts",
    },
  ],
  webServer: {
    command: "npm start",
    cwd: path.resolve(__dirname, "../.."),
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

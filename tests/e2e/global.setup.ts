import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const STORAGE_STATE = path.resolve(__dirname, ".auth/user.json");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

async function globalSetup() {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch {
    // Persist an empty storage state so tests fail on real assertions, not setup.
  }

  await context.storageState({ path: STORAGE_STATE });
  await browser.close();
}

export default globalSetup;

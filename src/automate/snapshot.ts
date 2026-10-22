import { chromium } from "@playwright/test";

// Opens one page of the app under test and returns its accessibility tree:
// roles and names, the same thing getByRole/getByLabel match on. The agent
// reads real names here instead of guessing locators.
export async function pageSnapshot(url: string, allowedOrigin: string): Promise<string> {
  if (new URL(url).origin !== new URL(allowedOrigin).origin) {
    throw new Error(`"${url}" is not part of the app under test (${allowedOrigin}).`);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const tree = await page.locator("body").ariaSnapshot();
    return tree.length > 8000 ? `${tree.slice(0, 8000)}\n... (cut)` : tree;
  } finally {
    await browser.close();
  }
}

import { chromium } from "@playwright/test";
import nextEnv from "@next/env";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3103";
if (!process.env.E2E_MEMBER_A_EMAIL || !process.env.E2E_MEMBER_A_PASSWORD) throw new Error("Local read-only credentials required.");
const browser = await chromium.launch({ channel: "chromium" });
const results = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_MEMBER_A_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_MEMBER_A_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(`${base}/`, { timeout: 60000 });
  const snapshot = await (await context.request.get(`${base}/api/wishlist`)).json();
  const photos = snapshot.items.filter((item) => item.owner === "you").slice(0, 2).map((item) => item.image);
  const anonymous = await browser.newContext();
  for (const [index, path] of photos.entries()) {
    for (const width of [null, 320, 640, 960]) {
      const url = `${base}${path}${width ? `?width=${width}` : ""}`;
      const start = performance.now();
      const response = await context.request.get(url);
      const bytes = await response.body();
      const metadata = await sharp(bytes).metadata();
      const denied = await anonymous.request.get(url);
      results.push({ sample: index + 1, requestedWidth: width, bytes: bytes.length, width: metadata.width, height: metadata.height, format: metadata.format, status: response.status(), anonymousStatus: denied.status(), cacheControl: response.headers()["cache-control"], elapsedMs: performance.now() - start });
    }
    const invalid = await context.request.get(`${base}${path}?width=99999`);
    if (invalid.status() !== 400) throw new Error("Unbounded thumbnail size was not rejected.");
  }
  console.log(JSON.stringify(results));
  await anonymous.close(); await context.close();
} catch (error) {
  let message = error instanceof Error ? error.message : "Private image audit failed.";
  for (const secret of [process.env.E2E_MEMBER_A_EMAIL, process.env.E2E_MEMBER_A_PASSWORD]) if (secret) message = message.replaceAll(secret, "[redacted]");
  console.error(message); process.exitCode = 1;
} finally {
  await browser.close(); await mkdir("performance-results", { recursive: true });
  await writeFile("performance-results/private-images.json", JSON.stringify(results, null, 2));
}

// Supplemental fixture-only controls sweep. No environment credentials or writes
// to Supabase; contexts and authentication state are never persisted.
import { chromium, webkit, firefox, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

if (process.env.E2E_CROSS_DEVICE_FIXTURE !== "true") throw new Error("Requires isolated fixture servers.");
const lan = process.env.CROSS_DEVICE_LAN;
if (!lan || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+$/.test(lan)) throw new Error("Set CROSS_DEVICE_LAN to a private IPv4 address.");
const results = [];
for (const [engine, type] of Object.entries({ chromium, webkit, firefox })) {
  const browser = await type.launch();
  try {
    for (const mode of ["development", "production"]) for (const host of ["localhost", lan]) {
      const origin = `${mode === "production" ? "https" : "http"}://${host}:${mode === "production" ? 3104 : 3101}`;
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      try {
        await page.goto(`${origin}/sign-in`);
        await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
        await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
        await page.getByRole("button", { name: "Sign In", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/`);
        // Verify this is the fixture, before interacting with the workspace.
        const snapshot = await (await page.request.get(`${origin}/api/wishlist`)).json();
        expect(snapshot.userId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        await page.goto(`${origin}/settings`);
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        let choices = 0;
        for (const label of ["Appearance", "Background", "Gradient", "Default layout", "Layout density"]) {
          const buttons = page.getByRole("group", { name: label, exact: true }).getByRole("button");
          for (const button of await buttons.all()) {
            await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true"); choices++;
          }
        }
        await page.getByRole("group", { name: "Default layout", exact: true }).getByRole("button", { name: "List", exact: true }).click();
        await page.getByRole("link", { name: "My Wishes", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/wishlist`);
        await expect(page.locator(".wishlist-list").filter({ visible: true })).toBeVisible();
        await page.getByRole("link", { name: "His / Her", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/partner`);
        await expect(page.locator(".wishlist-list").filter({ visible: true })).toBeVisible();
        await page.goBack();
        await expect(page).toHaveURL(`${origin}/wishlist`);
        await expect(page.getByRole("heading", { name: "Mine", exact: true })).toBeVisible();
        await expect.poll(() => page.locator(".route-transition").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
        await page.getByRole("link", { name: "Back to Home", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/`);
        await page.getByRole("button", { name: "Add wish", exact: true }).click();
        await expect(page.getByRole("dialog").getByRole("textbox", { name: "Хүслийн нэр", exact: true })).toBeVisible();
        for (let index = 0; index < 20; index++) {
          await page.keyboard.press(index < 15 ? "Tab" : "Shift+Tab");
          expect(await page.getByRole("dialog").evaluate((el) => el.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.getByRole("button", { name: "Add wish", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.locator(".sheet-backdrop").click({ position: { x: 3, y: 3 } });
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const registrations = await page.evaluate(async () => "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0);
        expect(registrations).toBe(0);
        results.push({ engine, mode, origin: host === "localhost" ? "localhost" : "LAN", viewport: "1440x900", deviceScaleFactor: 1, screenshot: "none", choices, defaultListLayout: "passed", backNavigation: "passed", focusTrap: "passed", backdropDismissal: "passed", serviceWorkers: registrations, result: "passed" });
      } catch (error) {
        results.push({ engine, mode, origin: host === "localhost" ? "localhost" : "LAN", result: "failed", error: error.message });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
await writeFile("performance-results/cross-device-controls.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.result !== "passed")) process.exitCode = 1;

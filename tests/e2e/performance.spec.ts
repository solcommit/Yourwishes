import { expect, test } from "@playwright/test";

// Explicit opt-in. These tests only read live data; failures/delays are browser
// interceptions of GET /api/wishlist, never database mutations.
test.beforeEach(async ({ page }, info) => {
  test.skip(process.env.E2E_PERFORMANCE_READ_ONLY !== "true" || !process.env.E2E_MEMBER_A_EMAIL || !process.env.E2E_MEMBER_A_PASSWORD, "Read-only performance checks require explicit opt-in and local credentials.");
  test.skip(!["desktop-baseline-chromium", "laptop-chromium", "mobile-390-chromium"].includes(info.project.name), "Requested performance viewports only.");
  await page.goto("/sign-in");
  try {
    await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_MEMBER_A_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_MEMBER_A_PASSWORD!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL("/", { timeout: 30000 });
  } catch {
    // Avoid credential-bearing Playwright call logs or failed sign-in snapshots.
    await page.evaluate(() => { document.querySelectorAll("input").forEach((input) => { input.value = ""; }); }).catch(() => {});
    throw new Error("Read-only performance sign-in setup did not complete. Check local credentials and Auth availability.");
  }
  await page.locator('a[href="/wishlist"]').last().click();
  await expect(page.getByRole("heading", { name: "Mine", exact: true })).toBeVisible();
  await expect(page.locator(".wish-tile:visible").first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const now = Date.now.bind(Date); Date.now = () => now() + 31_000; });
});

test("a delayed refresh is deduplicated and leaves navigation and detail usable", async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/wishlist", async (route) => { requests++; await gate; await route.continue().catch(() => {}); });
  try {
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("focus")); });
    await expect.poll(() => requests).toBe(1);
    await page.locator(".wish-tile:visible").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Хаах", exact: true }).click();
    await page.locator('a[href="/partner"]').last().click();
    await expect(page.getByRole("heading", { name: "Partner", exact: true })).toBeVisible();
    await page.locator('a[href="/wishlist"]').last().click();
    await expect(page.locator(".wish-tile:visible").first()).toBeVisible();
    expect(requests).toBe(1);
  } finally { release(); }
});

test("a failed background refresh keeps content and recovers on retry", async ({ page }) => {
  const count = await page.locator(".wish-tile:visible").count();
  await page.route("**/api/wishlist", (route) => route.abort("internetdisconnected"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.locator(".wish-tile:visible")).toHaveCount(count);
  await page.locator(".wish-tile:visible").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Хаах", exact: true }).click();
  await page.unroute("**/api/wishlist");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".wish-tile:visible")).toHaveCount(count);
});

for (const network of [{ name: "hotspot", latency: 300, mbps: 5 }, { name: "slow-4g", latency: 150, mbps: 1.6 }]) {
  test(`cold ${network.name} load keeps Home and Add Wish usable before wishes arrive`, async ({ page }, info) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: network.latency, downloadThroughput: network.mbps * 1024 * 1024 / 8, uploadThroughput: network.mbps * 1024 * 1024 / 8 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let pending = false;
    await page.route("**/api/wishlist", async (route) => { pending = true; await gate; await route.continue().catch(() => {}); });
    try {
      const start = Date.now();
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page.getByRole("navigation", { name: "Wishlists" })).toBeVisible({ timeout: 30000 });
      const dockReadyMs = Date.now() - start;
      await expect.poll(() => pending).toBe(true);
      const navStart = Date.now();
      await page.getByRole("link", { name: "Back to Home", exact: true }).click();
      await expect(page.getByRole("button", { name: "Add wish", exact: true })).toBeVisible();
      const homeMs = Date.now() - navStart;
      const clickStart = Date.now();
      await page.getByRole("button", { name: "Add wish", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const addOpenMs = Date.now() - clickStart;
      await info.attach("cold-network", { body: JSON.stringify({ network: network.name, viewport: page.viewportSize(), dockReadyMs, homeMs, addOpenMs, wishlistHeld: pending }), contentType: "application/json" });
      console.log(JSON.stringify({ measurement: "cold-network", network: network.name, project: info.project.name, dockReadyMs, homeMs, addOpenMs }));
    } finally { release(); }
  });
}

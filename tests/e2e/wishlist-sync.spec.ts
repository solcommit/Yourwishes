import { test, expect } from "@playwright/test";
import { wishlistBrowserServer } from "../helpers/wishlist-browser-server";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Fixture", updatedAt: "2026-01-01T00:00:00Z", owner: "you", ownerId: userId };
const snapshot = { userId, items: [item], warning: "" };
let harness: Awaited<ReturnType<typeof wishlistBrowserServer>>;
test.beforeAll(async () => { harness = await wishlistBrowserServer(); });
test.afterAll(async () => { await new Promise<void>((resolve) => harness.server.close(() => resolve())); });
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-baseline-chromium", "Data races are independent of viewport.");
  await page.clock.install();
  await page.route("**/api/wishlist", (route) => route.fulfill({ json: snapshot }));
  await page.goto(harness.url);
  await expect(page.locator("output")).toContainText('"items":["Fixture"]');
});

test("identical snapshots do not commit new state", async ({ page }) => {
  const before = JSON.parse(await page.locator("output").innerText()).renders;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForTimeout(250);
  const after = JSON.parse(await page.locator("output").innerText()).renders;
  expect(after).toBe(before);
});

test("overlapping refreshes share one request and sign-out rejects late replies", async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/wishlist", async (route) => { requests++; await gate; await route.fulfill({ json: snapshot }).catch(() => {}); });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("yourwishes-session-ending")));
  release();
  await expect(page.locator("output")).toContainText('"items":[]');
  await page.waitForTimeout(200);
  await expect(page.locator("output")).toContainText('"items":[]');
});

test("a failed refresh retains the last snapshot and can be retried", async ({ page }) => {
  await page.route("**/api/wishlist", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("output")).not.toContainText('"error":""');
  await expect(page.locator("output")).toContainText('"items":["Fixture"]');
  await page.unroute("**/api/wishlist");
  await page.route("**/api/wishlist", (route) => route.fulfill({ json: snapshot }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator("output")).toContainText('"error":""');
});

test("a mutation cancels an older refresh and ignores its stale snapshot", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let reads = 0;
  await page.route("**/api/wishlist**", async (route) => {
    if (route.request().method() === "DELETE") { await route.fulfill({ json: { warning: "" } }); return; }
    reads++;
    if (reads === 1) { await gate; await route.fulfill({ json: snapshot }).catch(() => {}); }
    else await route.fulfill({ json: { ...snapshot, items: [] } });
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => reads).toBe(1);
  await page.getByRole("button", { name: "Delete fixture", exact: true }).click();
  await expect(page.locator("output")).toContainText('"items":[]');
  release();
  await page.waitForTimeout(200);
  await expect(page.locator("output")).toContainText('"items":[]');
});

test("fresh focus events do not refetch, and polling pauses offline", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/wishlist", async (route) => { requests++; await route.fulfill({ json: snapshot }); });
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("focus")); });
  await page.waitForTimeout(100);
  expect(requests).toBe(0);
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { value: false, configurable: true }); window.dispatchEvent(new Event("offline")); });
  await page.clock.runFor(60_001);
  expect(requests).toBe(0);
  await expect(page.locator("output")).toContainText('"items":["Fixture"]');
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { value: true, configurable: true }); window.dispatchEvent(new Event("online")); });
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator("output")).toContainText('"error":""');
});

test("hidden tabs pause polling and poll responses are deduplicated", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/wishlist", async (route) => { requests++; await route.fulfill({ json: snapshot }); });
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }));
  await page.clock.runFor(60_001);
  expect(requests).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => requests).toBe(1);
});

test("a committed save resolves before noncritical revalidation", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/wishlist", async (route) => {
    if (route.request().method() === "POST") { await route.fulfill({ json: { warning: "" } }); return; }
    await gate; await route.fulfill({ json: snapshot }).catch(() => {});
  });
  try {
    await page.getByRole("button", { name: "Save fixture", exact: true }).click();
    await expect(page.locator("[data-saved]")).toHaveText("saved");
    await expect(page.locator("output")).toContainText('"items":["Fixture"]');
  } finally { release(); }
});

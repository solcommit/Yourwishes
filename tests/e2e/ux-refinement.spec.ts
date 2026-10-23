import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.waitForTimeout(1000);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const metadata = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, deviceScaleFactor: devicePixelRatio, zoom: getComputedStyle(document.documentElement).zoom, scale: visualViewport?.scale, screenshot: "viewport", screenshotScale: "css" }));
  console.log(JSON.stringify({ project: info.project.name, name, ...metadata }));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: false, scale: "css" });
}

test("compact grid, coherent morph, private gallery, touch/trackpad, navigation and reduced motion", async ({ page }, info) => {
  const errors: string[] = [], originals: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (request.url().includes("/api/wishlist/images/") && !request.url().includes("width=")) originals.push(new URL(request.url()).pathname); });
  await login(page);
  await page.getByRole("link", { name: "My Wishes", exact: true }).click();
  const card = page.locator(".wish-tile:visible").first();
  await expect(card).toBeVisible();
  await expect.poll(() => card.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  const dimensions = await card.evaluate((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
  expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThan(1);
  expect(dimensions.width).toBeLessThanOrEqual(181);
  await expect(card.locator(".wish-meta")).toBeHidden();
  expect(originals).toHaveLength(0);
  await capture(page, info, "grid");
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".detail-image-frame")).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(650);
  await expect(dialog.locator(".detail-image")).toHaveCount(1);
  await expect(card.locator(".wish-shared-image")).toHaveCSS("visibility", "hidden");
  await expect(dialog).not.toContainText(/IMG_|\.HEIC|photo\.png/);
  expect(new Set(originals).size).toBeLessThanOrEqual(2);
  const cover = await dialog.locator(".detail-image").getAttribute("src");
  const next = dialog.getByRole("button", { name: "Дараагийн зураг", exact: true });
  await next.click();
  await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3", exact: true })).toBeVisible();
  await expect.poll(() => dialog.locator(".detail-image").evaluate((img) => ({ width: (img as HTMLImageElement).naturalWidth, height: (img as HTMLImageElement).naturalHeight }))).toEqual({ width: 1200, height: 1800 });
  await dialog.getByRole("button", { name: "Өмнөх зураг", exact: true }).click();
  await expect(dialog.locator(".detail-image")).toHaveAttribute("src", cover!);
  for (let index = 0; index < 4; index++) { await next.click(); await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3", exact: true })).toBeVisible(); await dialog.getByRole("button", { name: "Өмнөх зураг", exact: true }).click(); await expect(dialog.locator(".detail-image")).toHaveAttribute("src", cover!); }
  expect(originals.filter((src) => src === originals[0])).toHaveLength(1);
  const frame = dialog.locator(".detail-image-frame");
  await frame.dispatchEvent("touchstart", { touches: [{ identifier: 0, clientX: 230, clientY: 150 }] });
  await frame.dispatchEvent("touchend", { changedTouches: [{ identifier: 0, clientX: 100, clientY: 155 }] });
  await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3", exact: true })).toBeVisible();
  await frame.dispatchEvent("touchstart", { touches: [{ identifier: 0, clientX: 100, clientY: 150 }] });
  await frame.dispatchEvent("touchend", { changedTouches: [{ identifier: 0, clientX: 240, clientY: 155 }] });
  await expect(dialog.getByRole("group", { name: "Зураг 1, нийт 3", exact: true })).toBeVisible();
  await frame.dispatchEvent("wheel", { deltaX: 90, deltaY: 0 });
  await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "3-р зургийг үзэх", exact: true }).click();
  await expect(dialog.getByRole("group", { name: "Зураг 3, нийт 3", exact: true })).toBeVisible();
  await expect.poll(() => dialog.locator(".detail-image").evaluate((img) => ({ width: (img as HTMLImageElement).naturalWidth, height: (img as HTMLImageElement).naturalHeight }))).toEqual({ width: 1800, height: 900 });
  const firstOpenRequests = originals.slice();
  await capture(page, info, "gallery");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(card.locator(".wish-shared-image")).toHaveCSS("visibility", "visible");
  await expect(card).toBeFocused();
  for (let index = 0; index < 3; index++) { await card.click(); await expect(dialog).toBeVisible(); await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); }
  await page.getByRole("button", { name: "List layout", exact: true }).click();
  await expect(card.locator(".wish-meta")).toBeVisible();
  await card.click(); await expect(dialog).toBeVisible();
  await page.locator(".sheet-backdrop").click({ position: { x: 2, y: 2 } }); await expect(dialog).toHaveCount(0);
  await page.getByRole("link", { name: "His / Her", exact: true }).click();
  await expect(page).toHaveURL("/partner");
  await page.locator(".wish-tile:visible").first().click(); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Дараагийн зураг", exact: true })).toHaveCount(0);
  await page.goBack(); await expect(page).toHaveURL("/wishlist"); await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".wish-tile:visible").first().click(); await expect(dialog).toBeVisible(); await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  const dock = page.getByRole("navigation", { name: "Wishlists" });
  await expect(dock.getByRole("tooltip")).toHaveCount(0);
  const discover = dock.getByRole("link", { name: "Discover", exact: true });
  await discover.hover(); await discover.focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL("/discover");
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ project: info.project.name, measurement: "gallery", card: dimensions, originalRequests: firstOpenRequests.length, uniqueOriginals: new Set(firstOpenRequests).size, repeatedRequests: firstOpenRequests.length - new Set(firstOpenRequests).size, result: "passed" }));
});

test("Mongolian form, real image preparation/reorder, empty and populated Discover", async ({ page }, info) => {
  await login(page);
  await page.getByRole("button", { name: "Add wish", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = dialog.getByLabel("Хүслийн нэр", { exact: true });
  await expect(name).toBeVisible();
  await dialog.getByRole("button", { name: "Хүсэл нэмэх", exact: true }).click();
  expect(await name.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe("Хүслийн нэрээ бичээрэй.");
  await name.fill("Хамтдаа аялах");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  await page.locator("#wish-images").setInputFiles([{ name: "IMG_1234.png", mimeType: "image/png", buffer: png }, { name: "photo.png", mimeType: "image/png", buffer: png }]);
  await expect(dialog.locator(".wish-media-preview")).toHaveCount(2);
  const second = await dialog.locator(".wish-media-preview img").nth(1).getAttribute("src");
  await dialog.getByRole("button", { name: "2-р зургийг урагшлуулах", exact: true }).click();
  await expect(dialog.locator(".wish-media-preview img").first()).toHaveAttribute("src", second!);
  await expect(dialog.locator(".wish-media-preview").first()).toContainText("Нүүр зураг");
  await expect(dialog).not.toContainText(/IMG_|photo\.png/);
  await dialog.getByRole("button", { name: "2-р зургийг хасах", exact: true }).click();
  await page.locator("#wish-images").setInputFiles({ name: "bad.heic", mimeType: "image/heic", buffer: Buffer.from("invalid") });
  await expect(dialog.getByRole("alert")).toContainText("Зургийг бэлдэж чадсангүй");
  await expect(dialog.getByRole("button", { name: "Дахин оролдох", exact: true })).toBeVisible();
  await expect(dialog).toHaveAttribute("lang", "mn");
  if (["chromium-laptop", "webkit-mobile"].includes(info.project.name)) {
    await page.locator("#wish-images").setInputFiles("tests/fixtures/images/libheif-example.heic");
    await expect(dialog.getByRole("status")).toContainText("зургийг бэлдэж байна");
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await expect(dialog.locator(".wish-media-preview")).toHaveCount(2);
  }
  await capture(page, info, "add-wish");
  await dialog.getByRole("button", { name: "Болих", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await page.getByRole("button", { name: "Instant Pick. Choose one at random." }).click();
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await expect(page.getByText("Your pick", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choose a method", exact: true }).click();
  await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 15_000 });
  const snapshot = await (await page.request.get("/api/wishlist")).json();
  expect(snapshot.userId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await page.route(/\/api\/wishlist$/, (route) => route.fulfill({ json: { ...snapshot, items: snapshot.items.filter((item: { owner: string }) => item.owner === "you") } }));
  await page.reload();
  await expect(page.getByText("Хос тань хараахан хүсэл нэмээгүй байна.", { exact: true })).toBeVisible();
  await expect(page.locator(".prize-wheel-wrap")).toHaveCount(0);
  await capture(page, info, "discover-empty");
});

test("late secondary photo cannot replace a newer selection; failed photos retry", async ({ page }, info) => {
  test.skip(!["chromium-laptop", "webkit-mobile"].includes(info.project.name), "Race semantics on desktop and mobile engines.");
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/wishlist/images/eeeeeeee-eeee-4eee-8eee-000000000001", async (route) => { await gate; await route.continue().catch(() => {}); });
  await page.getByRole("link", { name: "My Wishes", exact: true }).click();
  await page.locator(".wish-tile:visible").first().click();
  const dialog = page.getByRole("dialog"), frame = dialog.locator(".detail-image-frame");
  try {
    await expect(frame).toHaveAttribute("aria-busy", "false");
    const cover = await dialog.locator(".detail-image").getAttribute("src");
    await dialog.getByRole("button", { name: "Дараагийн зураг", exact: true }).click();
    await expect(frame).toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator(".detail-image")).toHaveAttribute("src", cover!);
    await dialog.getByRole("button", { name: "3-р зургийг үзэх", exact: true }).click();
    await expect(frame).toHaveAttribute("aria-label", "Зураг 3, нийт 3");
    release(); await page.waitForTimeout(400);
    await expect(frame).toHaveAttribute("aria-label", "Зураг 3, нийт 3");
  } finally { release(); }
  await page.unroute("**/api/wishlist/images/eeeeeeee-eeee-4eee-8eee-000000000001");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  let attempts = 0;
  let failing = true;
  await page.route("**/api/wishlist/images/eeeeeeee-eeee-4eee-8eee-000000000001", async (route) => {
    attempts++; if (failing) await route.fulfill({ status: 503, body: "Synthetic failure" }); else await route.continue();
  });
  await page.locator(".wish-tile:visible").first().click();
  await expect(frame).toHaveAttribute("aria-busy", "false");
  await dialog.getByRole("button", { name: "2-р зургийг үзэх", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Ачаалж чадсангүй. Дахин оролдох", exact: true })).toBeVisible();
  failing = false;
  await dialog.getByRole("button", { name: "Ачаалж чадсангүй. Дахин оролдох", exact: true }).click();
  await expect(frame).toHaveAttribute("aria-label", "Зураг 2, нийт 3");
  expect(attempts).toBeGreaterThanOrEqual(2);
});

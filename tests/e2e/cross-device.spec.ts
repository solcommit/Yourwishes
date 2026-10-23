import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { WishlistItem, WishInput } from "../../src/lib/wishlist/types";

test.afterEach(async ({ page }, info) => {
  if (process.env.E2E_CROSS_DEVICE_FIXTURE === "true" && info.status !== info.expectedStatus) {
    console.log(JSON.stringify({ project: info.project.name, dialogs: await page.getByRole("dialog").allTextContents(), alerts: await page.getByRole("alert").allTextContents() }));
  }
});

test("isolated mutations, gallery, loading, failure, retry and empty states", async ({ page }, info) => {
  test.skip(process.env.E2E_CROSS_DEVICE_FIXTURE !== "true", "Only run against isolated audit servers.");
  test.skip(!/-(desktop|mobile)$/.test(info.project.name), "State coverage on desktop and mobile; full workflows cover every viewport.");
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  const initial = await (await page.request.get("/api/wishlist")).json();
  expect(initial.userId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  let items: WishlistItem[] = structuredClone(initial.items);
  const original = items[0];
  original.images = [original.image, `${original.image}?gallery=2`, `${original.image}?gallery=3`];
  original.mediaNames = ["first.jpg", "second.jpg", "third.jpg"];
  original.photos = original.images.map((path, index) => ({ path: `${original.ownerId}/${original.id}/${index}.jpg`, name: original.mediaNames[index] }));
  let mode: "ready" | "failure" | "pending" = "pending";
  let releaseRead!: () => void;
  const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
  let writes = 0;
  // All mutations are intercepted in this browser, never sent to an app server
  // or database. Reads use a per-test synthetic snapshot, eliminating cross-talk.
  await page.route("**/api/wishlist/uploads", (route) => route.fulfill({ json: { path: `${initial.userId}/local-upload/photo.jpg`, name: "photo.jpg" } }));
  await page.route(/\/api\/wishlist(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const input = request.postDataJSON() as WishInput;
      expect(input.id).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
      writes++;
      const existing = items.find((item) => item.id === input.id) ?? original;
      items = [{ ...existing, ...input, images: existing.images, image: existing.image, mediaNames: input.photos.map((photo) => photo.name), owner: "you", updatedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== input.id)];
      await route.fulfill({ json: { saved: true, warning: "" } }); return;
    }
    if (request.method() === "DELETE") {
      writes++; items = items.filter((item) => item.id !== new URL(request.url()).searchParams.get("id"));
      await route.fulfill({ json: { deleted: true, warning: "" } }); return;
    }
    if (mode === "pending") await Promise.race([readGate, new Promise((resolve) => setTimeout(resolve, 10_000))]);
    if (mode === "failure") await route.fulfill({ status: 503, json: { error: "Synthetic failure" } });
    else await route.fulfill({ json: { ...initial, items } });
  });
  await page.reload();
  await page.getByRole("link", { name: "My Wishes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Loading wishes" })).toBeVisible();
  mode = "ready";
  releaseRead();
  await expect(page.locator(".wish-tile")).toHaveCount(12);
  await page.locator(".wish-tile").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "Зураг 1, нийт 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Дараагийн зураг", exact: true }).click();
  await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "3-р зургийг үзэх", exact: true }).click();
  const gallery = dialog.getByRole("group", { name: "Зураг 3, нийт 3" });
  await gallery.focus(); await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("group", { name: "Зураг 2, нийт 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Засах", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true }).fill("Edited fixture");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Устгах", exact: true })).toBeVisible();
  await expect(page.locator(".wish-tile").first()).toContainText("Edited fixture");
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Устгах", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".wish-tile")).toHaveCount(11);
  expect(writes).toBe(2);
  // Force a due refresh; preserve content throughout a failing background read.
  mode = "failure";
  await page.evaluate(() => { const now = Date.now.bind(Date); Date.now = () => now() + 31_000; window.dispatchEvent(new Event("focus")); });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.locator(".wish-tile")).toHaveCount(11);
  mode = "ready";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  items = [];
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Одоогоор хүсэл алга", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Хүсэл нэмэх", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true }).fill("New fixture");
  await page.locator("#wish-images").setInputFiles({ name: "new.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
  await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "false");
  await dialog.getByRole("button", { name: "Хүсэл нэмэх", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".wish-tile")).toHaveCount(1);
  await expect(page.locator(".wish-tile")).toContainText("New fixture");
  expect(writes).toBe(3);
  items = [];
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Одоогоор хүсэл алга", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "His / Her", exact: true }).click();
  await expect(page.getByText("Хос тань хараахан хүсэл нэмээгүй байна", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
  await expect(page.getByText("No partner wishes are available yet.", { exact: true })).toBeVisible();
});

async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await expect.poll(() => page.locator(".route-transition").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function capture(page: Page, info: TestInfo, name: string) {
  if (!/chromium-(desktop|mobile)$/.test(info.project.name) && !(name.startsWith("wheel") && /webkit-mobile$/.test(info.project.name))) return;
  await settled(page);
  let previous = "", stable = 0;
  await expect.poll(async () => {
    const next = await page.locator(".route-transition, [role=dialog]").evaluateAll((nodes) => JSON.stringify(nodes.map((node) => {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      return [rect.x, rect.y, rect.width, rect.height, css.opacity, css.transform];
    })));
    stable = next === previous ? stable + 1 : 0; previous = next; return stable;
  }, { intervals: [100], timeout: 10_000 }).toBeGreaterThanOrEqual(4);
  const metadata = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, deviceScaleFactor: devicePixelRatio, visualViewportScale: visualViewport?.scale, elements: ["html", ".route-transition", "[role=dialog]"].map((selector) => {
    const el = document.querySelector(selector); return { selector, zoom: el ? getComputedStyle(el).zoom : null, transform: el ? getComputedStyle(el).transform : null };
  }) }));
  console.log(JSON.stringify({ project: info.project.name, name, ...metadata, mode: "viewport", screenshotScale: "css" }));
  await info.attach(`${name}-metadata`, { body: JSON.stringify(metadata), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: false, scale: "css" });
}

async function profile(page: Page) {
  // Keyboard activation also covers devices without hover capability.
  const avatar = page.locator(".profile-avatar");
  if (await avatar.getAttribute("aria-expanded") !== "true") {
    await avatar.focus(); await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: "Profile settings menu", exact: true }).click();
  await expect(page.getByRole("group", { name: "Profile actions" })).toBeVisible();
}

test("complete fixture workspace: routes, forms, profile, settings, Discover, input and offline", async ({ page, context }, info) => {
  test.skip(process.env.E2E_CROSS_DEVICE_FIXTURE !== "true", "Only run against isolated audit servers.");
  const errors: string[] = [];
  const failedAssets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400 && /\/_next\/|\/generated\/|\/api\/wishlist\/images\//.test(response.url())) failedAssets.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await page.goto("/wishlist");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Add wish", exact: true })).toBeVisible();
  await settled(page);
  await capture(page, info, "home");
  await page.reload();
  await expect(page.getByRole("button", { name: "Add wish", exact: true })).toBeVisible();
  await settled(page);

  // Exercise mouse hover where hardware capability permits it, touch elsewhere.
  const hasHover = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
  if (hasHover) {
    await page.locator(".profile-avatar").hover();
    await expect(page.locator(".profile-avatar")).toHaveAttribute("aria-expanded", "true");
    await page.mouse.move(150, 500);
    await expect(page.locator(".profile-avatar")).toHaveAttribute("aria-expanded", "false");
  } else {
    await page.locator(".profile-avatar").tap();
    await expect(page.locator(".profile-avatar")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
  }
  await profile(page);
  await page.getByRole("button", { name: "Edit Nickname", exact: true }).click();
  await page.getByRole("textbox", { name: "Nickname", exact: true }).fill("Audit");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".profile-avatar")).toHaveText("A");
  await profile(page);
  await page.getByRole("button", { name: "Change Profile Photo", exact: true }).click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".profile-photo")).toBeVisible();
  console.log(`${info.project.name}: profile complete`);

  await page.getByRole("button", { name: "Add wish", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true })).toBeVisible();
  await settled(page);
  await capture(page, info, "add-wish");
  await dialog.getByRole("button", { name: "Хүсэл нэмэх", exact: true }).click();
  expect(await dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true }).evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
  await dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true }).fill("Synthetic only");
  await page.locator("#wish-images").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: png },
    { name: "second.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByRole("list", { name: "Сонгосон зургууд" }).locator("li")).toHaveCount(2);
  const secondPreview = await page.locator(".wish-media-preview img").nth(1).getAttribute("src");
  await page.getByRole("button", { name: "2-р зургийг урагшлуулах", exact: true }).click();
  await expect(page.locator(".wish-media-preview img").first()).toHaveAttribute("src", secondPreview!);
  await page.getByRole("button", { name: "2-р зургийг хасах", exact: true }).click();
  await page.locator("#wish-images").setInputFiles({ name: "invalid.heic", mimeType: "image/heic", buffer: Buffer.from("invalid") });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Дахин оролдох" })).toBeVisible();
  await page.getByRole("button", { name: "1-р зургийг хасах", exact: true }).click();
  await page.locator("#wish-images").setInputFiles("tests/fixtures/images/libheif-example.heic");
  await expect(page.locator(".wish-media-preview")).toHaveCount(1, { timeout: 30_000 });
  await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".wish-media-preview img")).toHaveAttribute("alt", "1-р зураг");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  console.log(`${info.project.name}: Add Wish complete`);

  for (const [label, route] of [["My Wishes", "/wishlist"], ["His / Her", "/partner"]]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(route);
    await settled(page);
    await expect(page.locator(".wish-tile")).toHaveCount(12);
    await page.getByRole("button", { name: "List layout", exact: true }).click();
    await expect(page.locator(".wishlist-list")).toBeVisible();
    await page.getByRole("button", { name: "Grid layout", exact: true }).click();
    await page.locator(".wish-tile").first().click();
    await expect(dialog).toBeVisible();
    await settled(page);
    if (route === "/wishlist") {
      await dialog.getByRole("button", { name: "Засах", exact: true }).click();
      await expect(dialog.getByRole("textbox", { name: "Хүслийн нэр", exact: true })).toHaveValue("Audit wish 1");
      await dialog.getByRole("button", { name: "Болих", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Засах", exact: true })).toBeVisible();
    } else await expect(dialog.getByRole("button", { name: "Засах", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    console.log(`${info.project.name}: ${route} complete`);
  }
  await profile(page);
  await page.getByRole("link", { name: "Open Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await settled(page);
  for (const label of ["Ambient animation", "Fluid animations", "Scroll bezel", "Reduce transparency", "Auto-play videos"]) {
    const control = page.getByRole("switch", { name: label, exact: true });
    const before = await control.getAttribute("aria-checked");
    await control.click(); await expect(control).toHaveAttribute("aria-checked", before === "true" ? "false" : "true"); await control.click();
  }
  await page.getByRole("group", { name: "Background", exact: true }).getByRole("button", { name: "Sunset Glow", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-background-style", "sunset-glow");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-background-style", "sunset-glow");
  await expect(page.locator(".profile-photo")).toBeVisible();
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await expect(page).toHaveURL("/discover");
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await page.getByRole("button", { name: "Instant Pick. Choose one at random." }).click();
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await expect(page.getByText("Your pick", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choose a method", exact: true }).click();
  await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect.poll(() => page.locator(".prize-wheel-rotor").evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 12_000 });
  console.log(`${info.project.name}: wheel complete`);
  await settled(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Spin Again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 12_000 });
  console.log(`${info.project.name}: reduced motion complete`);
  await page.getByRole("link", { name: "Surprises", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Surprises", exact: true })).toBeVisible();
  await settled(page);
  await context.setOffline(true);
  await expect(page.locator("main").getByRole("alert")).toContainText("offline");
  await expect(page.getByRole("navigation", { name: "Wishlists" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await profile(page);
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/partner");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
  console.log(JSON.stringify({ project: info.project.name, viewport: info.project.use.viewport, deviceScaleFactor: info.project.use.deviceScaleFactor, screenshot: /chromium-(desktop|mobile)$/.test(info.project.name) ? "viewport: home, add-wish" : "none", result: "passed" }));
});

test("wheel paint preserves glow, size, animation and repeat clicks without overflow", async ({ page }, info) => {
  test.skip(process.env.E2E_CROSS_DEVICE_FIXTURE !== "true", "Only run against isolated audit servers.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await expect(page).toHaveURL("/discover");
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toBeEnabled();
  await settled(page);
  const geometry = await page.evaluate(() => {
    const wrap = document.querySelector(".prize-wheel-wrap")!;
    const art = document.querySelector(".prize-wheel-artwork")!;
    const paint = document.querySelector(".prize-wheel-paint")!;
    const w = wrap.getBoundingClientRect(), a = art.getBoundingClientRect(), p = paint.getBoundingClientRect();
    return { width: w.width, height: w.height, artWidth: a.width, artHeight: a.height, paintLeft: p.left, paintRight: p.right, viewport: innerWidth, glow: getComputedStyle(wrap, "::before").backgroundImage, wrapOverflow: getComputedStyle(wrap).overflow, paintOverflow: getComputedStyle(paint).overflow };
  });
  expect(Math.abs(geometry.width - geometry.artWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.height - geometry.artHeight)).toBeLessThan(1);
  expect(geometry.paintLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.paintRight).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.glow).toContain("radial-gradient");
  expect(geometry.wrapOverflow).toBe("visible");
  expect(geometry.paintOverflow).toBe("clip");
  await capture(page, info, "wheel-idle");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  for (let frame = 0; frame < 6; frame++) {
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 12_000 });
  await settled(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Spin Again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 12_000 });
  await settled(page);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ project: info.project.name, measurement: "wheel-paint", ...geometry, result: "passed" }));
});

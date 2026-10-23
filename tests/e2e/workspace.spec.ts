import { expect, test } from "@playwright/test";

test("workspace routes and Discover render without overflow or browser errors", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_MEMBER_A_EMAIL || !process.env.E2E_MEMBER_A_PASSWORD, "Protected workspace requires an explicitly supplied, provisioned test account.");
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_MEMBER_A_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_MEMBER_A_PASSWORD!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  async function inspect(name: string, fullPage = false) {
    await page.evaluate(() => document.fonts.ready);
    // Include delayed entrances and confetti; infinite ambient animation stays enabled.
    await page.waitForTimeout(1600);
    let previous = "";
    let stableSamples = 0;
    await expect.poll(async () => {
      const current = await page.locator(".route-transition, [role=dialog], .add-sheet-content, .detail-image-frame").evaluateAll((elements) =>
        JSON.stringify(elements.map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return [rect.x, rect.y, rect.width, rect.height, style.transform, style.opacity];
        })),
      );
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      return stableSamples;
    }, { intervals: [100], timeout: 10_000 }).toBeGreaterThanOrEqual(5);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const metadata = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      deviceScaleFactor: devicePixelRatio,
      visualViewportScale: visualViewport?.scale,
      elements: ["html", "body", ".route-transition", "[role=dialog]"].map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, present: false };
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { selector, zoom: style.zoom, transform: style.transform, width: rect.width, height: rect.height };
      }),
    }));
    const capture = { name, project: testInfo.project.name, ...metadata, mode: fullPage ? "full-page" : "viewport", screenshotScale: "css" };
    console.log(JSON.stringify(capture));
    await testInfo.attach(`${name}-metadata`, { body: JSON.stringify(capture, null, 2), contentType: "application/json" });
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage, scale: "css", animations: "disabled" });
  }

  for (const [route, heading] of [["/", ""], ["/wishlist", "Mine"], ["/partner", "Partner"], ["/surprises", "Surprises"], ["/settings", "Settings"], ["/discover", "Discover"]]) {
    await page.goto(route);
    await expect(page.getByRole("navigation", { name: "Wishlists" })).toBeVisible();
    if (heading) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Add wish", exact: true })).toBeVisible();
    await inspect(route.slice(1) || "home");
    if (route === "/settings") await inspect("settings-scrollable-content", true);
  }

  const hasPartnerWishes = await page.evaluate(async () => { const data = await (await fetch("/api/wishlist")).json(); return data.items.some((item: { owner: string }) => item.owner === "partner"); });
  if (hasPartnerWishes) {
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await page.getByRole("button", { name: "Instant Pick. Choose one at random." }).click();
  await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
  await expect(page.getByText("Your pick", { exact: true })).toBeVisible();
  await inspect("instant-pick");
  await page.getByRole("button", { name: "Choose a method" }).click();
  await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(page.getByRole("button", { name: "Spin Again", exact: true })).toBeVisible({ timeout: 15_000 });
  await inspect("wheel-result");
  }

  await page.goto("/wishlist");
  await page.getByRole("button", { name: "List layout", exact: true }).click();
  await inspect("wishlist-list");
  if (await page.locator(".wish-tile").count()) {
    await page.locator(".wish-tile").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await inspect("wish-detail");
    await page.getByRole("button", { name: "Хаах", exact: true }).click();
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Add wish", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await inspect("add-wish");

  expect(errors, "Browser console and uncaught errors").toEqual([]);
});

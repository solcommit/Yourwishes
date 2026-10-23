import { expect, test } from "@playwright/test";

test("private routes reject anonymous requests", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const route of ["/", "/wishlist", "/partner", "/discover", "/surprises", "/settings"]) {
    await page.goto(route);
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { name: "Yourwishes" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Wishlists" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /sign up|reset password/i })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect((await page.request.get("/api/wishlist")).status()).toBe(401);
  expect((await page.request.post("/api/wishlist/uploads")).status()).toBe(401);
});

test("a fabricated Supabase session cannot open private routes", async ({ page, context, baseURL }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Requires the configured public Supabase URL to identify its cookie.");
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.invalid-signature`;
  const session = { access_token: token, refresh_token: "fabricated-refresh-token", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "00000000-0000-4000-8000-000000000001" } };
  await context.addCookies([{ name: `sb-${projectRef}-auth-token`, value: `base64-${encode(session)}`, url: baseURL! }]);
  await page.goto("/wishlist");
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("navigation", { name: "Wishlists" })).toHaveCount(0);
});

test("sign-in layout stays within its viewport", async ({ page }, testInfo) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const metadata = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, deviceScaleFactor: devicePixelRatio, mode: "viewport", screenshotScale: "css", zoom: getComputedStyle(document.documentElement).zoom, visualViewportScale: visualViewport?.scale }));
  await testInfo.attach("sign-in-metadata", { body: JSON.stringify(metadata), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("sign-in.png"), scale: "css", fullPage: false });
});

test("member session survives reload and sign-out closes access", async ({ page }) => {
  test.skip(!process.env.E2E_MEMBER_A_EMAIL || !process.env.E2E_MEMBER_A_PASSWORD, "No member credentials provided.");
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_MEMBER_A_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_MEMBER_A_PASSWORD!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(page.getByRole("button", { name: "Add wish", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open profile", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Profile settings menu", exact: true }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL("/sign-in");
});

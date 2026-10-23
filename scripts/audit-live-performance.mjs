// Read-only audit: no wishlist mutations, traces, auth-state files, or credentials in results.
import { chromium, devices } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const base = process.argv[2] || "http://127.0.0.1:3000";
const label = process.argv[3] || "baseline-live-development";
if (!["http://127.0.0.1:3000", "http://127.0.0.1:3103"].includes(base)) throw new Error("Use the local audit dev/production ports.");
if (!process.env.E2E_MEMBER_A_EMAIL || !process.env.E2E_MEMBER_A_PASSWORD) throw new Error("Read-only audit credentials are not configured in .env.local.");
await mkdir("performance-results", { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const results = [];
const auth = await browser.newContext();
try {
  const login = await auth.newPage();
  await login.goto(`${base}/sign-in`);
  await login.getByLabel("Email", { exact: true }).fill(process.env.E2E_MEMBER_A_EMAIL);
  await login.getByLabel("Password", { exact: true }).fill(process.env.E2E_MEMBER_A_PASSWORD);
  await login.getByRole("button", { name: "Sign In", exact: true }).click();
  await login.waitForURL(`${base}/`, { timeout: 60000 });
  // In memory only: never pass a path or serialize this session.
  const state = await auth.storageState();
  await auth.close();
  for (const [name, width, height, mobile] of [["mobile", 390, 844, true], ["laptop", 1440, 900, false], ["desktop", 1920, 1080, false]]) {
    for (const [network, latency, download] of [["local", 0, -1], ["hotspot", 300, 5 * 1024 * 1024 / 8], ["slow-4g", 150, 1.6 * 1024 * 1024 / 8], ["offline", 0, -1]]) {
      const context = await browser.newContext({ ...(mobile ? devices["iPhone 13"] : devices["Desktop Chrome"]), viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, storageState: state });
      await context.addInitScript(() => {
        const audit = window.__audit = { renders: {}, longTasks: [], frames: [], commits: 0, hasRenderDurations: false };
        const seen = new WeakMap();
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true, renderers: new Map(), inject(renderer) { this.renderers.set(1, renderer); return 1; },
          onCommitFiberRoot(_id, root) {
            audit.commits++;
            const visit = (fiber) => {
              if (!fiber) return;
              const name = fiber.type?.displayName || fiber.type?.name;
              const time = fiber.actualStartTime;
              if (typeof time === "number" && time >= 0) audit.hasRenderDurations = true;
              // Ignore flags retained on bailed-out fibers from earlier commits.
              if (name && (fiber.flags & 1) && typeof time === "number" && time > (seen.get(fiber) ?? -1)) {
                seen.set(fiber, time); if (fiber.alternate) seen.set(fiber.alternate, time);
                audit.renders[name] = (audit.renders[name] || 0) + 1;
              }
              visit(fiber.child); visit(fiber.sibling);
            }; visit(root.current);
          }, onCommitFiberUnmount() {}, checkDCE() {},
        };
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) audit.longTasks.push(entry.duration); }).observe({ type: "longtask", buffered: true });
        let previous = performance.now();
        const frame = (now) => { audit.frames.push(now - previous); previous = now; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable"); await cdp.send("Performance.enable");
      const counts = {}; const transfers = { images: 0, scripts: 0, other: 0 }; const categories = new Map(); const timings = [];
      const category = (url) => url.includes("/api/wishlist/images/") ? "images" : url.endsWith("/api/wishlist") ? "wishlist" : url.includes("_rsc=") ? "navigation" : url.includes(".js") ? "scripts" : "other";
      page.on("request", (request) => { const kind = category(request.url()); counts[kind] = (counts[kind] || 0) + 1; });
      page.on("response", async (response) => { if (category(response.url()) === "wishlist") { const timing = response.request().timing(); timings.push(timing.responseStart - timing.requestStart); } });
      cdp.on("Network.responseReceived", ({ requestId, response }) => categories.set(requestId, category(response.url)));
      cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => { const kind = categories.get(requestId); transfers[kind === "images" ? "images" : kind === "scripts" ? "scripts" : "other"] += encodedDataLength; });
      const ready = page.waitForResponse((response) => response.url().endsWith("/api/wishlist"));
      const start = Date.now(); await page.goto(`${base}/wishlist`); await ready;
      await page.getByRole("heading", { name: "Mine", exact: true }).waitFor();
      const initialReadyMs = Date.now() - start;
      await page.locator(".wish-image:visible").evaluateAll(async (images) => { await Promise.all(images.map((image) => image.decode().catch(() => {}))); });
      // Warm both route segments; background refresh must not block these transitions.
      await page.locator('a[href="/partner"]').last().evaluate((link) => link.click());
      await page.getByRole("heading", { name: "Partner", exact: true }).waitFor();
      await page.waitForTimeout(500);
      await page.locator('a[href="/wishlist"]').last().evaluate((link) => link.click());
      await page.getByRole("heading", { name: "Mine", exact: true }).waitFor();
      const partnerCount = await page.locator(".wish-tile:visible").count();
      await page.locator('a[href="/partner"]').last().evaluate((link) => link.click());
      await page.getByRole("heading", { name: "Partner", exact: true }).waitFor();
      await page.waitForTimeout(5300);
      const imageDimensions = await page.locator(".wish-image").evaluateAll((images) => images.map((image) => ({ width: image.naturalWidth, height: image.naturalHeight, displayedWidth: image.clientWidth, displayedHeight: image.clientHeight })));
      const initial = { imageDimensions, requests: { ...counts }, transfers: { ...transfers }, wishlistMs: timings[0] };
      for (const key of Object.keys(counts)) delete counts[key];
      timings.length = 0;
      await cdp.send("Network.emulateNetworkConditions", { offline: network === "offline", latency, downloadThroughput: download, uploadThroughput: download });
      const responseWork = page.waitForResponse((response) => response.url().endsWith("/api/wishlist"), { timeout: 65000 }).catch(() => null);
      await page.evaluate(() => { const now = Date.now.bind(Date); Date.now = () => now() + 31_000; window.__audit.renders = {}; window.__audit.frames = []; window.__audit.longTasks = []; window.__audit.commits = 0; window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
      const cpuStart = await cdp.send("Performance.getMetrics");
      const navStart = Date.now();
      await page.locator('a[href="/wishlist"]').last().evaluate((link) => link.click());
      const navigated = await page.getByRole("heading", { name: "Mine", exact: true }).waitFor({ timeout: network === "offline" ? 2000 : 30000 }).then(() => true, () => false);
      const navigationMs = navigated ? Date.now() - navStart : null;
      await page.waitForTimeout(350);
      const detailStart = Date.now();
      const clicked = await page.evaluate(() => { const button = [...document.querySelectorAll(".wish-tile")].find((element) => element.checkVisibility()); button?.click(); return !!button; });
      if (clicked) await page.getByRole("dialog").waitFor();
      const detailOpenMs = clicked ? Date.now() - detailStart : null;
      await page.waitForTimeout(650);
      if (clicked) await page.getByRole("button", { name: "Хаах", exact: true }).evaluate((button) => button.click());
      const response = network === "offline" ? null : await responseWork;
      if (response) await response.finished();
      await page.waitForTimeout(600);
      // Include a scroll burst without reading layout each animation frame.
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
      await page.waitForTimeout(700);
      const observed = await page.evaluate(() => ({ ...window.__audit, visibleTiles: [...document.querySelectorAll(".wish-tile")].filter((element) => element.checkVisibility()).length, overflow: document.documentElement.scrollWidth - innerWidth, alert: !!document.querySelector('[role="alert"]') }));
      const cpuEnd = await cdp.send("Performance.getMetrics");
      const before = Object.fromEntries(cpuStart.metrics.map(({ name, value }) => [name, value]));
      const after = Object.fromEntries(cpuEnd.metrics.map(({ name, value }) => [name, value]));
      const frames = observed.frames.filter((value) => value > 0).sort((a, b) => a - b);
      const renders = Object.fromEntries(Object.entries(observed.renders).filter(([name]) => ["AppShell", "WishTile", "WishlistPage", "AppDock", "ProfileControl", "DiscoverPage"].includes(name)));
      const row = { label, viewport: { width, height, deviceScaleFactor: mobile ? 3 : 1 }, network, initialReadyMs, initial, detailOpenMs, navigationMs, expectedTiles: partnerCount, visibleTilesAfterRefresh: observed.visibleTiles, errorShown: observed.alert, requests: { ...counts }, refreshMs: network === "offline" ? null : timings[0] ?? null, refreshStatus: response?.status() ?? null, renders: observed.hasRenderDurations ? renders : null, commits: observed.commits, longTasks: observed.longTasks, frameP95Ms: frames[Math.floor(frames.length * .95)] ?? null, framesOver34ms: frames.filter((frame) => frame > 34).length, frames: frames.length, layoutCount: after.LayoutCount - before.LayoutCount, styleCount: after.RecalcStyleCount - before.RecalcStyleCount, taskMs: (after.TaskDuration - before.TaskDuration) * 1000, overflow: observed.overflow };
      results.push(row); console.log(JSON.stringify(row));
      // Screenshot names contain no titles, IDs, URLs, or session information.
      // Screenshots themselves are private and stay in the ignored results directory.
      if (network === "local") { await page.waitForTimeout(1000); await page.screenshot({ path: `performance-results/${label}-${name}.png`, fullPage: false, scale: "css" }); }
      await context.close();
    }
  }
} catch (error) {
  let message = error instanceof Error ? error.message : "Read-only audit failed.";
  for (const secret of [process.env.E2E_MEMBER_A_EMAIL, process.env.E2E_MEMBER_A_PASSWORD]) if (secret) message = message.replaceAll(secret, "[redacted]");
  console.error(message); process.exitCode = 1;
} finally { await browser.close(); await writeFile(`performance-results/${label}.json`, JSON.stringify(results, null, 2)); }

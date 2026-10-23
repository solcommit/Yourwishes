import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_CROSS_DEVICE_FIXTURE !== "true") throw new Error("Use isolated fixture servers only.");
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const production = process.env.UX_MODE === "production";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "ux-refinement.spec.ts",
  outputDir: `./performance-results/ux-${production ? "production" : "development"}`,
  workers: 2, fullyParallel: true, timeout: 120_000,
  reporter: [["./tests/helpers/credential-safe-reporter.ts"]],
  use: { baseURL: production ? "https://localhost:3104" : "http://localhost:3101", ignoreHTTPSErrors: true, trace: "off", screenshot: "off", actionTimeout: 15_000, reducedMotion: "no-preference" },
  projects: (["chromium", "webkit"] as const).flatMap((browserName) => [
    ["small", 320, 568], ["mobile", 390, 844], ["tablet", 768, 1024], ["laptop", 1440, 900], ["desktop", 1920, 1080],
  ].map(([name, width, height]) => ({ name: `${browserName}-${name}`, use: {
    browserName, viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: name === "mobile" ? 3 : 1,
    hasTouch: Number(width) < 900, isMobile: Number(width) < 900,
    ...(browserName === "webkit" && Number(width) < 700 ? { userAgent: devices["iPhone 13"].userAgent } : {}),
  } }))),
});

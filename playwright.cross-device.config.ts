import { defineConfig, devices } from "@playwright/test";

// Deliberately isolated from .env.local and live Supabase. These ports must serve
// the synthetic audit backend; production uses the temporary HTTPS proxy.
const mode = process.env.CROSS_DEVICE_MODE ?? "development";
const lan = process.env.CROSS_DEVICE_LAN;
if (!lan || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+$/.test(lan)) throw new Error("Set CROSS_DEVICE_LAN to this Mac's private IPv4 address.");
if (process.env.E2E_CROSS_DEVICE_FIXTURE !== "true") throw new Error("Cross-device tests require the isolated fixture servers.");
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cross-device.spec.ts",
  outputDir: `./performance-results/cross-device-${mode}${process.env.CROSS_DEVICE_WHEEL_ONLY === "true" ? "-wheel" : ""}`,
  timeout: 180_000,
  workers: 3,
  fullyParallel: true,
  reporter: [["./tests/helpers/credential-safe-reporter.ts"]],
  use: { trace: "off", screenshot: "off", ignoreHTTPSErrors: true, actionTimeout: 15_000, navigationTimeout: 30_000, reducedMotion: "no-preference" },
  projects: (["chromium", "webkit", "firefox"] as const).flatMap((browserName) =>
    ["localhost", lan].flatMap((host) => [
      ["desktop", 1920, 1080], ["laptop", 1440, 900], ["tablet", 768, 1024], ["mobile", 390, 844], ["narrow", 320, 568],
    ].map(([name, width, height]) => ({
      name: `${mode}-${host === "localhost" ? "localhost" : "lan"}-${browserName}-${name}`,
      use: {
        browserName,
        baseURL: `${mode === "production" ? "https" : "http"}://${host}:${mode === "production" ? 3104 : 3101}`,
        viewport: { width: Number(width), height: Number(height) },
        deviceScaleFactor: name === "mobile" ? 3 : name === "narrow" ? 2 : 1,
        hasTouch: ["mobile", "narrow", "tablet"].includes(String(name)),
        ...(browserName === "webkit" && ["mobile", "narrow"].includes(String(name)) ? { userAgent: devices["iPhone 13"].userAgent } : {}),
        ...(browserName !== "firefox" ? { isMobile: ["mobile", "narrow", "tablet"].includes(String(name)) } : {}),
      },
    })))),
});

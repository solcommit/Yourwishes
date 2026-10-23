import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const hasCredentials = Object.entries(process.env).some(([name, value]) => /^E2E_MEMBER_.*_(EMAIL|PASSWORD)$/.test(name) && value);
// HTML reports retain API-step arguments even when traces are off. Failure
// snapshots can also include filled inputs. Keep credentialed diagnostics text-only.
if (hasCredentials) process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: hasCredentials ? [["./tests/helpers/credential-safe-reporter.ts"]] : [["list"], ["html", { open: "never" }]],
  use: {
    channel: "chromium",
    baseURL,
    // Auth tests may contain real passwords/session cookies. Never persist traces.
    trace: "off",
    screenshot: hasCredentials ? "off" : "only-on-failure",
  },
  projects: [
    ...[
      ["desktop-baseline", 1920, 1080],
      ["laptop", 1440, 900],
      ["desktop-wide", 2560, 1440],
    ].map(([name, width, height]) => ({
      name: `${name}-chromium`,
      use: { ...devices["Desktop Chrome"], viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 },
    })),
    ...[
      ["mobile-375", "iPhone SE", 375, 667],
      ["mobile-390", "iPhone 13", 390, 844],
      ["mobile-402", "iPhone 16 Pro", 402, 874],
      ["mobile-small", "iPhone SE", 320, 568],
    ].map(([name, device, width, height]) => ({
      name: `${name}-chromium`,
      use: {
        ...devices[String(device)],
        defaultBrowserType: "chromium" as const,
        viewport: { width: Number(width), height: Number(height) },
      },
    })),
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && process.env.E2E_DISPOSABLE_SUPABASE !== "true",
    timeout: 120_000,
  },
});

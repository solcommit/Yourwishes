import { defineConfig } from "@playwright/test";

// A local, database-free harness for actual image decoding/encoding in each
// engine. The app's HTTP LAN picker/worker path is tested by the workspace suite.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "heic.spec.ts",
  outputDir: "./performance-results/cross-browser-images",
  workers: 1,
  timeout: 120_000,
  reporter: [["./tests/helpers/credential-safe-reporter.ts"]],
  use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, trace: "off", screenshot: "off" },
  projects: (["chromium", "webkit", "firefox"] as const).map((browserName) => ({
    name: `desktop-baseline-${browserName}`, use: { browserName },
  })),
});

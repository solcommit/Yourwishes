import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["browser-interactions.spec.ts", "profile-crop.spec.ts", "navigation-avatar.spec.ts", "profile-api.spec.ts", "profile-sync.spec.ts", "save-errors.spec.ts", "priority-folders.spec.ts", "private-photo.spec.ts", "product-options.spec.ts", "form-select.spec.ts", "heic.spec.ts", "photo-route.spec.ts", "thumbnail-cache.spec.ts", "wishlist-sync.spec.ts"],
  outputDir: "performance-results/photo-tests", workers: 1, timeout: 30_000,
  reporter: [["list"]],
  projects: [{ name: "desktop-baseline-chromium", use: { browserName: "chromium", channel: "chrome", viewport: { width: 390, height: 844 } } }],
});

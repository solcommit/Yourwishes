import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import sharp from "sharp";

test("thumbnail cache isolates readers, deduplicates work and clears pending work on sign-out", async ({}, info) => {
  test.skip(info.project.name !== "desktop-baseline-chromium", "Server cache semantics are independent of viewport.");
  // Run the real server-only cache in an isolated Node module, not an app route.
  const output = await build({
    entryPoints: ["src/lib/wishlist/thumbnail.ts"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "server-only-test", setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "" }));
    } }],
  });
  const exports: { privateThumbnail?: (id: string, path: string, width: number, download: () => Promise<Blob>) => Promise<Buffer>; clearPrivateThumbnails?: (id: string) => void } = {};
  // The CommonJS bundler replaces module.exports rather than mutating it.
  const loaded = { exports };
  new Function("require", "module", output.outputFiles[0].text)(createRequire(resolve("package.json")), loaded);
  const { privateThumbnail, clearPrivateThumbnails } = loaded.exports;
  const source = await sharp({ create: { width: 1200, height: 800, channels: 4, background: "#4688cc80" } }).png().toBuffer();
  let downloads = 0;
  const download = async () => { downloads++; return new Blob([new Uint8Array(source)], { type: "image/png" }); };
  const first = await privateThumbnail!("A", "shared/path", 320, download);
  const repeated = await privateThumbnail!("A", "shared/path", 320, download);
  expect(first.equals(repeated)).toBe(true); expect(downloads).toBe(1);
  await privateThumbnail!("B", "shared/path", 320, download);
  expect(downloads).toBe(2);
  const metadata = await sharp(first).metadata();
  expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(320); expect(metadata.height).toBe(213);
  expect(metadata.hasAlpha).toBe(true); expect(metadata.exif).toBeUndefined();
  clearPrivateThumbnails!("A");
  await privateThumbnail!("A", "shared/path", 320, download);
  expect(downloads).toBe(3);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const delayed = async () => { await gate; return download(); };
  const pending = privateThumbnail!("C", "shared/path", 320, delayed);
  const duplicate = privateThumbnail!("C", "shared/path", 320, delayed);
  clearPrivateThumbnails!("C"); release();
  await Promise.all([pending, duplicate]);
  expect(downloads).toBe(4);
  await privateThumbnail!("C", "shared/path", 320, download);
  expect(downloads).toBe(5);
});

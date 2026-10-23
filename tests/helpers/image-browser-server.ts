import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { transform, loadBindings } from "next/dist/build/swc";
import { heicSample, heicVariant } from "./heic-fixtures";

// Test-only browser harness: serves the real processing modules/worker, with no
// app route, auth bypass, or personal files. No new bundler dependency is needed.
export async function imageBrowserServer(): Promise<{ server: Server; url: string }> {
  await loadBindings();
  const modules = new Set(["prepare-wish-image", "heic-conversion.worker", "heic-render", "image-format", "heif-container", "wishlist/types"]);
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, "http://localhost").pathname;
      if (path === "/generated/heic-worker.js") {
        response.setHeader("Content-Type", "text/javascript");
        response.end(await readFile("public/generated/heic-worker.js")); return;
      }
      if (path === "/") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><title>Photo processing test</title>"); return; }
      if (path === "/fixture.heic" || path === "/rotated.heic" || path === "/exif.heif") {
        response.setHeader("Content-Type", "application/octet-stream");
        response.end(path === "/fixture.heic" ? heicSample : heicVariant(path === "/rotated.heic" ? "irot" : "exif")); return;
      }
      if (path === "/vendor/heic.js" || path === "/vendor/exifr.mjs") {
        response.setHeader("Content-Type", "text/javascript");
        response.end(await readFile(path === "/vendor/heic.js" ? "node_modules/heic-to/dist/csp/heic-to.js" : "node_modules/exifr/dist/full.esm.mjs")); return;
      }
      const sourceModule = path.slice(1).replace(/\.ts$/, "");
      if (!modules.has(sourceModule)) { response.writeHead(404); response.end(); return; }
      const source = (await readFile(`src/lib/${sourceModule}.ts`, "utf8"))
        .replaceAll('"heic-to/csp"', '"/vendor/heic.js"').replaceAll('"exifr"', '"/vendor/exifr.mjs"');
      const output = await transform(source, { filename: `${sourceModule}.ts`, jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "es6" } });
      response.setHeader("Content-Type", "text/javascript"); response.end(output.code);
    } catch (error) { console.error(error); response.writeHead(500); response.end("Image test harness failed."); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Image test server failed.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

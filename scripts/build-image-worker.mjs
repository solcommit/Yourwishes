import { build } from "esbuild";

await build({
  entryPoints: ["src/lib/heic-conversion.worker.ts"],
  outfile: "public/generated/heic-worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["safari17", "chrome110"],
  minify: true,
  legalComments: "eof",
});

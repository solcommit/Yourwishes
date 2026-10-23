import { writeFile, mkdir } from "node:fs/promises";

// Deterministic local-fixture request waterfall benchmark. No live credentials.
const base = "http://127.0.0.1:3102";
const control = async (query = "") => (await fetch(`http://127.0.0.1:3119/audit${query}`)).json();
const { session } = await control("?delay=0");
const headers = { Cookie: `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
const results = [];
for (const path of ["/api/wishlist", "/api/wishlist/images/dddddddd-dddd-4ddd-8ddd-000000000001"]) {
  for (let repeat = 0; repeat < 3; repeat++) {
    await control("?delay=150&reset=1");
    const start = performance.now();
    const response = await fetch(`${base}${path}`, { headers });
    const content = await response.arrayBuffer();
    const elapsedMs = performance.now() - start;
    // Include work deferred after the response in the request counts.
    await new Promise((resolve) => setTimeout(resolve, 200));
    results.push({ kind: path === "/api/wishlist" ? "wishlist" : "original", status: response.status, elapsedMs, bytes: content.byteLength, requests: (await control()).counts });
  }
}
await control("?delay=0");
await mkdir("performance-results", { recursive: true });
await writeFile(`performance-results/${process.argv[2] || "baseline"}-backend.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));

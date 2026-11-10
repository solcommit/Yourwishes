// Local audit service only. Never used by application code or deployment.
import { createServer } from "node:http";
import sharp from "sharp";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const partnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "audit@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url")}.local-fixture-not-a-real-signature`;
const session = { access_token: token, token_type: "bearer", refresh_token: "local-audit-only", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user };
const rows = Array.from({ length: 24 }, (_, i) => {
  const id = `cccccccc-cccc-4ccc-8ccc-${String(i + 1).padStart(12, "0")}`;
  const photoId = `dddddddd-dddd-4ddd-8ddd-${String(i + 1).padStart(12, "0")}`;
  return { id, owner_id: i < 12 ? userId : partnerId, title: `Audit wish ${i + 1}`, description: "Synthetic performance fixture, never saved to Supabase.", price: 25 + i, currency: "USD", product_url: null, priority: "Rare", category: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", wishlist_images: [{ id: photoId, storage_path: `${userId}/${id}/photo.jpg`, sort_order: 0, original_name: "fixture.jpg" }] };
});
const pixels = Buffer.alloc(1200 * 800 * 3);
let seed = 123;
for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; pixels[i] = seed >>> 24; }
const image = await sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } }).resize(3072, 2048).jpeg({ quality: 88 }).toBuffer();
// Deliberately unsorted metadata and visibly different secondary photos catch
// gallery-index mistakes that repeating the same sample image cannot detect.
const cover = rows[0].wishlist_images[0];
rows[0].wishlist_images = [
  { ...cover, id: "eeeeeeee-eeee-4eee-8eee-000000000002", storage_path: `${userId}/${rows[0].id}/gallery-wide.jpg`, sort_order: 2, original_name: "photo.png" },
  { ...cover, original_name: "IMG_1234.HEIC" },
  { ...cover, id: "eeeeeeee-eeee-4eee-8eee-000000000001", storage_path: `${userId}/${rows[0].id}/gallery-portrait.jpg`, sort_order: 1, original_name: "IMG_5678.HEIC" },
];
const portrait = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: "#28a86b" } }).jpeg({ quality: 90 }).toBuffer();
const wide = await sharp({ create: { width: 1800, height: 900, channels: 3, background: "#396ecc" } }).jpeg({ quality: 90 }).toBuffer();
let counts = {};
let delay = 0;
let failure = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "*");
  if (request.method === "OPTIONS") { response.end(); return; }
  if (url.pathname === "/audit") {
    if (url.searchParams.has("reset")) counts = {};
    if (url.searchParams.has("delay")) delay = Number(url.searchParams.get("delay"));
    if (url.searchParams.has("failure")) failure = url.searchParams.get("failure") === "true";
    response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ counts, imageBytes: image.length, delay, failure, session })); return;
  }
  counts[url.pathname] = (counts[url.pathname] || 0) + 1;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (url.pathname === "/auth/v1/user") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(user)); return; }
  if (url.pathname === "/auth/v1/token") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(session)); return; }
  if (url.pathname === "/auth/v1/logout") { response.end("{}"); return; }
  if (url.pathname === "/rest/v1/app_members") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ user_id: userId, slot: "A" })); return; }
  if (url.pathname === "/rest/v1/wishlist_items") {
    response.setHeader("Content-Type", "application/json");
    if (failure) { response.statusCode = 503; response.end(JSON.stringify({ message: "Fixture unavailable" })); return; }
    response.end(JSON.stringify(rows)); return;
  }
  if (url.pathname === "/rest/v1/wishlist_images") {
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const photo = rows.flatMap((row) => row.wishlist_images).find((entry) => entry.id === id);
    response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(photo ? { storage_path: photo.storage_path } : null)); return;
  }
  if (url.pathname === "/rest/v1/rpc/authorized_wish_photo") {
    let body = ""; for await (const chunk of request) body += chunk;
    const id = JSON.parse(body).p_id;
    const photo = rows.flatMap(row => row.wishlist_images).find(entry => entry.id === id);
    response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(photo ? [photo] : [])); return;
  }
  if (url.pathname.startsWith("/storage/v1/object/authenticated/wishlist-thumbnails/")) {
    response.writeHead(404, { "Content-Type": "application/json" }); response.end('{"message":"not found"}'); return;
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) { response.setHeader("Content-Type", "application/json"); response.end("[]"); return; }
  if (url.pathname.startsWith("/storage/v1/object/")) { response.setHeader("Content-Type", "image/jpeg"); response.end(url.pathname.endsWith("gallery-portrait.jpg") ? portrait : url.pathname.endsWith("gallery-wide.jpg") ? wide : image); return; }
  response.statusCode = 404; response.end("Not a fixture endpoint");
});
server.listen(3119, "127.0.0.1", () => console.log(`Isolated audit fixture on 3119; original photo ${image.length} bytes.`));

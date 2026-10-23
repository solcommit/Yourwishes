import "server-only";
import sharp from "sharp";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 128;
const TTL_MS = 5 * 60_000;
type Entry = { bytes: Buffer; expires: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<Buffer>>();
let totalBytes = 0;

function remove(key: string) {
  const entry = cache.get(key);
  if (entry) { totalBytes -= entry.bytes.length; cache.delete(key); }
}

export function clearPrivateThumbnails(userId: string) {
  for (const key of cache.keys()) if (key.startsWith(`${userId}:`)) remove(key);
  // Removing the promise also prevents its completion from repopulating cache.
  for (const key of pending.keys()) if (key.startsWith(`${userId}:`)) pending.delete(key);
}

// Called only after fresh server-side identity, membership, and photo RLS checks.
// Every reader has a separate cache namespace; HTTP responses remain no-store.
export async function privateThumbnail(userId: string, path: string, width: number, download: () => Promise<Blob>) {
  const key = `${userId}:${path}:${width}`;
  const now = Date.now();
  for (const [candidate, entry] of cache) if (entry.expires <= now) remove(candidate);
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key); cache.set(key, existing);
    return existing.bytes;
  }
  if (pending.has(key)) return pending.get(key)!;
  const work = (async () => {
    const source = await download();
    if (!source.size || source.size > 5 * 1024 * 1024) throw new Error("Invalid source photo.");
    return sharp(Buffer.from(await source.arrayBuffer()), { limitInputPixels: 52_000_000 })
      .rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
  })();
  pending.set(key, work);
  try {
    const bytes = await work;
    if (pending.get(key) === work && bytes.length <= MAX_BYTES) {
      while (cache.size >= MAX_ENTRIES || totalBytes + bytes.length > MAX_BYTES) remove(cache.keys().next().value!);
      cache.set(key, { bytes, expires: Date.now() + TTL_MS }); totalBytes += bytes.length;
    }
    return bytes;
  } finally { if (pending.get(key) === work) pending.delete(key); }
}

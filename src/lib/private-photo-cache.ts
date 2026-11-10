"use client";

const TTL = 30_000;
const MAX_BYTES = 16 * 1024 * 1024;
const entries = new Map<string, { blob: Blob; expires: number }>();
const pending = new Map<string, { controller: AbortController; promise: Promise<Blob> }>();
let blocked = false;

export function clearPrivatePhotos() {
  entries.clear();
  for (const entry of pending.values()) entry.controller.abort();
  pending.clear();
}
export function invalidatePrivatePhoto(src: string) { entries.delete(src); }
export function prunePrivatePhotos(paths: Set<string>) {
  for (const key of entries.keys()) if (!paths.has(key.split("?")[0])) entries.delete(key);
  for (const [key, entry] of pending) if (!paths.has(key.split("?")[0])) { entry.controller.abort(); pending.delete(key); }
}
if (typeof window !== "undefined") {
  const end = () => { blocked = true; clearPrivatePhotos(); };
  window.addEventListener("yourwishes-session-ending", end);
  window.addEventListener("yourwishes-private-data-cleared", end);
  window.addEventListener("storage", (event) => { if (event.key === "yourwishes-session-ended") end(); });
  window.addEventListener("pagehide", clearPrivatePhotos);
}

export async function privatePhoto(src: string): Promise<Blob> {
  if (blocked) throw new Error("Session ended");
  if (!/^\/api\/wishlist\/images\/[0-9a-f-]{36}(?:\?|$)/.test(src)) throw new Error("Invalid private image");
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
  const cached = entries.get(src);
  if (cached) { entries.delete(src); entries.set(src, cached); return cached.blob; }
  const active = pending.get(src);
  if (active) return active.promise;
  const controller = new AbortController();
  const promise = (async () => {
    const response = await fetch(src, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
    if (response.status === 401 || response.redirected) {
      window.dispatchEvent(new Event("yourwishes-session-ending"));
      window.location.replace("/sign-in"); throw new Error("Session ended");
    }
    if (!response.ok) throw new Error("Photo unavailable");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || !blob.size || blob.size > 5 * 1024 * 1024 || controller.signal.aborted || blocked) throw new Error("Photo unavailable");
    const total = () => [...entries.values()].reduce((sum, entry) => sum + entry.blob.size, 0);
    while (entries.size && (entries.size >= 128 || total() + blob.size > MAX_BYTES)) entries.delete(entries.keys().next().value!);
    entries.set(src, { blob, expires: Date.now() + TTL });
    return blob;
  })();
  pending.set(src, { controller, promise });
  try { return await promise; } finally { if (pending.get(src)?.promise === promise) pending.delete(src); }
}

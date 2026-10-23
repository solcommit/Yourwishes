import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/auth";
import { WISH_BUCKET, type WishlistItem } from "./types";

export class WishlistError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function wishlistSession() {
  const member = await getMember();
  if (!member) throw new WishlistError("Please sign in again.", 401);
  return { userId: member.userId, supabase: await createClient() };
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  // Next may normalize request.url to localhost in development. The incoming
  // Host identifies the origin the browser actually addressed; never use an
  // untrusted forwarded host to authorize a mutation.
  const expectedOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (request.headers.get("origin") !== expectedOrigin) throw new WishlistError("Request origin was rejected.", 403);
}
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}
export function failure(error: unknown) {
  return json({ error: error instanceof WishlistError ? error.message : "Could not complete the request. Please retry." }, error instanceof WishlistError ? error.status : 500);
}

export async function readLimitedBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum) throw new WishlistError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WishlistError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) { await reader.cancel(); throw new WishlistError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function fetchWishes(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<WishlistItem[]> {
  const { data, error } = await supabase.from("wishlist_items")
    .select("id,owner_id,title,description,price,currency,product_url,priority,category,created_at,updated_at,wishlist_images(id,storage_path,sort_order,original_name)")
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new WishlistError("Could not load wishes. Check the Phase 2 migration and try again.", 503);
  return data.map((row) => {
    const photos = [...row.wishlist_images].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    const images = photos.map((photo) => `/api/wishlist/images/${photo.id}`);
    return {
      id: row.id, name: row.title, description: row.description,
      price: row.price === null ? null : Number(row.price), currency: row.currency,
      url: row.product_url ?? "", priority: row.priority, category: row.category ?? "",
      createdAt: row.created_at, updatedAt: row.updated_at, ownerId: row.owner_id,
      owner: row.owner_id === userId ? "you" : "partner",
      images, image: images[0] ?? "", mediaNames: photos.map((photo) => photo.original_name),
      mediaName: photos[0]?.original_name ?? "", photos: photos.map((photo) => ({ path: photo.storage_path, name: photo.original_name })),
    };
  });
}

export async function cleanupImages(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: claimed, error: claimError } = await supabase.rpc("claim_wish_image_cleanup");
  if (claimError) return false;
  if (!claimed?.length) return true;
  const paths = claimed.map((job: { storage_path: string }) => job.storage_path);
  const { error: removeError } = await supabase.storage.from(WISH_BUCKET).remove(paths);
  if (removeError) return false;
  const { error: ackError } = await supabase.from("wishlist_image_cleanup").delete().eq("owner_id", userId).in("storage_path", paths);
  return !ackError;
}

// Only scheduling/cleanup status is shared; no sessions or photo data are cached.
const cleanupSchedule = new Map<string, { at: number; failed: boolean }>();
export function scheduleImageCleanup(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, force = false) {
  const now = Date.now();
  const previous = cleanupSchedule.get(userId);
  if (!force && previous && now - previous.at < 60_000) return !previous.failed;
  const state = { at: now, failed: previous?.failed ?? false };
  cleanupSchedule.set(userId, state);
  if (cleanupSchedule.size > 100) {
    for (const [id, value] of cleanupSchedule) if (now - value.at > 60_000) cleanupSchedule.delete(id);
  }
  after(async () => {
    try {
      state.failed = !await cleanupImages(supabase, userId);
    } catch { state.failed = true; }
    if (state.failed) state.at = 0;
  });
  return !state.failed;
}

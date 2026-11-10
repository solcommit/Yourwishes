import { after } from "next/server";
import { persistThumbnails } from "@/lib/wishlist/derivatives";
import { randomUUID } from "node:crypto";
import { cleanupImages, failure, json, readLimitedBody, sameOrigin, WishlistError, wishlistSession } from "@/lib/wishlist/server";
import { MAX_WISH_IMAGE_BYTES, UUID_PATTERN, WISH_BUCKET } from "@/lib/wishlist/types";
import { checkDimensions, rasterDimensions, rasterType } from "@/lib/image-format";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { supabase, userId } = await wishlistSession();
    // Bound actual bytes, not just the client-supplied Content-Length header.
    const bytes = await readLimitedBody(request, MAX_WISH_IMAGE_BYTES + 16_384);
    const form = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("file");
    const wishId = String(form.get("wishId") ?? "");
    if (!(file instanceof File) || !UUID_PATTERN.test(wishId)) throw new WishlistError("Invalid image upload.");
    if (!file.size || file.size > MAX_WISH_IMAGE_BYTES) throw new WishlistError("Choose images up to 5 MB each.");
    const content = new Uint8Array(await file.arrayBuffer());
    const type = rasterType(content);
    if (!type || (file.type && file.type !== type)) throw new WishlistError("Choose a valid JPEG, PNG, or WebP image.");
    try {
      const dimensions = rasterDimensions(content);
      checkDimensions(dimensions);
      if (dimensions.width !== dimensions.height) throw new Error("Not square");
    }
    catch { throw new WishlistError("Choose a square (1:1) image with valid dimensions."); }
    const isJpeg = type === "image/jpeg";
    const isPng = type === "image/png";
    const path = `${userId}/${wishId}/${randomUUID()}.${isJpeg ? "jpg" : isPng ? "png" : "webp"}`;
    const { error: stageError } = await supabase.from("wishlist_image_cleanup").insert({ storage_path: path, owner_id: userId });
    if (stageError) throw new WishlistError("Could not prepare the upload. Check the Phase 2 migration.", 503);
    const { error } = await supabase.storage.from(WISH_BUCKET).upload(path, file, { contentType: type, upsert: false });
    if (error) {
      await supabase.rpc("expire_wish_uploads", { p_paths: [path] });
      await cleanupImages(supabase, userId);
      throw new WishlistError("Photo upload failed. Your preview is kept; please retry.", 503);
    }
    after(async () => { try { await persistThumbnails(supabase, path, content); } catch { /* Owner reads and backfill retry. */ } });
    return json({ path, name: file.name.slice(0, 255) || "Photo" });
  } catch (error) { return failure(error); }
}

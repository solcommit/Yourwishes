import "server-only";
import sharp from "sharp";
import type { createClient } from "@/lib/supabase/server";

export const THUMBNAIL_BUCKET = "wishlist-thumbnails";
export const THUMBNAIL_WIDTHS = [320, 640, 960] as const;
export const derivativePath = (path: string, width: number) => `${path}/${width}.webp`;

// Write-once original paths make variants immutable. Only owners can write.
export async function persistThumbnails(supabase: Awaited<ReturnType<typeof createClient>>, path: string, source: Uint8Array) {
  for (const width of THUMBNAIL_WIDTHS) {
    const bytes = await sharp(source, { limitInputPixels: 52_000_000 }).rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    const { error } = await supabase.storage.from(THUMBNAIL_BUCKET)
      .upload(derivativePath(path, width), bytes, { contentType: "image/webp", upsert: false });
    // An existing immutable variant is already complete; never overwrite it.
    if (error && !/already exists|duplicate/i.test(error.message)) return false;
  }
  return true;
}

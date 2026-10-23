import { failure, WishlistError, wishlistSession } from "@/lib/wishlist/server";
import { UUID_PATTERN, WISH_BUCKET } from "@/lib/wishlist/types";
import { privateThumbnail } from "@/lib/wishlist/thumbnail";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new WishlistError("Photo unavailable.", 404);
    const widthValue = new URL(request.url).searchParams.get("width");
    if (widthValue !== null && !["320", "640", "960"].includes(widthValue)) throw new WishlistError("Invalid thumbnail size.");
    const { supabase, userId } = await wishlistSession();
    const { data: photo, error } = await supabase.from("wishlist_images").select("storage_path").eq("id", id).maybeSingle();
    if (error || !photo) throw new WishlistError("Photo unavailable.", 404);
    const download = async () => {
      const { data, error: downloadError } = await supabase.storage.from(WISH_BUCKET).download(photo.storage_path);
      if (downloadError || !data) throw new WishlistError("Photo unavailable.", 404);
      return data;
    };
    const thumbnail = widthValue !== null
      ? await privateThumbnail(userId, photo.storage_path, Number(widthValue), download)
      : null;
    const data = thumbnail ? new Blob([new Uint8Array(thumbnail)], { type: "image/webp" }) : await download();
    return new Response(data, { headers: {
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
      "Content-Type": data.type || "application/octet-stream", "Content-Disposition": "inline",
    } });
  } catch (error) { return failure(error); }
}

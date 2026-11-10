import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { failure, WishlistError } from "@/lib/wishlist/server";
import { UUID_PATTERN, WISH_BUCKET } from "@/lib/wishlist/types";
import { privateThumbnail } from "@/lib/wishlist/thumbnail";
import { derivativePath, persistThumbnails, THUMBNAIL_BUCKET } from "@/lib/wishlist/derivatives";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const stages: string[] = [];
  const started = performance.now();
  async function timed<T>(name: string, work: () => Promise<T>) {
    const start = performance.now();
    try { return await work(); }
    finally { stages.push(`${name};dur=${(performance.now() - start).toFixed(1)}`); }
  }
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new WishlistError("Photo unavailable.", 404);
    const widthValue = new URL(request.url).searchParams.get("width");
    if (widthValue !== null && !["320", "640", "960"].includes(widthValue)) throw new WishlistError("Invalid thumbnail size.");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await timed("identity", () => supabase.auth.getUser());
    if (authError || !user) throw new WishlistError("Please sign in again.", 401);
    let path: string | undefined;
    const access = await timed("access", async () => await supabase.rpc("authorized_wish_photo", { p_id: id }));
    if (access.error?.code === "PGRST202") {
      // Rolling deployment: preserve the old secure path until migration applies.
      const { data: member, error } = await supabase.from("app_members").select("slot").eq("user_id", user.id).maybeSingle();
      if (error || !member || !["A", "B"].includes(member.slot)) throw new WishlistError("Photo unavailable.", 404);
      const { data: photo, error: photoError } = await supabase.from("wishlist_images").select("storage_path").eq("id", id).maybeSingle();
      if (!photoError) path = photo?.storage_path;
    } else if (!access.error) path = access.data?.[0]?.storage_path;
    if (!path) throw new WishlistError("Photo unavailable.", access.error && access.error.code !== "PGRST202" ? 503 : 404);
    const storagePath = path;
    let originalBlob: Blob | undefined;
    const download = async () => {
      const { data, error } = await timed("original_download", () => supabase.storage.from(WISH_BUCKET).download(storagePath));
      if (error || !data) throw new WishlistError("Photo unavailable.", 404);
      originalBlob = data;
      return data;
    };
    let source = "original";
    let data: Blob;
    if (widthValue !== null) {
      const width = Number(widthValue);
      const bytes = await timed("thumbnail", () => privateThumbnail(user.id, storagePath, width, download, async () => {
        const stored = await timed("variant_download", () => supabase.storage.from(THUMBNAIL_BUCKET).download(derivativePath(storagePath, width)));
        if (!stored.error && stored.data) { source = "durable"; return Buffer.from(await stored.data.arrayBuffer()); }
        source = "generated";
        return null;
      }, (value) => { if (value) source = "memory"; }));
      data = new Blob([new Uint8Array(bytes)], { type: "image/webp" });
    } else data = await download();
    if (source === "generated" && storagePath.startsWith(`${user.id}/`)) {
      after(async () => {
        try { const original = originalBlob ?? await download(); await persistThumbnails(supabase, storagePath, new Uint8Array(await original.arrayBuffer())); }
        catch { /* A future owner read/backfill retries; serving is unaffected. */ }
      });
    }
    stages.push(`total;dur=${(performance.now() - started).toFixed(1)}`);
    return new Response(data, { headers: {
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
      "Content-Type": data.type || "application/octet-stream", "Content-Disposition": "inline",
      "Server-Timing": stages.join(", "), "X-Thumbnail-Source": source,
    } });
  } catch (error) { const response = failure(error); response.headers.set("Server-Timing", stages.join(", ")); return response; }
}

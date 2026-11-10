import { normalizeProductUrl } from "@/lib/product-url";
import { failure, fetchWishes, json, readLimitedBody, sameOrigin, scheduleImageCleanup, WishlistError, wishlistSession } from "@/lib/wishlist/server";
import { UUID_PATTERN, validateWish, type WishInput } from "@/lib/wishlist/types";

export async function GET() {
  try {
    const { supabase, userId } = await wishlistSession();
    const items = await fetchWishes(supabase, userId);
    const cleaned = scheduleImageCleanup(supabase, userId);
    return json({ userId, items, warning: cleaned ? "" : "Some unused photos are awaiting cleanup. It will retry automatically." });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  let stage = "origin";
  try {
    sameOrigin(request);
    stage = "session";
    const { supabase, userId } = await wishlistSession();
    stage = "validation";
    const raw = new TextDecoder().decode(await readLimitedBody(request, 16_384));
    let input: WishInput;
    try { input = JSON.parse(raw); if (typeof input?.url === "string") input.url = normalizeProductUrl(input.url); validateWish(input); } catch (error) { throw new WishlistError(error instanceof Error ? error.message : "Invalid wish."); }
    for (const photo of input.photos) {
      if (!photo.path.startsWith(`${userId}/${input.id}/`) || !photo.name || photo.name.length > 255) throw new WishlistError("Invalid image ownership.", 403);
    }
    stage = "save_wish";
    const { error } = await supabase.rpc("save_wish", {
      p_id: input.id, p_title: input.name.trim(), p_description: input.description.trim(),
      p_price: input.price, p_currency: input.currency, p_product_url: input.url.trim() || null,
      p_priority: input.priority, p_category: input.category.trim() || null,
      p_images: input.photos, p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (error) {
      const photosMigrationRequired = input.photos.length === 0 && error.code === "23514" && /requires 1[–-]5 images/.test(error.message);
      if (process.env.NODE_ENV === "development") {
        // PostgREST normally embeds SQL object names in message rather than
        // exposing PostgreSQL's table/constraint fields. Never log failing rows.
        const diagnostic = error as typeof error & { table?: string; constraint?: string };
        const table = diagnostic.table ?? error.message.match(/relation "([a-z_]+)"/)?.[1];
        const constraint = diagnostic.constraint ?? error.message.match(/constraint "([a-z_]+)"/)?.[1];
        const safeIdentifier = (value: string | undefined) => value && /^[a-z_]{1,63}$/.test(value) ? value : null;
        console.warn("[wishlist.save]", {
          stage, code: error.code,
          table: safeIdentifier(table), constraint: safeIdentifier(constraint),
          detail: error.details ? "[redacted: database detail may contain private row data]" : null,
          payload: { priority: input.priority, currency: input.currency, imageCount: input.photos.length, hasPrice: input.price !== null },
          photosMigrationRequired,
        });
      }
      // Only staged, uncommitted objects have queue entries. A committed save
      // removes those entries atomically, including when its HTTP reply was lost.
      await supabase.rpc("expire_wish_uploads", { p_paths: input.photos.map((photo) => photo.path) });
      scheduleImageCleanup(supabase, userId, true);
      if (photosMigrationRequired) throw new WishlistError("Photo-free wishes are not enabled in the database yet.", 503);
      throw new WishlistError(error.code === "40001" || error.code === "23505"
      ? "This wish changed or was already saved. Refresh the list before retrying."
      : "Could not save the wish. Check your photos and retry; your previews have been kept.", error.code === "40001" || error.code === "23505" ? 409 : 400);
    }
    const cleaned = scheduleImageCleanup(supabase, userId, true);
    return json({ saved: true, warning: cleaned ? "" : "Wish saved. Unused photo cleanup will retry automatically." });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.warn("[wishlist.save.failed]", { stage, status: error instanceof WishlistError ? error.status : 500 });
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { supabase, userId } = await wishlistSession();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const version = new URL(request.url).searchParams.get("version");
    if (!UUID_PATTERN.test(id) || !version || !Number.isFinite(Date.parse(version))) throw new WishlistError("Invalid wish version.");
    const { data, error } = await supabase.from("wishlist_items").delete().eq("id", id).eq("owner_id", userId).eq("updated_at", version).select("id");
    if (error) throw new WishlistError("Could not delete the wish. Please retry.", 503);
    if (!data?.length) throw new WishlistError("This wish changed or was deleted. Refresh before retrying.", 409);
    const cleaned = scheduleImageCleanup(supabase, userId, true);
    return json({ deleted: true, warning: cleaned ? "" : "Wish deleted. Photo cleanup will retry automatically." });
  } catch (error) { return failure(error); }
}

import type { WishlistItem } from "@/lib/wishlist/types";

export const MAX_WISH_IMAGES = 5;
export const WISH_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence";

export function getWishImages(item: Pick<WishlistItem, "image" | "images">) {
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter((image): image is string => typeof image === "string" && image.length > 0);
  }
  return typeof item.image === "string" && item.image ? [item.image] : [];
}

export function revokeTemporaryWishImage(url: string, retainedUrls: ReadonlySet<string> = new Set()) {
  if (url.startsWith("blob:") && !retainedUrls.has(url)) URL.revokeObjectURL(url);
}

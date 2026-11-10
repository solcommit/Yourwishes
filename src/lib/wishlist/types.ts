export type WishCurrency = "USD" | "MNT" | "CNY";
export type WishPhoto = { path: string; name: string };
export type WishlistItem = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  currency: WishCurrency;
  url: string;
  priority: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  category: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner: "you" | "partner";
  mediaName: string;
  image: string;
  images: string[];
  mediaNames: string[];
  photos: WishPhoto[];
};

export type WishInput = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  currency: WishCurrency;
  url: string;
  priority: WishlistItem["priority"];
  category: string;
  photos: WishPhoto[];
  expectedUpdatedAt: string | null;
};

export const WISH_BUCKET = "wishlist-images";
export const MAX_WISH_IMAGE_BYTES = 5 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateWish(input: WishInput) {
  if (!input || typeof input !== "object" || typeof input.id !== "string" ||
      typeof input.name !== "string" || typeof input.description !== "string" ||
      typeof input.category !== "string" || typeof input.url !== "string" ||
      (input.expectedUpdatedAt !== null && typeof input.expectedUpdatedAt !== "string") ||
      !Array.isArray(input.photos) || input.photos.some((photo) => !photo || typeof photo.path !== "string" || typeof photo.name !== "string" || photo.path.length > 1024 || !photo.name || photo.name.length > 255)) {
    throw new Error("Invalid wish details.");
  }
  if (!UUID_PATTERN.test(input.id)) throw new Error("Invalid wish identifier.");
  if (!input.name.trim() || input.name.trim().length > 100) throw new Error("Enter a name between 1 and 100 characters.");
  if (input.description.length > 500 || input.category.length > 64) throw new Error("Description or category is too long.");
  if (input.price !== null && (!Number.isFinite(input.price) || input.price < 0 || input.price >= 1e12 || Number(input.price.toFixed(2)) !== input.price)) throw new Error("Enter a nonnegative price with at most two decimal places.");
  if (!["USD", "MNT", "CNY"].includes(input.currency)) throw new Error("Choose USD, MNT, or CNY.");
  if (!["Common", "Uncommon", "Rare", "Epic", "Legendary"].includes(input.priority)) throw new Error("Choose a valid priority.");
  if (input.url) {
    let url: URL;
    try { url = new URL(input.url); } catch { throw new Error("Enter a valid HTTP or HTTPS product URL."); }
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password || input.url.length > 2048) throw new Error("Enter a valid HTTP or HTTPS product URL.");
  }
  if (input.photos.length > 5 || new Set(input.photos.map((p) => p.path)).size !== input.photos.length) throw new Error("Add up to 5 distinct images.");
  if (input.expectedUpdatedAt !== null && !Number.isFinite(Date.parse(input.expectedUpdatedAt))) throw new Error("Invalid wish version. Refresh and try again.");
}

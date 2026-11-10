import type { WishlistItem } from "./wishlist/types";

/** Keep existing records readable while the database migration rolls out. */
export function normalizeWishPriority(value: string): WishlistItem["priority"] {
  if (value === "Low") return "Common";
  if (value === "Medium") return "Rare";
  if (value === "High") return "Legendary";
  return ["Common", "Uncommon", "Rare", "Epic", "Legendary"].includes(value)
    ? value as WishlistItem["priority"] : "Rare";
}

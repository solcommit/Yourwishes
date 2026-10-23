import type { WishlistItem } from "./types";

// Keep unchanged objects (and the array itself) stable across revalidation.
// Compare the complete payload, including photos, rather than trusting timestamps.
export function reconcileWishes(previous: WishlistItem[], incoming: WishlistItem[]) {
  const byId = new Map(previous.map((item) => [item.id, item]));
  const next = incoming.map((item) => {
    const existing = byId.get(item.id);
    return existing && JSON.stringify(existing) === JSON.stringify(item) ? existing : item;
  });
  return previous.length === next.length && next.every((item, index) => item === previous[index]) ? previous : next;
}

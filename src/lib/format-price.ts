import type { WishCurrency } from "@/lib/wishlist/types";

export function normalizeWishCurrency(currency: unknown): WishCurrency {
  return currency === "MNT" || currency === "CNY" ? currency : "USD";
}

export function formatWishPrice(price: number, currency: unknown) {
  const supportedCurrency = normalizeWishCurrency(currency);
  if (supportedCurrency === "MNT") {
    return `₮${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(price)}`;
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: supportedCurrency,
  }).format(price);
}

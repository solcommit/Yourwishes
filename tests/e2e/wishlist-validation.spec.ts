import { expect, test } from "@playwright/test";
import { validateWish, type WishInput } from "../../src/lib/wishlist/types";

const valid = (): WishInput => ({
  id: "00000000-0000-4000-8000-000000000001", name: "A real wish", description: "",
  price: 12.34, currency: "USD", url: "https://example.com/product", priority: "Rare",
  category: "Books", photos: [{ path: "preview", name: "photo.png" }], expectedUpdatedAt: null,
});

test("wish validation preserves currencies and rejects invalid prices and URLs", () => {
  expect(() => validateWish(valid())).not.toThrow();
  expect(() => validateWish({ ...valid(), price: 0 })).not.toThrow();
  expect(() => validateWish({ ...valid(), price: null })).not.toThrow();
  expect(() => validateWish({ ...valid(), price: 999999999999.99 })).not.toThrow();
  expect(() => validateWish({ ...valid(), price: 12500, currency: "MNT" })).not.toThrow();
  for (const price of [-1, NaN, Infinity, 1.234, 1e12]) expect(() => validateWish({ ...valid(), price })).toThrow();
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:secret@example.com", "not-a-url"]) expect(() => validateWish({ ...valid(), url })).toThrow();
});

test("wish validation allows zero to five distinct photos and valid fields", () => {
  expect(() => validateWish({ ...valid(), photos: [] })).not.toThrow();
  expect(() => validateWish({ ...valid(), photos: [], expectedUpdatedAt: "2026-10-23T00:00:00Z" })).not.toThrow();
  expect(() => validateWish({ ...valid(), photos: Array.from({ length: 6 }, (_, i) => ({ path: String(i), name: "photo.png" })) })).toThrow();
  expect(() => validateWish({ ...valid(), photos: [valid().photos[0], valid().photos[0]] })).toThrow();
  expect(() => validateWish({ ...valid(), name: "  " })).toThrow();
  expect(() => validateWish({ ...valid(), expectedUpdatedAt: "invalid-date" })).toThrow();
});

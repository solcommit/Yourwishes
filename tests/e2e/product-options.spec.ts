import { test, expect } from "@playwright/test";
import { normalizeProductUrl } from "../../src/lib/product-url";
import { normalizeWishCurrency, formatWishPrice } from "../../src/lib/format-price";
import { validateWish } from "../../src/lib/wishlist/types";

test("CNY is accepted and formatted without changing USD/MNT", () => {
  expect(normalizeWishCurrency("CNY")).toBe("CNY");
  expect(formatWishPrice(123.45, "CNY")).toContain("123.45");
  expect(formatWishPrice(123.45, "CNY")).toContain("¥");
  expect(normalizeWishCurrency("unknown")).toBe("USD");
  expect(normalizeWishCurrency("MNT")).toBe("MNT");
  expect(() => validateWish({ id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name:"Test", description:"", price:12.34, currency:"CNY", url:"https://item.taobao.com/item.htm?id=123", priority:"Rare", category:"", photos:[], expectedUpdatedAt:null })).not.toThrow();
});

test("Taobao full/short/share links normalize without fetching or losing product parameters", () => {
  expect(normalizeProductUrl("item.taobao.com/item.htm?id=123")).toBe("https://item.taobao.com/item.htm?id=123");
  expect(normalizeProductUrl("【淘宝】商品 https://e.tb.cn/h.fixture?tk=abc CZ123 点击链接直接打开"))
    .toBe("https://e.tb.cn/h.fixture?tk=abc");
  expect(normalizeProductUrl("看看 https://m.tb.cn/h.fixture，"))
    .toBe("https://m.tb.cn/h.fixture");
  expect(normalizeProductUrl("https://e.tb.cn/h.fixture?tk=abc 点击链接打开")).toBe("https://e.tb.cn/h.fixture?tk=abc");
  expect(normalizeProductUrl("https://detail.tmall.com/item.htm?id=42")).toBe("https://detail.tmall.com/item.htm?id=42");
  expect(normalizeProductUrl("https://example.com/product?x=1&y=2")).toBe("https://example.com/product?x=1&y=2");
  expect(normalizeProductUrl(" ")).toBe("");
});

test("invalid share tokens, spoofed domains, credentials and script URLs are rejected", () => {
  for (const input of ["javascript:alert(1)", "https://user:pass@taobao.com/item", "【淘宝】￥TOKEN￥", "share https://taobao.com.evil.test/product", "https://example.com/"+"x".repeat(2048)]) {
    expect(() => normalizeProductUrl(input)).toThrow();
  }
});


test("all five item grades validate and legacy values normalize", async () => {
  const { normalizeWishPriority } = await import("../../src/lib/wish-priority");
  const base = { id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name:"Test", description:"", price:null, currency:"USD" as const, url:"", category:"", photos:[], expectedUpdatedAt:null };
  for (const priority of ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const) {
    expect(() => validateWish({ ...base, priority })).not.toThrow();
    expect(normalizeWishPriority(priority)).toBe(priority);
  }
  expect(normalizeWishPriority("Low")).toBe("Common");
  expect(normalizeWishPriority("Medium")).toBe("Rare");
  expect(normalizeWishPriority("High")).toBe("Legendary");
});

import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Only explicitly opted-in, empty, disposable projects may run this mutation suite.
const enabled = process.env.E2E_DISPOSABLE_SUPABASE === "true" &&
  ["A", "B"].every((slot) => process.env[`E2E_MEMBER_${slot}_EMAIL`] && process.env[`E2E_MEMBER_${slot}_PASSWORD`]);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz0AAAAASUVORK5CYII=", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: png });
async function login(page: Page, slot: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(process.env[`E2E_MEMBER_${slot}_EMAIL`]!);
  await page.getByLabel("Password", { exact: true }).fill(process.env[`E2E_MEMBER_${slot}_PASSWORD`]!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("persistent CRUD, private images, reciprocal ownership, synchronization and real Discover", async ({ page, browser, baseURL }, testInfo) => {
  test.skip(!enabled || testInfo.project.name !== "desktop-baseline-chromium", "Needs explicit disposable-project opt-in and both accounts; runs once at desktop baseline.");
  test.setTimeout(240_000);
  const otherContext = await browser.newContext({ baseURL });
  const partner = await otherContext.newPage();
  const anon = await browser.newContext({ baseURL });
  const raw = ["A", "B"].map(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }));
  const created = new Map<string, Page>();
  try {
    await login(page, "A"); await login(partner, "B");
    const initial = await (await page.request.get("/api/wishlist")).json();
    test.skip(initial.items.length > 0, "The disposable test project must start with empty wishlists; existing data is never reset.");
    for (let i = 0; i < 2; i++) {
      const { error } = await raw[i].auth.signInWithPassword({ email: process.env[`E2E_MEMBER_${i ? "B" : "A"}_EMAIL`]!, password: process.env[`E2E_MEMBER_${i ? "B" : "A"}_PASSWORD`]! });
      expect(error).toBeNull();
    }
    await page.goto("/wishlist"); await expect(page.getByText("Одоогоор хүсэл алга", { exact: true })).toBeVisible();
    const prefix = `Phase2-${Date.now()}`;
    for (const [current, title] of [[page, `${prefix}-A`], [partner, `${prefix}-B`]] as const) {
      await current.goto("/");
      await current.getByRole("button", { name: "Add wish", exact: true }).click();
      await current.getByLabel("Хүслийн нэр", { exact: true }).fill(title);
      await current.getByLabel("Үнэ", { exact: true }).fill("12.34");
      await current.getByLabel("Ангилал", { exact: true }).fill("Books");
      await current.getByLabel("Бүтээгдэхүүний холбоос", { exact: true }).fill("https://example.com/product");
      await current.locator("#wish-images").setInputFiles([photo("first.png"), photo("second.png")]);
      await current.getByRole("button", { name: "Хүсэл нэмэх", exact: true }).click();
      await expect(current.getByRole("dialog")).toHaveCount(0);
      const result = await (await current.request.get("/api/wishlist")).json();
      const item = result.items.find((wish: { name: string }) => wish.name === title);
      expect(item.owner).toBe("you"); expect(item.category).toBe("Books"); expect(item.photos).toHaveLength(2);
      created.set(item.id, current);
    }
    await page.goto("/wishlist"); await page.reload();
    await expect(page.getByRole("button", { name: new RegExp(`${prefix}-A`) })).toBeVisible();
    const aList = await (await page.request.get("/api/wishlist")).json();
    let own = aList.items.find((item: { owner: string }) => item.owner === "you");
    const partnerWish = aList.items.find((item: { owner: string }) => item.owner === "partner");
    expect(partnerWish.name).toBe(`${prefix}-B`);
    const spoofedImage = await page.request.post("/api/wishlist/uploads", {
      headers: { Origin: baseURL! }, multipart: { wishId: own.id, file: { name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not an image") } },
    });
    expect(spoofedImage.status()).toBe(400);
    const wrongOrigin = await page.request.post("/api/wishlist", { headers: { Origin: "https://unrelated.invalid" }, data: {} });
    expect(wrongOrigin.status()).toBe(403);
    await partner.goto("/partner");
    await expect(partner.getByRole("button", { name: new RegExp(`${prefix}-A`) })).toBeVisible();
    await partner.getByRole("button", { name: new RegExp(`${prefix}-A`) }).click();
    await expect(partner.getByRole("button", { name: "Засах", exact: true })).toHaveCount(0);
    await expect(partner.getByRole("button", { name: "Устгах", exact: true })).toHaveCount(0);
    expect((await partner.request.get(own.images[0])).status()).toBe(200);
    expect((await anon.request.get(own.images[0])).status()).toBe(401);
    expect((await anon.request.get("/api/wishlist")).status()).toBe(401);
    const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const publicRows = await publicClient.from("wishlist_items").select("id");
    expect(publicRows.error || publicRows.data?.length === 0).toBeTruthy();
    expect((await publicClient.storage.from("wishlist-images").download(own.photos[0].path)).error).not.toBeNull();
    for (const [client, item] of [[raw[1], own], [raw[0], partnerWish]] as const) {
      const update = await client.from("wishlist_items").update({ title: "Forbidden" }).eq("id", item.id).select();
      expect(update.error || update.data?.length === 0).toBeTruthy();
      const remove = await client.storage.from("wishlist-images").remove([item.photos[0].path]);
      expect(remove.error || remove.data?.length === 0).toBeTruthy();
      const overwrite = await client.storage.from("wishlist-images").upload(item.photos[0].path, png, { upsert: true, contentType: "image/png" });
      expect(overwrite.error).not.toBeNull();
    }
    if (process.env.E2E_MEMBER_NONMEMBER_EMAIL && process.env.E2E_MEMBER_NONMEMBER_PASSWORD) {
      const outsider = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
      const { error } = await outsider.auth.signInWithPassword({ email: process.env.E2E_MEMBER_NONMEMBER_EMAIL, password: process.env.E2E_MEMBER_NONMEMBER_PASSWORD });
      expect(error).toBeNull();
      for (const table of ["app_members", "profiles", "wishlist_items", "wishlist_images", "wishlist_image_cleanup"]) {
        const read = await outsider.from(table).select("*");
        expect(read.error || read.data?.length === 0).toBeTruthy();
      }
      expect((await outsider.storage.from("wishlist-images").download(own.photos[0].path)).error).not.toBeNull();
      await outsider.auth.signOut({ scope: "local" });
    } else testInfo.annotations.push({ type: "unverified", description: "Third-account RLS checks require explicit nonmember credentials." });
    const badSave = await partner.request.post("/api/wishlist", { headers: { Origin: baseURL! }, data: { id: own.id, name: "Forbidden", description: "", price: 1, currency: "USD", url: "", priority: "Low", category: "", photos: own.photos, expectedUpdatedAt: own.updatedAt } });
    expect(badSave.ok()).toBe(false);
    const extraImages = await raw[0].rpc("save_wish", { p_id: own.id, p_title: own.name, p_description: "", p_price: 1, p_currency: "USD", p_product_url: null, p_priority: "Low", p_category: null, p_images: Array.from({ length: 6 }, () => own.photos[0]), p_expected_updated_at: own.updatedAt });
    expect(extraImages.error).not.toBeNull();
    await partner.getByRole("button", { name: "Хаах", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`${prefix}-A`) }).click();
    await page.getByRole("button", { name: "Засах", exact: true }).click();
    await page.getByLabel("Хүслийн нэр", { exact: true }).fill(`${prefix}-A-edited`);
    await page.getByLabel("Валют", { exact: true }).selectOption("MNT");
    await page.getByLabel("Үнэ", { exact: true }).fill("12500");
    await page.getByRole("button", { name: "2-р зургийг урагшлуулах", exact: true }).click();
    await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await expect(page.getByRole("heading", { name: `${prefix}-A-edited`, exact: true })).toBeVisible();
    await partner.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(partner.getByRole("button", { name: new RegExp(`${prefix}-A-edited`) })).toBeVisible({ timeout: 40_000 });
    own = (await (await page.request.get("/api/wishlist")).json()).items.find((item: { owner: string }) => item.owner === "you");
    expect(own.currency).toBe("MNT"); expect(own.price).toBe(12500); expect(own.mediaNames).toEqual(["second.png", "first.png"]);
    const removedPath = own.photos[1].path;
    await page.getByRole("button", { name: "Засах", exact: true }).click();
    await page.getByRole("button", { name: "2-р зургийг хасах", exact: true }).click();
    await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await expect(page.getByRole("heading", { name: `${prefix}-A-edited`, exact: true })).toBeVisible();
    expect((await raw[0].storage.from("wishlist-images").download(removedPath)).error).not.toBeNull();
    const remaining = await raw[0].from("wishlist_images").select("id").eq("wish_id", own.id);
    expect(remaining.data).toHaveLength(1);
    const removeLast = await raw[0].from("wishlist_images").delete().eq("id", remaining.data![0].id);
    expect(removeLast.error).not.toBeNull();
    await page.getByRole("button", { name: "Хаах", exact: true }).click();
    await page.goto("/discover");
    await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
    await page.getByRole("button", { name: "Instant Pick. Choose one at random." }).click();
    await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
    await expect(page.locator(".instant-result strong")).toHaveText(`${prefix}-B`);
    await page.getByRole("button", { name: "Choose a method" }).click();
    await page.getByRole("button", { name: "Spin the Wheel. A playful way to decide." }).click();
    await page.getByRole("button", { name: "Spin", exact: true }).click();
    await expect(page.locator(".prize-wheel-winner")).toHaveText(`${prefix}-B`, { timeout: 15_000 });
    for (const [id, current] of created) {
      const list = await (await current.request.get("/api/wishlist")).json();
      const item = list.items.find((wish: { id: string }) => wish.id === id);
      const response = await current.request.delete(`/api/wishlist?${new URLSearchParams({ id, version: item.updatedAt })}`, { headers: { Origin: baseURL! } });
      expect(response.ok()).toBe(true);
    }
    await page.goto("/wishlist"); await expect(page.getByText("Одоогоор хүсэл алга", { exact: true })).toBeVisible();
    await partner.goto("/partner"); await expect(partner.getByText("Хос тань хараахан хүсэл нэмээгүй байна", { exact: true })).toBeVisible();
    await page.goto("/discover");
    await page.getByRole("button", { name: "Pick a Gift", exact: true }).click();
    await expect(page.getByText("No partner wishes are available yet.", { exact: true })).toBeVisible();
  } finally {
    // Only our recorded UUIDs are eligible for cleanup; never clear whole tables.
    for (const [id, current] of created) {
      const response = await current.request.get("/api/wishlist");
      if (!response.ok()) continue;
      const item = (await response.json()).items.find((wish: { id: string }) => wish.id === id);
      if (item) await current.request.delete(`/api/wishlist?${new URLSearchParams({ id, version: item.updatedAt })}`, { headers: { Origin: baseURL! } });
    }
    await Promise.all(raw.map((client) => client.auth.signOut({ scope: "local" })));
    await otherContext.close(); await anon.close();
  }
});

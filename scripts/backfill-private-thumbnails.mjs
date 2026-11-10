// Explicit owner-scoped operation; never uses service-role privileges.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.THUMBNAIL_BACKFILL_EMAIL;
const password = process.env.THUMBNAIL_BACKFILL_PASSWORD;
if (!url || !key || !email || !password) throw new Error("Configure Supabase and THUMBNAIL_BACKFILL_EMAIL/PASSWORD in .env.local.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let count = 0;
try {
  const auth = await client.auth.signInWithPassword({ email, password });
  if (auth.error || !auth.data.user) throw new Error("Backfill sign-in failed.");
  const owner = auth.data.user.id;
  const membership = await client.from("app_members").select("slot").eq("user_id", owner).maybeSingle();
  if (membership.error || !membership.data || !["A", "B"].includes(membership.data.slot)) throw new Error("Membership check failed.");
  let offset = 0;
  for (;;) {
    const result = await client.from("wishlist_images").select("id,storage_path").like("storage_path", `${owner}/%`).order("id").range(offset, offset + 49);
    if (result.error) throw new Error("Photo metadata unavailable.");
    if (!result.data.length) break;
    for (const photo of result.data) {
      if (apply) {
        const original = await client.storage.from("wishlist-images").download(photo.storage_path);
        if (original.error || !original.data || original.data.size > 5 * 1024 * 1024) throw new Error("Original unavailable.");
        const source = Buffer.from(await original.data.arrayBuffer());
        for (const width of [320,640,960]) {
          const bytes = await sharp(source, { limitInputPixels: 52_000_000 }).rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          const result = await client.storage.from("wishlist-thumbnails").upload(`${photo.storage_path}/${width}.webp`, bytes, { contentType: "image/webp", upsert: false });
          if (result.error && !/already exists|duplicate/i.test(result.error.message)) throw new Error("Variant upload failed; verify migration.");
        }
      }
      count++;
    }
    offset += result.data.length;
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", photos: count }));
} catch {
  console.error("Backfill stopped. Check configuration, migration, and account access; rerunning is safe."); process.exitCode = 1;
} finally { await client.auth.signOut({ scope: "local" }); }

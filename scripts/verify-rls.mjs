// Opt-in integration test. Use a disposable Supabase test project, never production.
// Run with Node's --env-file option; no secrets are printed or stored in reports.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const names = ["A", "B", "NONMEMBER"];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials = names.map((name) => ({
  email: process.env[`E2E_MEMBER_${name}_EMAIL`],
  password: process.env[`E2E_MEMBER_${name}_PASSWORD`],
}));
if (!url || !key || credentials.some(({ email, password }) => !email || !password)) {
  console.error("Not run: supply the two public Supabase variables and E2E_MEMBER_{A,B,NONMEMBER}_{EMAIL,PASSWORD} in a private test environment file.");
  process.exit(1);
}
const clients = names.map(() => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
const wishIds = [randomUUID(), randomUUID()];
const imageIds = [randomUUID(), randomUUID()];
const userIds = [];
const ok = (result, label) => { assert.equal(result.error, null, `${label} failed`); return result.data; };
const denied = (result, label) => assert.ok(result.error || result.data?.length === 0, `${label} unexpectedly permitted`);

try {
  for (let i = 0; i < clients.length; i++) {
    const data = ok(await clients[i].auth.signInWithPassword(credentials[i]), `Sign in ${names[i]}`);
    userIds.push(data.user.id);
  }
  assert.equal(new Set(userIds).size, 3, "Tests require three distinct accounts");
  for (let i = 0; i < 2; i++) {
    const client = clients[i];
    const other = clients[1 - i];
    const membership = ok(await client.from("app_members").select("user_id,slot"), "Read membership");
    assert.deepEqual(membership, [{ user_id: userIds[i], slot: names[i] }]);
    denied(await client.from("app_members").insert({ user_id: userIds[2], slot: "C" }).select(), "Membership insert");
    denied(await client.from("app_members").update({ slot: names[1 - i] }).eq("user_id", userIds[i]).select(), "Membership update");
    denied(await client.from("app_members").delete().eq("user_id", userIds[i]).select(), "Membership delete");
    const profiles = ok(await client.from("profiles").select("id,nickname"), "Read pair profiles");
    assert.equal(profiles.length, 2, "Provision both profiles first");
    const own = profiles.find((p) => p.id === userIds[i]);
    assert.equal(ok(await client.from("profiles").update({ nickname: own.nickname }).eq("id", own.id).select("id"), "Update own profile").length, 1);
    denied(await other.from("profiles").update({ nickname: own.nickname }).eq("id", own.id).select(), "Update partner profile");
    ok(await client.from("wishlist_items").insert({ id: wishIds[i], owner_id: userIds[i], title: "RLS verification fixture", currency: "USD" }), "Insert own wish");
    ok(await client.from("wishlist_images").insert({ id: imageIds[i], wish_id: wishIds[i], storage_path: `verification/${imageIds[i]}.png`, sort_order: 0 }), "Insert own image metadata");
    assert.equal(ok(await other.from("wishlist_items").select("id").eq("id", wishIds[i]), "Read partner wish").length, 1);
    assert.equal(ok(await other.from("wishlist_images").select("id").eq("id", imageIds[i]), "Read partner image metadata").length, 1);
    denied(await other.from("wishlist_items").insert({ owner_id: userIds[i], title: "Forbidden" }).select(), "Create partner wish");
    denied(await other.from("wishlist_items").update({ title: "Forbidden" }).eq("id", wishIds[i]).select(), "Update partner wish");
    denied(await other.from("wishlist_items").delete().eq("id", wishIds[i]).select(), "Delete partner wish");
    denied(await other.from("wishlist_images").insert({ wish_id: wishIds[i], storage_path: "forbidden.png", sort_order: 1 }).select(), "Insert partner image");
    denied(await other.from("wishlist_images").update({ storage_path: "forbidden.png" }).eq("id", imageIds[i]).select(), "Update partner image");
    denied(await other.from("wishlist_images").delete().eq("id", imageIds[i]).select(), "Delete partner image");
    denied(await client.from("wishlist_items").update({ owner_id: userIds[1 - i] }).eq("id", wishIds[i]).select(), "Transfer wish ownership");
    assert.equal(ok(await client.from("wishlist_items").update({ title: "Own update permitted" }).eq("id", wishIds[i]).select("id"), "Update own wish").length, 1);
    assert.equal(ok(await client.from("wishlist_images").update({ sort_order: 1 }).eq("id", imageIds[i]).select("id"), "Update own image").length, 1);
  }
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  for (const client of [clients[2], anonymous]) {
    for (const table of ["app_members", "profiles", "wishlist_items", "wishlist_images"]) {
      denied(await client.from(table).select("*"), `Nonmember/anonymous read ${table}`);
    }
    denied(await client.from("wishlist_items").insert({ owner_id: userIds[0], title: "Forbidden" }).select(), "Unauthorized wish insert");
    denied(await client.from("wishlist_items").update({ title: "Forbidden" }).eq("id", wishIds[0]).select(), "Unauthorized wish update");
    denied(await client.from("wishlist_items").delete().eq("id", wishIds[0]).select(), "Unauthorized wish delete");
    denied(await client.from("profiles").update({ nickname: "Forbidden" }).eq("id", userIds[0]).select(), "Unauthorized profile update");
    denied(await client.from("wishlist_images").insert({ wish_id: wishIds[0], storage_path: "forbidden.png", sort_order: 2 }).select(), "Unauthorized image insert");
    denied(await client.from("wishlist_images").update({ storage_path: "forbidden.png" }).eq("id", imageIds[0]).select(), "Unauthorized image update");
    denied(await client.from("wishlist_images").delete().eq("id", imageIds[0]).select(), "Unauthorized image delete");
    denied(await client.from("app_members").insert({ user_id: userIds[2], slot: "A" }).select(), "Unauthorized membership insert");
  }
  for (let i = 0; i < 2; i++) {
    assert.equal(ok(await clients[i].from("wishlist_images").delete().eq("id", imageIds[i]).select("id"), "Delete own image").length, 1);
    assert.equal(ok(await clients[i].from("wishlist_items").delete().eq("id", wishIds[i]).select("id"), "Delete own wish").length, 1);
  }
  console.log("Passed: A/B ownership, pair reads, membership immutability, profile/image policies, and nonmember/anonymous denial.");
} catch (error) {
  // Assertion labels only: never dump Supabase errors, session objects, or credentials.
  console.error("RLS verification failed:", error instanceof assert.AssertionError ? error.message.split("\n")[0] : "Review test-project provisioning.");
  process.exitCode = 1;
} finally {
  for (let i = 0; i < 2; i++) {
    const cleanup = await clients[i].from("wishlist_items").delete().eq("id", wishIds[i]);
    if (cleanup.error) { console.error(`Fixture cleanup for ${names[i]} failed; inspect the test database.`); process.exitCode = 1; }
  }
  await Promise.all(clients.map((client) => client.auth.signOut({ scope: "local" })));
}

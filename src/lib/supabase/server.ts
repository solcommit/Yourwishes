import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  // Auth initialization reads time before the SDK consumes its cookies. Keep
  // that third-party work out of Cache Components' speculative prerendering.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: "no-store",
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    }) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Proxy refreshes them before rendering.
        }
      },
    },
  });
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = getSupabaseConfig();
  const isSignIn = request.nextUrl.pathname === "/sign-in";

  function redirectToSignIn() {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const denied = NextResponse.json({ error: "Please sign in again." }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
      denied.headers.set("Cache-Control", "private, no-store");
      return denied;
    }
    const destination = new URL("/sign-in", request.url);
    const redirected = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    redirected.headers.set("Cache-Control", "private, no-store");
    redirected.headers.set("Pragma", "no-cache");
    redirected.headers.set("Expires", "0");
    return redirected;
  }

  if (!config) return isSignIn ? response : redirectToSignIn();
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: "no-store",
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    }) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        const previousCookies = response.cookies.getAll();
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Verify the signature (cached JWKS for asymmetric keys) and refresh cookies.
  // The DAL still calls getUser + live membership before every private data read.
  // Never authorize from getSession() or trust an incoming identity header.
  const { data, error } = await supabase.auth.getClaims();
  if (isSignIn) return response;
  if (error || !data?.claims.sub) return redirectToSignIn();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|generated/heic-worker\\.js|licenses/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

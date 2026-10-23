"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { clearPrivateThumbnails } from "@/lib/wishlist/thumbnail";

export type AuthState = { error: string };

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  if (!getSupabaseConfig()) return { error: "Sign in is not configured yet." };
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || email.length > 254 || password.length > 1024) {
    return { error: "Enter your email and password." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: "Unable to sign in. Check your details and try again." };
  const { data: { user }, error: verificationError } = await supabase.auth.getUser();
  const membership = user && !verificationError
    ? await supabase.from("app_members").select("slot").eq("user_id", user.id).maybeSingle()
    : null;
  if (!membership || membership.error || !membership.data || !["A", "B"].includes(membership.data.slot)) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This account does not have access. Contact the app administrator." };
  }
  redirect("/");
}

export async function signOut(): Promise<AuthState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) clearPrivateThumbnails(user.id);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: "Could not sign out. Please try again." };
  redirect("/sign-in");
}

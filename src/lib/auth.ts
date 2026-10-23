import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

// React cache deduplicates within a render request, never across users/requests.
export const getMember = cache(async () => {
  if (!getSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: member, error: membershipError } = await supabase
    .from("app_members").select("user_id, slot").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error("Account access could not be verified. Please try again later.");
  return member && (member.slot === "A" || member.slot === "B")
    ? { userId: user.id, slot: member.slot as "A" | "B" }
    : null;
});

export async function requireMember() {
  const member = await getMember();
  if (!member) redirect("/sign-in");
  return member;
}

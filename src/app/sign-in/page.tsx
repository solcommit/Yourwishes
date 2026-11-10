import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { getMember } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";

async function SignInContent() {
  // A migration/configuration outage must not prevent the sign-in form rendering.
  let member = null;
  try { member = await getMember(); } catch { /* The form reports failed access checks. */ }
  if (member) redirect("/");
  return <SignInForm configured={Boolean(getSupabaseConfig())} />;
}

export default function SignInPage() {
  return <Suspense fallback={null}><SignInContent /></Suspense>;
}

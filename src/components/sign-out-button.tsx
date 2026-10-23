"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";

export function SignOutButton() {
  const [state, action, pending] = useActionState(signOut, { error: "" });
  return (
    <form action={action} onSubmit={() => {
      window.dispatchEvent(new Event("yourwishes-session-ending"));
      try { localStorage.setItem("yourwishes-session-ended", String(Date.now())); } catch { /* Storage may be unavailable. */ }
    }}>
      <button className="profile-menu-action w-full" disabled={pending} type="submit"><LogOut aria-hidden="true" className="size-4" /><span>{pending ? "Signing out…" : "Sign Out"}</span></button>
      {state.error && <p className="form-error px-3 pb-3" role="alert">{state.error}</p>}
    </form>
  );
}

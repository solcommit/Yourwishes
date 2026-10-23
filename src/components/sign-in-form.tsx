"use client";

import { useActionState } from "react";
import { Heart } from "lucide-react";
import { signIn } from "@/app/sign-in/actions";

export function SignInForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <main className="app-frame grid min-h-dvh place-items-center px-6 py-12">
      <section aria-labelledby="sign-in-heading" className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-lg sm:p-9">
        <Heart aria-hidden="true" className="mb-6 size-7 text-[var(--muted)]" strokeWidth={1.5} />
        <h1 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Yourwishes</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">A little space for the two of you.</p>
        <form action={action} className="mt-8 grid gap-5">
          <label className="field-label">Email
            <input autoComplete="username" className="field-input" maxLength={254} name="email" required type="email" />
          </label>
          <label className="field-label">Password
            <input autoComplete="current-password" className="field-input" maxLength={1024} name="password" required type="password" />
          </label>
          {(!configured || state.error) && <p className="form-error" role="alert">{configured ? state.error : "Sign in is not configured yet."}</p>}
          <button className="app-button app-button-primary w-full" disabled={!configured || pending} type="submit">{pending ? "Signing in…" : "Sign In"}</button>
        </form>
        <p className="mt-6 text-xs text-[var(--muted)]">For your two private accounts only.</p>
      </section>
    </main>
  );
}

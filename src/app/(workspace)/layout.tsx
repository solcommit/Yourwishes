import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireMember } from "@/lib/auth";

async function PrivateWorkspace({ children }: { children: ReactNode }) {
  const member = await requireMember();
  return <AppShell key={member.userId} userId={member.userId}>{children}</AppShell>;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" className="p-8 text-[var(--muted)]">Loading…</div>}><PrivateWorkspace>{children}</PrivateWorkspace></Suspense>;
}

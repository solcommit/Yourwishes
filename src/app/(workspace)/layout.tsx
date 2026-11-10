import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireMember } from "@/lib/auth";

async function PrivateWorkspace({ children }: { children: ReactNode }) {
  const member = await requireMember();
  return <AppShell key={member.userId} userId={member.userId}>{children}</AppShell>;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><PrivateWorkspace>{children}</PrivateWorkspace></Suspense>;
}

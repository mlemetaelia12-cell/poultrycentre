import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { enforcePageAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get("x-pc-pathname") ?? "/dashboard";
  const user = await enforcePageAccess(path);
  return <AppShell user={user}>{children}</AppShell>;
}

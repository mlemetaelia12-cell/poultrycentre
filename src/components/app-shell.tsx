import { Bell } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { Mark } from "./logo";
import { getLocale, t } from "@/i18n/messages";
import { FloatingAI } from "@/components/ai/floating-ai";

export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const locale = await getLocale();
  const dashboardOnly = user.accessMode === "dashboard";
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <Sidebar role={user.role} displayName={user.displayName} dashboardOnly={dashboardOnly} />
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3"><div className="lg:hidden"><Mark compact /></div><div><p className="text-sm font-bold text-slate-800">POULTRY CENTRE</p><p className="text-[11px] text-slate-500">{dashboardOnly ? t(locale, "mobileReadOnly") : "Business management workspace"}</p></div></div>
          <div className="flex items-center gap-3"><Link href="/notifications" className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell size={18} /></Link><span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-slate-800">{user.displayName}</span><span className="block text-[10px] capitalize text-slate-500">{user.role.replaceAll("_", " ")}</span></span></div>
        </header>
        {dashboardOnly && <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:mx-7"><strong>{t(locale, "mobileReadOnly")}.</strong> {t(locale, "desktopRequired")} No editing or recording is available in this session.</div>}
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
        <footer className="px-7 pb-6 text-center text-[11px] text-slate-400 lg:hidden">Built by Brell · POULTRY CENTRE</footer>
        <FloatingAI locale={locale} />
      </div>
    </div>
  );
}

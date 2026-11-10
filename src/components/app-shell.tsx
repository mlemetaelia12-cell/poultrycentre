import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { Mark } from "./logo";
import { getLocale, t } from "@/i18n/server";
import { setLanguageAction } from "@/lib/actions";

export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const locale = await getLocale();
  const dashboardOnly = user.accessMode === "dashboard";
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <Sidebar role={user.role} displayName={user.displayName} dashboardOnly={dashboardOnly} />
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><div className="lg:hidden"><Mark compact /></div><div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-wide text-slate-800">POULTRY CENTRE</p><p className="truncate text-[11px] text-slate-500">{dashboardOnly ? t(locale, "mobileReadOnly") : t(locale, "workspace")}</p></div></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <form action={setLanguageAction} aria-label={t(locale, "language") } className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button name="language" value="en" aria-pressed={locale === "en"} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${locale === "en" ? "bg-forest-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>EN</button>
              <button name="language" value="sw" aria-pressed={locale === "sw"} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${locale === "sw" ? "bg-forest-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>SW</button>
            </form>
            <span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-slate-800">{user.displayName}</span><span className="block text-[10px] capitalize text-slate-500">{user.role.replaceAll("_", " ")}</span></span>
          </div>
        </header>
        {dashboardOnly && <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:mx-7"><strong>{t(locale, "mobileReadOnly")}.</strong> {t(locale, "desktopRequired")}</div>}
        <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-7 sm:py-7">{children}</main>
        <footer className="px-7 pb-6 text-center text-[11px] text-slate-400">POULTRY CENTRE · Built by Brell</footer>
      </div>
    </div>
  );
}

import { AlertTriangle, Coins, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { getLocale, t } from "@/i18n/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, locale] = await Promise.all([getDashboardData(user.role, user.id), getLocale()]);
  const isOwnerOrManager = data.showFinancials;
  const today = new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { dateStyle: "full", timeZone: "Africa/Dar_es_Salaam" }).format(new Date());
  return <>
    <PageHeader title={t(locale, "overview")} description={t(locale, "welcome")} action={<span className="rounded-full bg-forest-50 px-3 py-1.5 text-[11px] font-semibold text-forest-700">{today}</span>} />
    
<div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
  {data.showSales && (
    <StatCard
      label={t(locale, "todaySales")}
      value={money(data.todaySales)}
      icon={<ReceiptText size={18} />}
    />
  )}

  {isOwnerOrManager && (
    <StatCard
      label={locale === "sw" ? "Faida ya Leo" : "Today's Profit"}
      value={money(data.todayProfit)}
      icon={<Coins size={18} />}
      accent="green"
    />
  )}

  {isOwnerOrManager && (
    <StatCard
      label={t(locale, "todayExpenses")}
      value={money(data.todayExpenses)}
      icon={<Wallet size={18} />}
      accent="amber"
    />
  )}

  {isOwnerOrManager && (
    <StatCard
      label={t(locale, "outstandingDebts")}
      value={money(data.debts)}
      icon={<Coins size={18} />}
      accent="amber"
    />
  )}

  <StatCard
    label={t(locale, "lowStock")}
    value={String(data.lowStockProducts.length)}
    icon={<AlertTriangle size={18} />}
    accent={data.lowStockProducts.length ? "amber" : "green"}
  />
</div>

    {isOwnerOrManager && <section className="card mt-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">{locale === "sw" ? "Vitendo vya haraka" : "Quick actions"}</h2><p className="section-subtitle">{locale === "sw" ? "Njia za kufika kwenye kazi muhimu." : "Go straight to the tasks you use most."}</p></div>
        {!user.accessMode || user.accessMode === "full" ? <div className="flex flex-wrap gap-2"><Link href="/sales" className="inline-flex min-h-10 items-center rounded-xl bg-forest-700 px-4 text-xs font-bold text-white">{locale === "sw" ? "Anza kuuza" : "Start selling"}</Link><Link href="/sales/history" className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700">{locale === "sw" ? "Historia ya mauzo" : "Sales history"}</Link><Link href="/expenses" className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700">{locale === "sw" ? "Rekodi matumizi" : "Record expense"}</Link></div> : null}
      </div>
    </section>}
    <section className="card mt-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 className="section-title">{locale === "sw" ? "Bidhaa zinazokaribia kuisha" : "Products running low"}</h2><p className="section-subtitle">{locale === "sw" ? "Kagua stoo kabla bidhaa hazijaisha." : "Check stock before products run out."}</p></div><Link href="/products" className="text-xs font-bold text-forest-700">{locale === "sw" ? "Bidhaa" : "Products"} →</Link></div>
      {data.lowStockProducts.length ? <div className="divide-y divide-slate-100">{data.lowStockProducts.slice(0, 8).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{product.name}</p><p className="text-[11px] text-slate-500">{product.sku}</p></div><div className="shrink-0 text-right"><p className="text-sm font-extrabold text-amber-700">{product.stock}</p><p className="text-[10px] text-slate-400">{locale === "sw" ? "Zilizopo" : "On hand"}</p></div></div>)}</div> : <p className="px-4 py-10 text-center text-sm text-slate-500">{locale === "sw" ? "Hakuna bidhaa zinazokaribia kuisha." : "No products are running low."}</p>}
    </section>
  </>;
}

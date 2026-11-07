import { Bell, Boxes, CalendarClock, Coins, Package, ShoppingBag, TrendingUp, Wallet, AlertTriangle, Activity } from "lucide-react";
import { getDashboardData } from "@/lib/dashboard-data";
import { requireUser } from "@/lib/auth";
import { money, number, dateOnly, dateTime } from "@/lib/format";
import { getLocale, t } from "@/i18n/messages";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { SalesChart } from "@/components/sales-chart";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, locale] = await Promise.all([getDashboardData(user.role, user.id), getLocale()]);
  const ownerOrManager = data.showFinancials;
  return <>
    <PageHeader title={t(locale, "overview")} description={t(locale, "welcome")} action={<span className="rounded-full bg-forest-50 px-3 py-1.5 text-[11px] font-semibold text-forest-700">{new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { dateStyle: "full", timeZone: "Africa/Dar_es_Salaam" }).format(new Date())}</span>} />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
      {data.showSales && <StatCard label={t(locale, "todaySales")} value={money(data.todaySales)} icon={<ShoppingBag size={18} />} />}
      {ownerOrManager && <StatCard label={t(locale, "todayProfit")} value={money(data.todayProfit)} icon={<TrendingUp size={18} />} />}
      {data.showSales && <StatCard label={t(locale, "monthSales")} value={money(data.monthSales)} icon={<Coins size={18} />} />}
      {ownerOrManager && <StatCard label={t(locale, "monthProfit")} value={money(data.monthNetProfit)} icon={<Wallet size={18} />} accent={data.monthNetProfit < 0 ? "red" : "green"} note="Gross profit less recorded operating expenses" />}
      {ownerOrManager && <StatCard label={t(locale, "expensesMonth")} value={money(data.monthExpenses)} icon={<Wallet size={18} />} accent="amber" />}
      {ownerOrManager && <StatCard label={t(locale, "outstandingDebts")} value={money(data.debts)} icon={<Coins size={18} />} accent="amber" />}
      {ownerOrManager && <StatCard label={t(locale, "stockValue")} value={money(data.stockValue)} icon={<Boxes size={18} />} />}
      <StatCard label={t(locale, "lowStock")} value={String(data.lowStockProducts.length)} icon={<AlertTriangle size={18} />} accent={data.lowStockProducts.length ? "amber" : "green"} />
    </div>
    {ownerOrManager && <div className="mt-5 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="section-title">Sales & profit trend</h2><p className="section-subtitle">Last 7 days · TZS</p></div><TrendingUp className="text-forest-600" size={19} /></div><SalesChart data={data.chart} /><div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-forest-600" />Sales</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Gross profit</span></div></section>
      <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="section-title">{t(locale, "importantNotices")}</h2><p className="section-subtitle">Dashboard alerts requiring attention</p></div><Bell size={18} className="text-forest-600" /></div>
        <div className="space-y-3">{data.notices.length ? data.notices.slice(0, 5).map((notice) => <div key={notice.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{notice.title}</p><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{notice.message}</p><p className="mt-1 text-[10px] text-slate-400">{dateTime(notice.createdAt)}</p></div>) : <p className="py-8 text-center text-sm text-slate-400">No unread alerts.</p>}</div>
        <Link href="/notifications" className="mt-3 inline-block text-xs font-semibold text-forest-700">View all notifications →</Link>
      </section>
    </div>}
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <section className="card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">{t(locale, "lowStock")}</h2><p className="section-subtitle">Products at or below their reorder level</p></div><Package size={18} className="text-amber-600" /></div>
        <DataTable headers={["Product", "SKU", "On hand", "Reorder at"]} rows={data.lowStockProducts.map((row) => [<span key={`${row.id}-name`} className="font-semibold">{row.name}</span>, row.sku, <span key={`${row.id}-stock`} className="font-bold text-amber-700">{number(row.stock, 3)}</span>, number(row.reorder, 3)])} />
        <Link href="/inventory" className="mt-3 inline-block text-xs font-semibold text-forest-700">Open inventory →</Link>
      </section>
      <section className="card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">{t(locale, "expiry")}</h2><p className="section-subtitle">Batches expiring within the next 90 days</p></div><CalendarClock size={18} className="text-amber-600" /></div>
        <DataTable headers={["Product", "Batch", "Expiry", "Qty"]} rows={data.expiryBatches.map((row) => [row.productName, row.batchNumber, <span key={`${row.id}-expiry`} className="font-semibold text-amber-700">{dateOnly(row.expiryDate)}</span>, number(row.quantity, 3)])} />
        <div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">Expired batches: <strong className="text-red-600">{data.expiredBatches.length}</strong></span><Link href="/inventory" className="text-xs font-semibold text-forest-700">Manage batches →</Link></div>
      </section>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {ownerOrManager && <section className="card p-4 sm:p-5"><h2 className="section-title">{t(locale, "bestSellers")}</h2><p className="section-subtitle">By quantity sold this month</p><div className="mt-4"><DataTable headers={["Product", "Qty sold", "Sales value"]} rows={data.bestSellers.map((row) => [row.name, number(row.quantity, 3), money(row.revenue)])} /></div></section>}
      {ownerOrManager && <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="section-title">Overdue customer balances</h2><p className="section-subtitle">Credit invoices past their recorded due date</p></div><Link href="/debts" className="text-xs font-semibold text-forest-700">View debts →</Link></div><DataTable headers={["Receipt", "Customer", "Due date", "Balance"]} rows={data.overdueDebts.map((row) => [row.receipt, row.customer, <span key={`${row.receipt}-date`} className="font-semibold text-red-700">{row.dueDate}</span>, <span key={`${row.receipt}-balance`} className="font-bold text-red-700">{money(row.balance)}</span>])} /></section>}
      <section className="card p-4 sm:p-5"><h2 className="section-title">{t(locale, "recentActivity")}</h2><p className="section-subtitle">Latest recorded business actions</p><div className="mt-4 space-y-3">{data.activity.length ? data.activity.slice(0, 6).map((row, i) => <div key={`${row.action}-${i}`} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0"><span className="mt-0.5 rounded-lg bg-forest-50 p-2 text-forest-700"><Activity size={15} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{row.action.replaceAll(".", " ").replaceAll("_", " ")}</p><p className="mt-0.5 text-[11px] text-slate-500">{row.actor ?? "System"} · {row.entityType}</p></div><span className="whitespace-nowrap text-[10px] text-slate-400">{dateTime(row.createdAt)}</span></div>) : <p className="py-8 text-center text-sm text-slate-400">No activity recorded.</p>}</div></section>
    </div>
    {data.expiredBatches.length > 0 && <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-bold text-red-800">Expired stock requires attention</p><p className="mt-1 text-xs leading-5 text-red-700">There are {data.expiredBatches.length} expired batch records on this dashboard. These batches are blocked from POS sales; inspect and record them as expired stock.</p></section>}
  </>;
}

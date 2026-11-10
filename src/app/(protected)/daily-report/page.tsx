import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, payments, products, saleItems, sales, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getLocale, t } from "@/i18n/server";
import { money, todayDateTz, dateTime } from "@/lib/format";
import { PrintReportButton } from "@/components/print-report-button";

const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()));
const startOfDay = (value: string) => new Date(`${value}T00:00:00+03:00`);

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePermission("reports:read");
  const locale = await getLocale();
  const params = await searchParams;
  const day = validDate(params.date) ? params.date! : todayDateTz();
  const start = startOfDay(day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const db = getDb();
  const rows = await db.select({ sale: sales, customer: customers.name, cashier: users.displayName })
    .from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id))
    .where(and(gte(sales.createdAt, start), lt(sales.createdAt, end))).orderBy(asc(sales.createdAt));
  const ids = rows.map((row) => row.sale.id);
  const [items, paymentRows] = ids.length ? await Promise.all([
    db.select({ saleId: saleItems.saleId, name: products.name, sku: products.sku, quantity: saleItems.quantity, unitName: saleItems.unitName, unitPrice: saleItems.unitPrice, lineTotal: saleItems.lineTotal, discount: saleItems.discountAmount })
      .from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(inArray(saleItems.saleId, ids)).orderBy(asc(products.name)),
    db.select({ method: payments.method, amount: sql<string>`SUM(${payments.amount})` }).from(payments)
      .where(and(inArray(payments.saleId, ids), eq(payments.paymentType, "sale"))).groupBy(payments.method),
  ]) : [[], []];
  const itemsBySale = new Map<string, typeof items>();
  for (const item of items) itemsBySale.set(item.saleId, [...(itemsBySale.get(item.saleId) ?? []), item]);
  const validSales = rows.filter((row) => row.sale.status !== "void");
  const totalSales = validSales.reduce((sum, row) => sum + Number(row.sale.total), 0);
  const totalDiscount = validSales.reduce((sum, row) => sum + Number(row.sale.discount), 0);
  const totalPaid = validSales.reduce((sum, row) => sum + Number(row.sale.amountPaid), 0);
  const totalBalance = validSales.reduce((sum, row) => sum + Number(row.sale.balanceDue), 0);
  const fmtDate = new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { dateStyle: "full", timeZone: "Africa/Dar_es_Salaam" }).format(start);
  return <>
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold text-slate-900">{t(locale, "dailyReport")}</h1><p className="mt-1 text-sm text-slate-500">{fmtDate} · {locale === "sw" ? "Saa za Tanzania" : "Tanzania time"}</p></div><div className="flex flex-wrap gap-2"><Link href="/sales/history" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700">{locale === "sw" ? "Rudi historia" : "Back to history"}</Link><PrintReportButton label={locale === "sw" ? "Chapisha / Hifadhi PDF" : "Print / Save PDF"} /></div></div>
    <section className="daily-report print-area mx-auto max-w-[1100px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <header className="flex flex-col items-center border-b border-slate-200 pb-5 text-center"><Image src="/poultry-farm-logo.jpeg" alt="Poultry Farm logo" width={240} height={240} className="mb-2 h-auto w-[86px] object-contain" /><p className="text-lg font-black tracking-[.08em]">POULTRY CENTRE</p><h2 className="mt-2 text-base font-bold">{t(locale, "dailyReport")}</h2><p className="mt-1 text-xs text-slate-500">{fmtDate}</p></header>
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{locale === "sw" ? "Idadi ya mauzo" : "Sales count"}</p><p className="mt-1 text-lg font-extrabold">{validSales.length}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{t(locale, "total")}</p><p className="mt-1 break-words text-lg font-extrabold">{money(totalSales)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{t(locale, "discount")}</p><p className="mt-1 break-words text-lg font-extrabold">{money(totalDiscount)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{t(locale, "paid")}</p><p className="mt-1 break-words text-lg font-extrabold">{money(totalPaid)}</p></div>
      </div>
      <div className="mb-5 flex flex-wrap justify-between gap-2 border-b border-slate-200 pb-4 text-sm"><span>{t(locale, "balance")}: <strong>{money(totalBalance)}</strong></span><span>{locale === "sw" ? "Mauzo yaliyofutwa" : "Voided sales"}: <strong>{rows.length - validSales.length}</strong></span></div>
      <h3 className="mb-3 text-sm font-extrabold">{locale === "sw" ? "Orodha kamili ya mauzo" : "Complete sales list"}</h3>
      {rows.length ? <div className="space-y-4">{rows.map(({ sale, customer, cashier }) => { const saleItemsList = itemsBySale.get(sale.id) ?? []; return <article key={sale.id} className="break-inside-avoid rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-extrabold">{sale.receiptNumber}</p><p className="mt-1 text-[11px] text-slate-500">{dateTime(sale.createdAt)} · {customer ?? (locale === "sw" ? "Mteja wa kawaida" : "Walk-in")} · {cashier}</p></div><div className="text-right"><p className="text-sm font-extrabold">{money(sale.total)}</p><p className={`text-[10px] font-bold uppercase ${sale.status === "void" ? "text-red-600" : "text-emerald-700"}`}>{sale.status}</p></div></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] border-collapse text-xs"><thead><tr className="border-y border-slate-200 text-slate-500"><th className="py-2 text-left">{t(locale, "items")}</th><th className="py-2 text-right">{locale === "sw" ? "Idadi" : "Qty"}</th><th className="py-2 text-right">{locale === "sw" ? "Bei" : "Price"}</th><th className="py-2 text-right">{t(locale, "total")}</th></tr></thead><tbody>{saleItemsList.map((item, index) => <tr key={`${sale.id}-${index}`} className="border-b border-slate-100"><td className="py-2 pr-2"><span className="font-semibold">{item.name}</span><span className="ml-2 text-[10px] text-slate-400">{item.sku}</span></td><td className="py-2 text-right">{item.quantity} {item.unitName}</td><td className="py-2 text-right">{money(item.unitPrice)}</td><td className="py-2 text-right">{money(item.lineTotal)}</td></tr>)}</tbody></table></div>
        <div className="mt-3 flex flex-wrap justify-end gap-x-5 gap-y-1 text-[11px]"><span>{t(locale, "discount")}: <strong>{money(sale.discount)}</strong></span><span>{t(locale, "paid")}: <strong>{money(sale.amountPaid)}</strong></span><span>{t(locale, "balance")}: <strong>{money(sale.balanceDue)}</strong></span></div>
        {sale.notes && <p className="mt-2 text-[11px] text-slate-600">{locale === "sw" ? "Mahali / maelezo ya usafirishaji" : "Delivery / order notes"}: {sale.notes}</p>}
      </article>; })}</div> : <p className="rounded-xl bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">{t(locale, "noSalesToday")}</p>}
      <section className="mt-6 break-inside-avoid border-t border-slate-200 pt-4"><h3 className="mb-3 text-sm font-extrabold">{locale === "sw" ? "Makusanyo kwa njia ya malipo" : "Collections by payment method"}</h3><div className="grid gap-2 sm:grid-cols-2">{paymentRows.map((row) => <div key={row.method} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="capitalize">{row.method.replaceAll("_", " ")}</span><strong>{money(row.amount)}</strong></div>)}</div></section>
      <footer className="mt-7 border-t border-dashed border-slate-300 pt-3 text-center text-[10px] text-slate-500">+255 784 452 159</footer>
    </section>
    <style>{`@media print { body { background: #fff !important; } .no-print { display: none !important; } main { padding: 0 !important; max-width: none !important; } .daily-report { width: 100% !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; } @page { size: A4; margin: 12mm; } }`}</style>
  </>;
}

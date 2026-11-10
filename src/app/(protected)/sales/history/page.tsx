import Link from "next/link";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getDb } from "@/db";
import { customers, payments, products, saleItems, sales, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { dateTime, money, todayDateTz } from "@/lib/format";
import { getLocale, t } from "@/i18n/server";

const PAGE_SIZE = 25;
const isDate = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
const dayStart = (value: string) => new Date(`${value}T00:00:00+03:00`);
const nextDay = (value: string) => new Date(dayStart(value).getTime() + 24 * 60 * 60 * 1000);

export default async function SalesHistoryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; q?: string; page?: string }> }) {
  const actor = await requirePermission("sales:read");
  const locale = await getLocale();
  const params = await searchParams;
  const today = todayDateTz();
  const from = isDate(params.from) ? params.from : params.from === "" ? "" : today;
  const to = isDate(params.to) ? params.to : params.to === "" ? "" : today;
  const query = (params.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1", 10) || 1));
  const db = getDb();
  // The product subquery keeps search comprehensive without multiplying sale rows.
  function dbProductSalesQuery(search: string) {
    return db.select({ saleId: saleItems.saleId }).from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(ilike(products.name, `%${search}%`));
  }
  const filters: SQL[] = [];
  if (from) filters.push(gte(sales.createdAt, dayStart(from)));
  if (to) filters.push(lt(sales.createdAt, nextDay(to)));
  if (actor.role === "cashier") filters.push(eq(sales.createdBy, actor.id));
  if (query) filters.push(or(
    ilike(sales.receiptNumber, `%${query}%`),
    ilike(customers.name, `%${query}%`),
    ilike(users.displayName, `%${query}%`),
    inArray(sales.id, dbProductSalesQuery(query)),
  )!);
  const condition = filters.length ? and(...filters) : undefined;
  const [totalRows, rows] = await Promise.all([
    db.select({ value: count() }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id)).where(condition),
    db.select({ sale: sales, customer: customers.name, cashier: users.displayName }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id)).where(condition).orderBy(desc(sales.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
  ]);
  const total = Number(totalRows[0]?.value ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ids = rows.map((row) => row.sale.id);
  const [itemRows, paymentRows] = ids.length ? await Promise.all([
    db.select({ saleId: saleItems.saleId, name: products.name, quantity: saleItems.quantity, unitName: saleItems.unitName, unitPrice: saleItems.unitPrice, discountAmount: saleItems.discountAmount, lineTotal: saleItems.lineTotal }).from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(inArray(saleItems.saleId, ids)).orderBy(asc(products.name)),
    db.select({ saleId: payments.saleId, method: payments.method, amount: payments.amount }).from(payments).where(and(inArray(payments.saleId, ids), eq(payments.paymentType, "sale"))).orderBy(asc(payments.createdAt)),
  ]) : [[], []];
  const itemsBySale = new Map<string, Array<{ name: string; quantity: string; unitName: string; unitPrice: string; discountAmount: string; lineTotal: string }>>();
  for (const item of itemRows) itemsBySale.set(item.saleId, [...(itemsBySale.get(item.saleId) ?? []), item]);
  const methodsBySale = new Map<string, string[]>();
  for (const payment of paymentRows) if (payment.saleId) methodsBySale.set(payment.saleId, [...new Set([...(methodsBySale.get(payment.saleId) ?? []), payment.method.replaceAll("_", " ")])]);
  const paramsForPage = (targetPage: number) => {
    const values = new URLSearchParams();
    if (from) values.set("from", from);
    if (to) values.set("to", to);
    if (query) values.set("q", query);
    values.set("page", String(targetPage));
    return `/sales/history?${values.toString()}`;
  };

  return <>
    <PageHeader title={t(locale, "salesHistory")} description={t(locale, "reviewSales")} action={<div className="flex flex-wrap gap-2">{(actor.role === "owner" || actor.role === "manager") && <Link href="/daily-report" className="rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white">{t(locale, "printDailyReport")}</Link>}<Link href="/sales" className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700 hover:bg-forest-50">{t(locale, "backToPos")}</Link></div>} />
    
<form method="get" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
  <div>
    <label className="field-label" htmlFor="from">
      {t(locale, "fromDate")}
    </label>
    <input
      id="from"
      name="from"
      type="date"
      defaultValue={from}
      className="field"
    />
  </div>

  <div>
    <label className="field-label" htmlFor="to">
      {t(locale, "toDate")}
    </label>
    <input
      id="to"
      name="to"
      type="date"
      defaultValue={to}
      className="field"
    />
  </div>

  <div>
    <label className="field-label" htmlFor="q">
      {t(locale, "searchSales")}
    </label>
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
      <input
        id="q"
        name="q"
        defaultValue={query}
        className="field pl-9"
        placeholder={locale === "sw" ? "Tafuta mauzo…" : "Search sales…"}
      />
    </div>
  </div>

  <div className="flex gap-2">
    <button className="min-h-11 flex-1 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white">
      {t(locale, "applyFilters")}
    </button>
    <Link
      href="/sales/history"
      className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"
    >
      {t(locale, "today")}
    </Link>
  </div>
</form>

    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays size={17} className="text-forest-700" />{total.toLocaleString()} {locale === "sw" ? "mauzo yamepatikana" : `sale${total === 1 ? "" : "s"} found`}</div><p className="text-xs text-slate-500">{locale === "sw" ? "Ukurasa" : "Page"} {Math.min(page, pageCount)} {locale === "sw" ? "wa" : "of"} {pageCount} · {locale === "sw" ? "Saa za Tanzania" : "Tanzania time"}</p></div>
    {rows.length ? <div className="space-y-3">
      {rows.map(({ sale, customer, cashier }) => {
        const items = itemsBySale.get(sale.id) ?? [];
        return <article key={sale.id} className="card min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-all text-sm font-extrabold text-slate-800">{sale.receiptNumber}</p><span className={`badge ${sale.status === "completed" ? "badge-green" : sale.status === "void" ? "badge-red" : "badge-amber"}`}>{sale.status}</span></div><p className="mt-1 text-xs text-slate-500">{dateTime(sale.createdAt)} · {customer ?? "Walk-in customer"} · {cashier}</p></div>
            <Link href={`/receipts/${sale.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-forest-200 px-3 text-xs font-semibold text-forest-700 hover:bg-forest-50">{t(locale, "viewSaleDetails")}</Link>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t(locale, "productsSold")} ({items.length})</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <div key={`${sale.id}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><div className="min-w-0"><p className="break-words text-xs font-semibold text-slate-700">{item.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.quantity} {item.unitName} × {money(item.unitPrice)}{Number(item.discountAmount) > 0 ? ` · ${locale === "sw" ? "Punguzo" : "Discount"}: ${money(item.discountAmount)}` : ""}</p></div><span className="shrink-0 text-xs font-bold tabular-nums text-slate-800">{money(item.lineTotal)}</span></div>)}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-5"><div><p className="text-[10px] text-slate-500">{t(locale, "saleTotal")}</p><p className="mt-1 text-sm font-extrabold text-slate-800">{money(sale.total)}</p></div><div><p className="text-[10px] text-slate-500">{t(locale, "amountPaid")}</p><p className="mt-1 text-sm font-semibold text-slate-700">{money(sale.amountPaid)}</p></div><div><p className="text-[10px] text-slate-500">{t(locale, "outstanding")}</p><p className={`mt-1 text-sm font-semibold ${Number(sale.balanceDue) > 0 ? "text-amber-700" : "text-slate-700"}`}>{money(sale.balanceDue)}</p></div><div><p className="text-[10px] text-slate-500">{t(locale, "saleType")}</p><p className="mt-1 text-sm font-semibold capitalize text-slate-700">{sale.saleType}</p></div><div><p className="text-[10px] text-slate-500">{locale === "sw" ? "Njia ya malipo" : "Payment method"}</p><p className="mt-1 text-sm font-semibold capitalize text-slate-700">{methodsBySale.get(sale.id)?.join(", ") || "—"}</p></div></div>
        </article>;
      })}
    </div> : <div className="card px-4 py-14 text-center"><p className="text-sm font-semibold text-slate-700">{t(locale, "noSalesFound")}</p><p className="mt-1 text-xs text-slate-500">{t(locale, "tryDateRange")}</p></div>}
    <div className="mt-5 flex items-center justify-between gap-3"><Link aria-disabled={page <= 1} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-white"}`} href={paramsForPage(Math.max(1, page - 1))}><ChevronLeft size={15} />{t(locale, "previous")}</Link><Link aria-disabled={page >= pageCount} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${page >= pageCount ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-white"}`} href={paramsForPage(Math.min(pageCount, page + 1))}>{t(locale, "next")}<ChevronRight size={15} /></Link></div>
  </>;
}

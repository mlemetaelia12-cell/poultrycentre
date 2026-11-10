import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { customers, products, sales, unitConversions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { PosForm } from "@/components/pos-form";
import { dateTime, money } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";

export default async function SalesPage() {
  const db = getDb();
  const actor = await requireUser();
  const locale = await getLocale();
  const [productRows, conversionRows, customerRows, saleRows] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(products.name),
    db.select().from(unitConversions),
    db.select({ id: customers.id, name: customers.name, phone: customers.phone, creditLimit: customers.creditLimit }).from(customers).where(eq(customers.active, true)).orderBy(customers.name),
    db.select({ sale: sales, customer: customers.name }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).where(actor.role === "cashier" ? eq(sales.createdBy, actor.id) : undefined).orderBy(desc(sales.createdAt)).limit(5),
  ]);
  const productsForPos = productRows.map((product) => ({
    id: product.id, sku: product.sku, barcode: product.barcode, name: product.name, baseUnit: product.baseUnit, retailPrice: product.retailPrice,
    wholesalePrice: product.wholesalePrice, minimumPrice: product.minimumPrice,
    units: conversionRows.filter((row) => row.productId === product.id).map((row) => ({ unitName: row.unitName, barcode: row.barcode, baseQuantity: row.baseQuantity, retailPrice: row.retailPrice, wholesalePrice: row.wholesalePrice })),
  }));
  const sw = locale === "sw";
  return <>
    <PageHeader title={sw ? "Uza bidhaa" : "Sell products"} description={sw ? "Ongeza bidhaa zote za mteja, weka punguzo na kamilisha malipo." : "Add every item in the customer's order, apply an approved discount and complete payment."} action={<div className="flex flex-wrap gap-2"><Link href="/sales/history" className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700">{sw ? "Historia ya mauzo" : "Sales history"}</Link>{(actor.role === "owner" || actor.role === "manager") && <Link href="/daily-report" className="rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white">{sw ? "Ripoti ya siku PDF" : "Daily PDF report"}</Link>}</div>} />
    <PosForm products={productsForPos} customers={customerRows} locale={locale} />
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="section-title">{sw ? "Mauzo ya karibuni" : "Recent sales"}</h2><Link href="/sales/history" className="text-xs font-bold text-forest-700">{sw ? "Angalia yote" : "View all"} →</Link></div>
      {saleRows.length ? <div className="card divide-y divide-slate-100">{saleRows.map(({ sale, customer }) => <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="break-all text-sm font-extrabold text-slate-800">{sale.receiptNumber}</p><p className="mt-1 text-[11px] text-slate-500">{dateTime(sale.createdAt)} · {customer ?? (sw ? "Mteja wa kawaida" : "Walk-in customer")}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-sm font-extrabold text-slate-800">{money(sale.total)}</p><p className="text-[10px] text-slate-500">{sw ? "Jumla" : "Total"}</p></div><Link href={`/receipts/${sale.id}`} className="rounded-lg border border-forest-200 px-3 py-2 text-xs font-bold text-forest-700">{sw ? "Risiti" : "Receipt"}</Link></div></div>)}</div> : <p className="card px-4 py-10 text-center text-sm text-slate-500">{sw ? "Hakuna mauzo bado." : "No sales recorded yet."}</p>}
    </section>
  </>;
}

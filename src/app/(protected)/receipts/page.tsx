import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { getDb } from "@/db";
import { customers, sales, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { dateTime, money } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export default async function ReceiptsPage() {
  const actor = await requireUser();
  const rows = await getDb().select({ sale: sales, customer: customers.name, cashier: users.displayName }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id)).where(actor.role === "cashier" ? eq(sales.createdBy, actor.id) : undefined).orderBy(desc(sales.createdAt)).limit(200);
  return <>
    <PageHeader title="Receipts & printing" description="Open a receipt to print on an 80mm thermal printer or A4 page, or choose Save as PDF from the browser print dialog." />
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">POULTRY CENTRE receipts are internal business receipts, not TRA EFD/VFD fiscal receipts. A printer is not required to preview or save a receipt as PDF.</div>
    <div className="mb-3 flex items-center gap-2"><FileText size={18} className="text-forest-700" /><h2 className="section-title">Receipt register</h2></div>
    <DataTable headers={["Receipt", "Date", "Customer", "Cashier", "Total", "Paid", "Balance", "Status", ""]} rows={rows.map(({ sale, customer, cashier }) => [<span key={`${sale.id}-receipt`} className="font-semibold">{sale.receiptNumber}</span>, dateTime(sale.createdAt), customer ?? "Walk-in", cashier, money(sale.total), money(sale.amountPaid), money(sale.balanceDue), <span key={`${sale.id}-status`} className={`badge ${sale.status === "void" ? "badge-red" : sale.balanceDue === "0.00" ? "badge-green" : "badge-amber"}`}>{sale.status}</span>, <Link key={`${sale.id}-link`} href={`/receipts/${sale.id}`} className="font-semibold text-forest-700">Open receipt</Link>])} />
  </>;
}

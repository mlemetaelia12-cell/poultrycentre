import { desc, eq, sql } from "drizzle-orm";
import { UserRoundPlus, Users } from "lucide-react";
import { getDb } from "@/db";
import { customers, debtTransactions, sales } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { createCustomerAction } from "@/lib/actions";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { dateTime, money } from "@/lib/format";

export default async function CustomersPage() {
  const db = getDb();
  const [customerRows, debtRows, saleRows] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)).limit(300),
    db.select({ customerId: debtTransactions.customerId, balance: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(debtTransactions).groupBy(debtTransactions.customerId),
    db.select({ customerId: sales.customerId, count: sql<number>`COUNT(*)` }).from(sales).where(sql`${sales.status} <> 'void'`).groupBy(sales.customerId),
  ]);
  const debtMap = new Map(debtRows.map((row) => [row.customerId, Number(row.balance)]));
  const saleMap = new Map(saleRows.filter((r) => r.customerId).map((row) => [row.customerId as string, Number(row.count)]));
  return <>
    <PageHeader title="Customers" description="Keep contact records, retail/wholesale types, credit limits, balances and customer purchase history." />
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><UserRoundPlus className="text-forest-700" size={19} /><h2 className="section-title">Add customer</h2></div><ActionForm action={createCustomerAction} submitLabel="Add customer" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div><label className="field-label">Customer name *</label><input name="name" required className="field" /></div><div><label className="field-label">Phone</label><input name="phone" className="field" /></div><div><label className="field-label">Location</label><input name="location" className="field" /></div><div><label className="field-label">Customer type</label><select name="customerType" className="field"><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select></div><div><label className="field-label">Credit limit (TZS)</label><input name="creditLimit" type="number" min="0" step="0.01" defaultValue="0" className="field" /><p className="field-help">A zero credit limit disables credit sales.</p></div><div><label className="field-label">Notes</label><input name="notes" className="field" /></div></ActionForm></section>
    <div className="mb-3 flex items-center gap-2"><Users size={18} className="text-forest-700" /><h2 className="section-title">Customer records ({customerRows.length})</h2></div>
    <DataTable headers={["Customer", "Phone", "Location", "Type", "Credit limit", "Outstanding", "Sales", "Status", "Created"]} rows={customerRows.map((customer) => [<span className="font-semibold">{customer.name}</span>, customer.phone ?? "—", customer.location ?? "—", customer.customerType, money(customer.creditLimit), <span className={debtMap.get(customer.id) ? "font-semibold text-amber-700" : ""}>{money(debtMap.get(customer.id) ?? 0)}</span>, saleMap.get(customer.id) ?? 0, <span className={`badge ${customer.active ? "badge-green" : "badge-gray"}`}>{customer.active ? "Active" : "Inactive"}</span>, dateTime(customer.createdAt)])} />
  </>;
}

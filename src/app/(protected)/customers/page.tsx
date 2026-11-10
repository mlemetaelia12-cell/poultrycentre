import { desc, sql } from "drizzle-orm";
import { UserRoundPlus, Users } from "lucide-react";
import { getDb } from "@/db";
import { customers, debtTransactions, sales } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { createCustomerAction } from "@/lib/actions";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { dateTime, money } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export default async function CustomersPage() {
  const db = getDb();
  const locale = await getLocale();
  const sw = locale === "sw";
  const [customerRows, debtRows, saleRows] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)).limit(300),
    db.select({ customerId: debtTransactions.customerId, balance: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(debtTransactions).groupBy(debtTransactions.customerId),
    db.select({ customerId: sales.customerId, count: sql<number>`COUNT(*)` }).from(sales).where(sql`${sales.status} <> 'void'`).groupBy(sales.customerId),
  ]);
  const debtMap = new Map(debtRows.map((row) => [row.customerId, Number(row.balance)]));
  const saleMap = new Map(saleRows.filter((r) => r.customerId).map((row) => [row.customerId as string, Number(row.count)]));
  return <>
    <PageHeader title={sw ? "Wateja" : "Customers"} description={sw ? "Hifadhi majina, simu na mipaka ya madeni ya wateja." : "Keep customer contacts, credit limits, balances and purchase history."} />
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><UserRoundPlus className="text-forest-700" size={19} /><h2 className="section-title">{sw ? "Ongeza mteja" : "Add customer"}</h2></div><ActionForm action={createCustomerAction} submitLabel={sw ? "Ongeza mteja" : "Add customer"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div><label className="field-label">{sw ? "Jina la mteja *" : "Customer name *"}</label><input name="name" required className="field" /></div><div><label className="field-label">{sw ? "Simu" : "Phone"}</label><input name="phone" className="field" /></div><div><label className="field-label">{sw ? "Eneo" : "Location"}</label><input name="location" className="field" /></div><div><label className="field-label">{sw ? "Aina ya mteja" : "Customer type"}</label><select name="customerType" className="field"><option value="retail">{sw ? "Rejareja" : "Retail"}</option><option value="wholesale">{sw ? "Jumla" : "Wholesale"}</option></select></div><div><label className="field-label">{sw ? "Kikomo cha deni (TZS)" : "Credit limit (TZS)"}</label><input name="creditLimit" type="number" min="0" step="0.01" defaultValue="0" className="field" /><p className="field-help">{sw ? "Kikomo cha sifuri hakiruhusu mauzo ya deni." : "A zero credit limit disables credit sales."}</p></div><div><label className="field-label">{sw ? "Maelezo" : "Notes"}</label><input name="notes" className="field" /></div></ActionForm></section>
    <div className="mb-3 flex items-center gap-2"><Users size={18} className="text-forest-700" /><h2 className="section-title">{sw ? `Rekodi za wateja (${customerRows.length})` : `Customer records (${customerRows.length})`}</h2></div>
    <DataTable headers={sw ? ["Mteja", "Simu", "Eneo", "Aina", "Kikomo cha deni", "Deni", "Mauzo", "Hali", "Ametengenezwa"] : ["Customer", "Phone", "Location", "Type", "Credit limit", "Outstanding", "Sales", "Status", "Created"]} rows={customerRows.map((customer) => [<span key={`${customer.id}-name`} className="font-semibold">{customer.name}</span>, customer.phone ?? "—", customer.location ?? "—", (sw ? (customer.customerType === "retail" ? "Rejareja" : "Jumla") : customer.customerType), money(customer.creditLimit), <span key={`${customer.id}-debt`} className={debtMap.get(customer.id) ? "font-semibold text-amber-700" : ""}>{money(debtMap.get(customer.id) ?? 0)}</span>, saleMap.get(customer.id) ?? 0, <span key={`${customer.id}-status`} className={`badge ${customer.active ? "badge-green" : "badge-gray"}`}>{customer.active ? (sw ? "Hai" : "Active") : (sw ? "Haifanyi kazi" : "Inactive")}</span>, dateTime(customer.createdAt)])} />
  </>;
}

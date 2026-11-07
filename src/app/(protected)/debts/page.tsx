import { and, asc, desc, eq, sql } from "drizzle-orm";
import { CreditCard, WalletCards } from "lucide-react";
import { getDb } from "@/db";
import { customers, debtTransactions, sales } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { recordDebtPaymentAction } from "@/lib/actions";
import { dateTime, money, todayDateTz } from "@/lib/format";

export default async function DebtsPage() {
  const db = getDb();
  const [customerRows, ledger, balanceRows, openSales] = await Promise.all([
    db.select({ id: customers.id, name: customers.name, phone: customers.phone }).from(customers).where(eq(customers.active, true)).orderBy(asc(customers.name)),
    db.select({ transaction: debtTransactions, customer: customers.name }).from(debtTransactions).innerJoin(customers, eq(customers.id, debtTransactions.customerId)).orderBy(desc(debtTransactions.createdAt)).limit(100),
    db.select({ customerId: debtTransactions.customerId, balance: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(debtTransactions).groupBy(debtTransactions.customerId),
    db.select({ sale: sales, customer: customers.name, dueDate: debtTransactions.dueDate }).from(sales).innerJoin(customers, eq(customers.id, sales.customerId)).leftJoin(debtTransactions, and(eq(debtTransactions.saleId, sales.id), eq(debtTransactions.transactionType, "debit"))).where(andOpenSales()).orderBy(asc(sales.createdAt)).limit(200),
  ]);
  const balanceMap = new Map(balanceRows.map((row) => [row.customerId, Number(row.balance)]));
  function andOpenSales() { return sql`${sales.balanceDue} > 0 AND ${sales.status} IN ('partial','credit')`; }
  const owing = customerRows.filter((customer) => (balanceMap.get(customer.id) ?? 0) > 0.005);
  const totalOwed = owing.reduce((sum, customer) => sum + (balanceMap.get(customer.id) ?? 0), 0);
  const overdueRows = openSales.filter(({ sale, dueDate }) => Boolean(dueDate && dueDate < todayDateTz() && Number(sale.balanceDue) > 0));
  const overdueTotal = overdueRows.reduce((sum, row) => sum + Number(row.sale.balanceDue), 0);
  return <>
    <PageHeader title="Customer debts & repayments" description="Track open credit sales, partial payments, repayment history and overdue balances. Credit sales are receivables, not cash collected." />
    <div className="mb-5 grid gap-3 sm:grid-cols-4"><div className="card p-4"><p className="text-xs text-slate-500">Total outstanding</p><p className="mt-2 text-2xl font-extrabold text-amber-700">{money(totalOwed)}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Customers with balances</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{owing.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Open credit invoices</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{openSales.length}</p></div><div className="card border-amber-200 bg-amber-50 p-4"><p className="text-xs text-amber-800">Overdue balance</p><p className="mt-2 text-2xl font-extrabold text-amber-900">{money(overdueTotal)}</p><p className="mt-1 text-[10px] text-amber-800">{overdueRows.length} overdue invoices</p></div></div>
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><WalletCards size={19} className="text-forest-700" /><h2 className="section-title">Record a repayment</h2></div><ActionForm action={recordDebtPaymentAction} submitLabel="Record repayment" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="xl:col-span-2"><label className="field-label">Customer *</label><select name="customerId" required className="field" defaultValue=""><option value="" disabled>Select customer</option>{customerRows.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""} — owed {money(balanceMap.get(customer.id) ?? 0)}</option>)}</select></div><div><label className="field-label">Amount (TZS) *</label><input name="amount" required min="0.01" step="0.01" type="number" className="field" /></div><div><label className="field-label">Payment method *</label><select name="method" className="field"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="mixx">Mixx by Yas</option><option value="airtel_money">Airtel Money</option><option value="halopesa">HaloPesa</option><option value="bank_transfer">Bank transfer</option></select></div><div><label className="field-label">Reference</label><input name="reference" className="field" /></div></ActionForm></section>
    <section className="mb-5"><div className="mb-3 flex items-center gap-2"><CreditCard size={18} className="text-forest-700" /><h2 className="section-title">Customer balances</h2></div><DataTable headers={["Customer", "Phone", "Outstanding balance", "Status"]} rows={customerRows.map((customer) => { const balance = balanceMap.get(customer.id) ?? 0; return [<span className="font-semibold">{customer.name}</span>, customer.phone ?? "—", <span className={balance > 0 ? "font-bold text-amber-700" : ""}>{money(balance)}</span>, <span className={`badge ${balance > 0 ? "badge-amber" : "badge-green"}`}>{balance > 0 ? "Owing" : "Clear"}</span>]; })} /></section>
    <section><h2 className="section-title mb-3">Open credit invoices</h2><DataTable headers={["Receipt", "Customer", "Date", "Due date", "Sale total", "Paid", "Due"]} rows={openSales.map(({ sale, customer, dueDate }) => { const overdue = Boolean(dueDate && dueDate < todayDateTz()); return [<span className="font-semibold">{sale.receiptNumber}</span>, customer, dateTime(sale.createdAt), dueDate ? <span className={overdue ? "font-bold text-red-700" : ""}>{dueDate}{overdue ? " · OVERDUE" : ""}</span> : "Not set", money(sale.total), money(sale.amountPaid), <span className="font-bold text-amber-700">{money(sale.balanceDue)}</span>]; })} /></section>
    <section className="mt-5"><h2 className="section-title mb-3">Recent debt ledger</h2><DataTable headers={["Date", "Customer", "Entry", "Amount", "Notes"]} rows={ledger.map(({ transaction, customer }) => [dateTime(transaction.createdAt), customer, <span className={`badge ${transaction.transactionType === "debit" ? "badge-amber" : "badge-green"}`}>{transaction.transactionType}</span>, money(transaction.amount), transaction.notes ?? "—"])} /></section>
  </>;
}

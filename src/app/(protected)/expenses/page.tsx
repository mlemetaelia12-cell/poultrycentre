import { desc, eq, sql } from "drizzle-orm";
import { Wallet } from "lucide-react";
import { getDb } from "@/db";
import { expenses, users } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { createExpenseAction } from "@/lib/actions";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { dateTime, money } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export default async function ExpensesPage() {
  const db = getDb();
  const locale = await getLocale();
  const sw = locale === "sw";
  const [rows, totals] = await Promise.all([
    db.select({ expense: expenses, staff: users.displayName }).from(expenses).innerJoin(users, eq(expenses.createdBy, users.id)).orderBy(desc(expenses.spentAt)).limit(200),
    db.select({ amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses),
  ]);
  const categories = ["Rent", "Salary", "Transport", "Electricity", "Internet", "Food", "Other"];
  return <>
    <PageHeader title={sw ? "Matumizi ya biashara" : "Business expenses"} description={sw ? "Rekodi matumizi ya duka kwa kiasi na sababu." : "Record shop expenses with an amount and reason."} />
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-slate-500">{sw ? "Jumla ya matumizi yote" : "Recorded expenses · all time"}</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{money(totals[0]?.amount ?? 0)}</p></div><div className="card p-4"><p className="text-xs text-slate-500">{sw ? "Idadi ya rekodi" : "Expense entries"}</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{rows.length}</p></div><div className="card col-span-2 p-4 sm:col-span-1"><p className="text-xs text-slate-500">{sw ? "Makundi" : "Categories"}</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{categories.length}</p></div></div>
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><Wallet size={18} className="text-forest-700" /><h2 className="section-title">{sw ? "Rekodi matumizi" : "Record an expense"}</h2></div><ActionForm action={createExpenseAction} idempotency submitLabel={sw ? "Hifadhi matumizi" : "Save expense"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div><label className="field-label">{sw ? "Kundi *" : "Category *"}</label><select name="category" className="field">{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div className="xl:col-span-2"><label className="field-label">{sw ? "Sababu / maelezo *" : "Description *"}</label><input name="description" required className="field" /></div><div><label className="field-label">{sw ? "Kiasi (TZS) *" : "Amount (TZS) *"}</label><input name="amount" type="number" min="0.01" step="0.01" required className="field" /></div><div><label className="field-label">{sw ? "Imelipwa kwa njia ya *" : "Paid using *"}</label><select name="method" className="field"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="mixx">Mixx by Yas</option><option value="airtel_money">Airtel Money</option><option value="halopesa">HaloPesa</option><option value="bank_transfer">Bank transfer</option></select></div><div className="sm:col-span-2"><label className="field-label">{sw ? "Namba ya muamala (si lazima)" : "Payment reference (optional)"}</label><input name="reference" className="field" /></div></ActionForm></section>
    <h2 className="section-title mb-3">{sw ? "Historia ya matumizi" : "Expense history"}</h2><DataTable headers={["Date", "Category", "Description", "Payment method", "Reference", "Amount", "Recorded by"]} rows={rows.map(({ expense, staff }) => [dateTime(expense.spentAt), expense.category, expense.description, expense.method.replaceAll("_", " "), expense.reference ?? "—", <span key={`${expense.id}-amount`} className="font-semibold">{money(expense.amount)}</span>, staff])} />
  </>;
}

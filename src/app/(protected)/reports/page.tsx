import { gte, lt, sql, and, eq, desc } from "drizzle-orm";
import { BarChart3, TrendingUp } from "lucide-react";
import { getDb } from "@/db";
import { batches, expenses, exchanges, payments, products, purchasePayments, saleItems, sales, stockMovements } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { money } from "@/lib/format";
import Link from "next/link";
import { calculateProfitMetrics } from "@/lib/finance";

function dayKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function startOfDay(date: string) { return new Date(`${date}T00:00:00+03:00`); }

export default async function ReportsPage() {
  const db = getDb();
  const today = dayKey(new Date());
  const monthStart = startOfDay(`${today.slice(0, 7)}-01`);
  const tomorrow = new Date(startOfDay(today).getTime() + 86400000);
  const deadStockCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [revenue, exchangeRevenue, collections, cogs, exchangeCogs, expensesMonth, purchasesMonth, expenseRows, collectionRows, purchaseRows, recentSales, stockRows, lastSoldRows] = await Promise.all([
    db.select({ amount: sql<string>`COALESCE(SUM(${sales.total}), 0)` }).from(sales).where(and(gte(sales.createdAt, monthStart), lt(sales.createdAt, tomorrow), sql`${sales.status} <> 'void'`)),
    db.select({ amount: sql<string>`COALESCE(SUM(${exchanges.priceDifference}), 0)` }).from(exchanges).where(and(gte(exchanges.createdAt, monthStart), lt(exchanges.createdAt, tomorrow))),
    db.select({ amount: sql<string>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(and(gte(payments.createdAt, monthStart), lt(payments.createdAt, tomorrow))),
    db.select({ amount: sql<string>`COALESCE(SUM(${saleItems.baseQuantity} * ${saleItems.unitCost}), 0)` }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(and(gte(sales.createdAt, monthStart), lt(sales.createdAt, tomorrow), sql`${sales.status} <> 'void'`)),
    db.select({ amount: sql<string>`COALESCE(SUM(-1 * ${stockMovements.quantity} * ${batches.unitCost}), 0)` }).from(stockMovements).innerJoin(batches, eq(batches.id, stockMovements.batchId)).where(and(eq(stockMovements.referenceType, "exchange"), eq(stockMovements.movementType, "exchange_out"), gte(stockMovements.createdAt, monthStart), lt(stockMovements.createdAt, tomorrow))),
    db.select({ amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(gte(expenses.spentAt, monthStart), lt(expenses.spentAt, tomorrow))),
    db.select({ amount: sql<string>`COALESCE(SUM(${purchasePayments.amount}), 0)` }).from(purchasePayments).where(and(gte(purchasePayments.paidAt, monthStart), lt(purchasePayments.paidAt, tomorrow))),
    db.select({ category: expenses.category, amount: sql<string>`SUM(${expenses.amount})` }).from(expenses).where(and(gte(expenses.spentAt, monthStart), lt(expenses.spentAt, tomorrow))).groupBy(expenses.category).orderBy(desc(sql`SUM(${expenses.amount})`)),
    db.select({ method: payments.method, amount: sql<string>`SUM(${payments.amount})` }).from(payments).where(and(gte(payments.createdAt, monthStart), lt(payments.createdAt, tomorrow))).groupBy(payments.method),
    db.select({ method: purchasePayments.method, amount: sql<string>`SUM(${purchasePayments.amount})` }).from(purchasePayments).where(and(gte(purchasePayments.paidAt, monthStart), lt(purchasePayments.paidAt, tomorrow))).groupBy(purchasePayments.method),
    db.select({ receiptNumber: sales.receiptNumber, total: sales.total, amountPaid: sales.amountPaid, balanceDue: sales.balanceDue, status: sales.status }).from(sales).where(and(gte(sales.createdAt, monthStart), lt(sales.createdAt, tomorrow), sql`${sales.status} <> 'void'`)).orderBy(desc(sales.createdAt)).limit(50),
    db.select({ productId: products.id, name: products.name, sku: products.sku, quantity: sql<string>`COALESCE(SUM(${batches.quantityRemaining}), 0)` }).from(products).innerJoin(batches, eq(batches.productId, products.id)).where(and(eq(products.active, true), sql`${batches.quantityRemaining} > 0`)).groupBy(products.id),
    db.select({ productId: saleItems.productId, lastSoldAt: sql<string>`MAX(${sales.createdAt})` }).from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).where(sql`${sales.status} <> 'void'`).groupBy(saleItems.productId),
  ]);
  const totalCogs = Number(cogs[0]?.amount ?? 0) + Number(exchangeCogs[0]?.amount ?? 0);
  const totalRevenue = Number(revenue[0]?.amount ?? 0) + Number(exchangeRevenue[0]?.amount ?? 0);
  const profit = calculateProfitMetrics(totalRevenue, totalCogs, Number(expensesMonth[0]?.amount ?? 0));
  const gross = profit.grossProfit;
  const net = profit.netProfit;
  const netCashFlow = Number(collections[0]?.amount ?? 0) - Number(purchasesMonth[0]?.amount ?? 0) - Number(expensesMonth[0]?.amount ?? 0);
  const lastSoldMap = new Map(lastSoldRows.map((row) => [row.productId, row.lastSoldAt]));
  const deadStock = stockRows.filter((row) => {
    const lastSold = lastSoldMap.get(row.productId);
    return !lastSold || new Date(lastSold).getTime() < deadStockCutoff.getTime();
  });
  return <>
    <PageHeader title="Financial reports" description="Sales, actual cash collections, cost of goods sold, operating expenses, gross profit and net profit. Stock purchases are not counted again as expenses." action={<div className="flex flex-wrap gap-2"><Link href="/api/export/sales" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export sales CSV</Link><Link href="/api/export/expenses" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export expenses</Link><Link href="/api/export/debts" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export debts</Link><Link href="/api/export/stock" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export stock</Link></div>} />
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label="Net sales · this month" value={money(totalRevenue)} icon={<BarChart3 size={18} />} /><StatCard label="Actual collections" value={money(collections[0]?.amount ?? 0)} icon={<TrendingUp size={18} />} /><StatCard label="Gross profit" value={money(gross)} icon={<TrendingUp size={18} />} /><StatCard label="Net profit" value={money(net)} icon={<BarChart3 size={18} />} accent={net < 0 ? "red" : "green"} /></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-slate-500">Cost of goods sold</p><p className="mt-2 text-xl font-extrabold text-slate-800">{money(totalCogs)}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Operating expenses</p><p className="mt-2 text-xl font-extrabold text-slate-800">{money(expensesMonth[0]?.amount ?? 0)}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Net cash flow (recorded)</p><p className={`mt-2 text-xl font-extrabold ${netCashFlow < 0 ? "text-red-700" : "text-forest-700"}`}>{money(netCashFlow)}</p><p className="mt-1 text-[10px] text-slate-400">Collections less supplier purchase payments and expenses</p></div></div>
    <div className="grid gap-5 xl:grid-cols-2"><section className="card p-4 sm:p-5"><h2 className="section-title">Expenses by category</h2><p className="section-subtitle">Current month · TZS</p><div className="mt-4"><DataTable headers={["Category", "Amount"]} rows={expenseRows.map((row) => [row.category, money(row.amount)])} /></div></section><section className="card p-4 sm:p-5"><h2 className="section-title">Collections by payment method</h2><p className="section-subtitle">Current month · TZS</p><div className="mt-4"><DataTable headers={["Method", "Collected"]} rows={collectionRows.map((row) => [row.method.replaceAll("_", " "), money(row.amount)])} /></div></section></div>
    <section className="card mt-5 p-4 sm:p-5"><h2 className="section-title">Supplier payments by method</h2><div className="mt-4"><DataTable headers={["Method", "Paid"]} rows={purchaseRows.map((row) => [row.method.replaceAll("_", " "), money(row.amount)])} /></div></section>
    <section className="card mt-5 p-4 sm:p-5"><h2 className="section-title">Potential dead stock</h2><p className="section-subtitle">Active stock with no recorded sale in the last 60 days. Review manually before making purchasing decisions.</p><div className="mt-4"><DataTable headers={["Product", "SKU", "Quantity on hand"]} rows={deadStock.map((row) => [row.name, row.sku, row.quantity])} /></div></section>
    <section className="mt-5"><h2 className="section-title mb-3">Sales register · current month</h2><DataTable headers={["Receipt", "Net sale", "Collected", "Balance due", "Status"]} rows={recentSales.map((sale) => [sale.receiptNumber, money(sale.total), money(sale.amountPaid), money(sale.balanceDue), <span className={`badge ${sale.status === "completed" ? "badge-green" : "badge-amber"}`}>{sale.status}</span>])} /></section>
    <p className="mt-4 text-xs leading-5 text-slate-500">Profit is based on recorded sale line costs and recorded expenses. Reconcile mobile money and bank statements regularly. The system does not calculate VAT or produce TRA fiscal receipts until the business's tax status and EFD/VFD requirements are verified.</p>
  </>;
}

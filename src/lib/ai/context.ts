import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { batches, customers, debtTransactions, expenses, sales } from "@/db/schema";
import { getDashboardData } from "@/lib/dashboard-data";
import { todayDateTz } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const moneyTopics = /sales|sale|mauzo|sold|profit|faida|revenue|mapato|turnover/i;
const stockTopics = /stock|inventory|stoo|low stock|reorder|expiry|expire|batch|bidhaa|kuisha|karibu ku-expire/i;
const debtTopics = /debt|debts|balance|customer owe|madeni|deni|wateja.*dai|anadaiwa/i;
const expenseTopics = /expense|expenses|costs|spending|matumizi|gharama/i;
const profitTopics = /profit|faida|margin|gross|net profit/i;

function todayWindow() {
  const today = todayDateTz();
  const start = new Date(`${today}T00:00:00+03:00`);
  return { today, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * Exposes a deliberately small, role-filtered set of business aggregates. The model
 * never receives database credentials, SQL access, session secrets or raw records.
 */
export async function getAuthorizedAIContext(user: SessionUser, question: string) {
  const db = getDb();
  const { today, start, end } = todayWindow();
  const context: Record<string, unknown> = {
    businessDate: today,
    timeZone: "Africa/Dar_es_Salaam",
    currency: "TZS",
    userRole: user.role,
  };

  if (moneyTopics.test(question) && hasPermission(user.role, "sales:read")) {
    const salesFilters = [gte(sales.createdAt, start), lt(sales.createdAt, end), sql`${sales.status} <> 'void'`];
    if (user.role === "cashier") salesFilters.push(eq(sales.createdBy, user.id));
    const [summary] = await db.select({
      saleCount: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      paid: sql<string>`COALESCE(SUM(${sales.amountPaid}), 0)`,
      outstanding: sql<string>`COALESCE(SUM(${sales.balanceDue}), 0)`,
    }).from(sales).where(and(...salesFilters));
    context.todaySales = {
      count: Number(summary?.saleCount ?? 0),
      totalTsh: Number(summary?.total ?? 0),
      receivedTsh: Number(summary?.paid ?? 0),
      outstandingTsh: Number(summary?.outstanding ?? 0),
    };

    if (profitTopics.test(question) && (user.role === "owner" || user.role === "manager")) {
      const dashboard = await getDashboardData(user.role, user.id);
      context.todayNetProfitTsh = dashboard.todayProfit;
    }
  }

  if (stockTopics.test(question) && hasPermission(user.role, "inventory:read")) {
    const dashboard = await getDashboardData(user.role, user.id);
    const [expiredCount] = await db.select({ value: sql<number>`COUNT(*)` }).from(batches).where(and(lt(batches.expiryDate, today), sql`${batches.quantityRemaining} > 0`));
    context.inventory = {
      lowStockProducts: dashboard.lowStockProducts.slice(0, 15).map((item) => ({ name: item.name, sku: item.sku, stock: item.stock, reorderAt: item.reorder })),
      expiringBatches: dashboard.expiryBatches.slice(0, 15).map((item) => ({ product: item.productName, batch: item.batchNumber, expiryDate: item.expiryDate, quantity: item.quantity })),
      expiredBatchCount: Number(expiredCount?.value ?? 0),
      expiredBatchExamples: dashboard.expiredBatches.slice(0, 10).map((item) => ({ product: item.productName, batch: item.batchNumber, expiryDate: item.expiryDate, quantity: item.quantity })),
    };
  }

  if (debtTopics.test(question) && hasPermission(user.role, "debts:read")) {
    const balanceExpression = sql`CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END`;
    const [rows, totalRows] = await Promise.all([
      db.select({
        customer: customers.name,
        balance: sql<string>`COALESCE(SUM(${balanceExpression}), 0)`,
      }).from(debtTransactions).innerJoin(customers, eq(debtTransactions.customerId, customers.id)).groupBy(customers.id, customers.name).having(sql`SUM(${balanceExpression}) > 0`).orderBy(desc(sql`SUM(${balanceExpression})`)).limit(10),
      db.select({ balance: sql<string>`COALESCE(SUM(${balanceExpression}), 0)` }).from(debtTransactions),
    ]);
    context.customerDebts = rows.map((row) => ({ customer: row.customer, outstandingTsh: Number(row.balance) }));
    context.totalOutstandingTsh = Number(totalRows[0]?.balance ?? 0);
  }

  if (expenseTopics.test(question) && hasPermission(user.role, "expenses:read")) {
    const [total] = await db.select({ amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(gte(expenses.spentAt, start), lt(expenses.spentAt, end)));
    const categories = await db.select({ category: expenses.category, amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(gte(expenses.spentAt, start), lt(expenses.spentAt, end))).groupBy(expenses.category).orderBy(desc(sql`SUM(${expenses.amount})`)).limit(10);
    context.todayExpenses = { totalTsh: Number(total?.amount ?? 0), byCategory: categories.map((row) => ({ category: row.category, amountTsh: Number(row.amount) })) };
  }

  return context;
}

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { batches, customers, debtTransactions, expenses, products, sales } from "@/db/schema";
import { requireFullAccess } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

function cell(value: unknown): string {
  let raw = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(raw)) raw = `'${raw}`;
  return `"${raw.replaceAll('"', '""')}"`;
}
function csv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await requireFullAccess();
  if (!hasPermission(user.role, "reports:read")) return new Response("Forbidden", { status: 403 });
  const { type } = await params;
  const db = getDb();
  let body = "";
  let filename = "poultry-centre-export.csv";
  if (type === "sales") {
    const rows = await db.select().from(sales).orderBy(desc(sales.createdAt)).limit(10000);
    body = csv(["Receipt", "Date", "Sale type", "Subtotal TZS", "Discount TZS", "Total TZS", "Paid TZS", "Balance TZS", "Status", "Created by"], rows.map((r) => [r.receiptNumber, r.createdAt.toISOString(), r.saleType, r.subtotal, r.discount, r.total, r.amountPaid, r.balanceDue, r.status, r.createdBy])); filename = "poultry-centre-sales.csv";
  } else if (type === "stock") {
    const rows = await db.select({ product: products.name, sku: products.sku, batch: batches.batchNumber, expiry: batches.expiryDate, quantity: batches.quantityRemaining, cost: batches.unitCost }).from(batches).innerJoin(products, eq(products.id, batches.productId)).orderBy(products.name, batches.expiryDate).limit(10000);
    body = csv(["Product", "SKU", "Batch", "Expiry date", "Quantity remaining", "Unit cost TZS", "Stock cost TZS"], rows.map((r) => [r.product, r.sku, r.batch, r.expiry, r.quantity, r.cost, Number(r.quantity) * Number(r.cost)])); filename = "poultry-centre-stock.csv";
  } else if (type === "expenses") {
    const rows = await db.select().from(expenses).orderBy(desc(expenses.spentAt)).limit(10000);
    body = csv(["Date", "Category", "Description", "Amount TZS", "Method", "Reference", "Recorded by"], rows.map((r) => [r.spentAt.toISOString(), r.category, r.description, r.amount, r.method, r.reference, r.createdBy])); filename = "poultry-centre-expenses.csv";
  } else if (type === "debts") {
    const rows = await db.select({ name: customers.name, phone: customers.phone, balance: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(customers).leftJoin(debtTransactions, eq(debtTransactions.customerId, customers.id)).groupBy(customers.id).orderBy(customers.name);
    body = csv(["Customer", "Phone", "Outstanding balance TZS"], rows.map((r) => [r.name, r.phone, r.balance])); filename = "poultry-centre-customer-debts.csv";
  } else {
    return new Response("Unknown export type", { status: 404 });
  }
  return new Response(body, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

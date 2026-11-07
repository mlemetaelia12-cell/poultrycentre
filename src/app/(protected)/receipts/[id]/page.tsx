import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessSettings, customers, paymentAllocations, payments, products, saleItems, sales, users } from "@/db/schema";
import { PrintReceipt } from "@/components/print-receipt";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const db = getDb();
  const [record] = await db.select({ sale: sales, customer: customers.name, cashier: users.displayName }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id)).where(eq(sales.id, id)).limit(1);
  if (!record || (actor.role === "cashier" && record.sale.createdBy !== actor.id)) notFound();
  const [items, allocatedPaymentRows, directSalePayments, settings] = await Promise.all([
    db.select({ item: saleItems, name: products.name, sku: products.sku }).from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(eq(saleItems.saleId, id)),
    db.select({ payment: payments }).from(paymentAllocations).innerJoin(payments, eq(paymentAllocations.paymentId, payments.id)).where(eq(paymentAllocations.saleId, id)),
    db.select().from(payments).where(eq(payments.saleId, id)),
    db.select().from(businessSettings).limit(1),
  ]);
  const paymentMap = new Map<string, typeof directSalePayments[number]>();
  for (const row of directSalePayments) paymentMap.set(row.id, row);
  for (const row of allocatedPaymentRows) paymentMap.set(row.payment.id, row.payment);
  const paymentRows = [...paymentMap.values()];
  const sale = record.sale;
  return <>
    <PageHeader title={`Receipt ${sale.receiptNumber}`} description="Print or save this internal receipt. For a customer exchange, obtain owner/manager approval and retain the original sale record." />
    <PrintReceipt receipt={{
      businessName: settings[0]?.businessName ?? "POULTRY CENTRE", phone: settings[0]?.phone ?? null, address: settings[0]?.address ?? null,
      receiptNumber: sale.receiptNumber, createdAt: sale.createdAt, cashier: record.cashier, customer: record.customer,
      saleType: sale.saleType, subtotal: sale.subtotal, discount: sale.discount, total: sale.total, amountPaid: sale.amountPaid,
      balanceDue: sale.balanceDue, notes: sale.notes,
      items: items.map(({ item, name, sku }) => ({ name, sku, unitName: item.unitName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })),
      payments: paymentRows.map((payment) => ({ method: payment.method, amount: payment.amount, reference: payment.reference, paymentType: payment.paymentType })),
    }} />
  </>;
}

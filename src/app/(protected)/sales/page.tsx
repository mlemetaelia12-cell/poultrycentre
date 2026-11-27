import { and, desc, eq, isNull } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/db";
import { cashierShifts, customers, products, sales, unitConversions, users, draftOrders, draftOrderItems } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { PosForm } from "@/components/pos-form";
import { dateTime, money } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { openShiftAction, closeShiftAction, voidUnpaidCreditSaleAction } from "@/lib/actions";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ draftId?: string }> }) {
  const db = getDb();
  const actor = await requireUser();
  const params = await searchParams;
  const requestedDraftId = params.draftId ?? "";
  const [productRows, conversionRows, customerRows, saleRows, openShift] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(products.name),
    db.select().from(unitConversions),
    db.select({ id: customers.id, name: customers.name, phone: customers.phone, creditLimit: customers.creditLimit }).from(customers).where(eq(customers.active, true)).orderBy(customers.name),
    db.select({ sale: sales, customer: customers.name, cashier: users.displayName }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).innerJoin(users, eq(sales.createdBy, users.id)).where(actor.role === "cashier" ? eq(sales.createdBy, actor.id) : undefined).orderBy(desc(sales.createdAt)).limit(50),
    db.select().from(cashierShifts).where(and(eq(cashierShifts.userId, actor.id), isNull(cashierShifts.closedAt))).limit(1).then((rows) => rows[0] ?? null),
  ]);
  const selectedDraft = requestedDraftId ? (await db.select().from(draftOrders).where(and(eq(draftOrders.id, requestedDraftId), ...(actor.role === "owner" || actor.role === "manager" ? [] : [eq(draftOrders.createdBy, actor.id)]))).limit(1))[0] ?? null : null;
  const selectedDraftItems = selectedDraft ? await db.select().from(draftOrderItems).where(eq(draftOrderItems.draftOrderId, selectedDraft.id)) : [];
  const initialDraft = selectedDraft ? { id: selectedDraft.id, customerId: selectedDraft.customerId, customerName: selectedDraft.customerName, customerPhone: selectedDraft.customerPhone, deliveryLocation: selectedDraft.deliveryLocation, saleType: selectedDraft.saleType === "wholesale" ? "wholesale" as const : "retail" as const, discount: selectedDraft.discount, notes: selectedDraft.notes, items: selectedDraftItems.map((item) => ({ productId: item.productId, productName: item.productName, unitName: item.unitName, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), baseQuantity: Number(item.baseQuantity) })) } : null;
  const productsForPos = productRows.map((product) => ({
    id: product.id, sku: product.sku, barcode: product.barcode, name: product.name, baseUnit: product.baseUnit, retailPrice: product.retailPrice,
    wholesalePrice: product.wholesalePrice, minimumPrice: product.minimumPrice,
    units: conversionRows.filter((row) => row.productId === product.id).map((row) => ({ unitName: row.unitName, barcode: row.barcode, baseQuantity: row.baseQuantity, retailPrice: row.retailPrice, wholesalePrice: row.wholesalePrice })),
  }));
  const latestReceipt = saleRows.find((row) => row.sale.status !== "void");
  return <>
    <PageHeader title="Sales & point of sale" description="Fast retail and wholesale checkout, split payments, customer credit, FEFO stock deduction and audit history." action={<div className="flex flex-wrap gap-2"><Link href="/sales/drafts" className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700 hover:bg-forest-50">Draft Orders</Link><Link href="/sales/history" className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700 hover:bg-forest-50">Sales History</Link>{latestReceipt && <Link href={`/receipts/${latestReceipt.sale.id}`} className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700 hover:bg-forest-50">Latest receipt</Link>}</div>} />
    <section className="card mb-5 p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="section-title">Cashier shift</h2><p className="section-subtitle">Opening cash, payment collection, cash expenses, supplier payments and closing discrepancy.</p>{openShift && <p className="mt-2 text-xs font-semibold text-forest-700">Shift opened at {dateTime(openShift.openedAt)} · Opening float {money(openShift.openingCash)}</p>}</div>{openShift ? <ActionForm action={closeShiftAction} submitLabel="Close & reconcile shift" className="flex min-w-[230px] items-end gap-2"><div className="flex-1"><label className="field-label">Counted cash (TZS)</label><input name="countedCash" required type="number" min="0" step="0.01" className="field" /></div><input type="hidden" name="notes" value="" /></ActionForm> : <ActionForm action={openShiftAction} submitLabel="Open shift" className="flex min-w-[230px] items-end gap-2"><div className="flex-1"><label className="field-label">Opening cash (TZS)</label><input name="openingCash" required type="number" min="0" step="0.01" defaultValue="0" className="field" /></div></ActionForm>}</div></section>
    {selectedDraft && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Continuing draft order <strong>{selectedDraft.orderNumber}</strong>. Stock is not reserved. Checkout will re-check current prices and stock.</div>}
    <PosForm products={productsForPos} customers={customerRows} initialDraft={initialDraft} />
    <section className="mt-7"><div className="mb-3 flex items-center gap-2"><ClipboardList size={18} className="text-forest-700" /><h2 className="section-title">Recent sales</h2></div>
      <DataTable headers={["Receipt", "Date", "Customer", "Type", "Total", "Paid", "Balance", "Cashier", "Status", "Receipt", ...(actor.role === "owner" || actor.role === "manager" ? ["Approval"] : [])]} rows={saleRows.map(({ sale, customer, cashier }) => [<span key={`${sale.id}-receipt`} className="font-semibold">{sale.receiptNumber}</span>, dateTime(sale.createdAt), customer ?? "Walk-in", sale.saleType, money(sale.total), money(sale.amountPaid), Number(sale.balanceDue) > 0 ? <span key={`${sale.id}-balance`} className="font-semibold text-amber-700">{money(sale.balanceDue)}</span> : money(0), cashier, <span key={`${sale.id}-status`} className={`badge ${sale.status === "completed" ? "badge-green" : sale.status === "void" ? "badge-red" : "badge-amber"}`}>{sale.status}</span>, <Link key={`${sale.id}-receipt-link`} href={`/receipts/${sale.id}`} className="font-semibold text-forest-700">View</Link>, ...((actor.role === "owner" || actor.role === "manager") ? [sale.status === "credit" && Number(sale.amountPaid) === 0 ? <form key={`${sale.id}-approval`} action={voidUnpaidCreditSaleAction} className="flex min-w-44 flex-col gap-1"><input type="hidden" name="saleId" value={sale.id} /><input name="reason" required minLength={5} maxLength={500} placeholder="Cancellation reason" className="field min-w-40" /><button className="rounded-lg border border-red-200 px-2 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-50">Approve cancellation</button></form> : "—"] : [])])} />
      <p className="mt-2 text-[11px] text-slate-500">Only completely unpaid credit sales can be cancelled here. Paid or partially paid sales require a separately reviewed adjustment. Cancelled sales remain in the audit history and their original stock batches are restored.</p>
    </section>
  </>;
}

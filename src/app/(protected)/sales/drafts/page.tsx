import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { FileClock, Package } from "lucide-react";
import { getDb } from "@/db";
import { customers, draftOrderItems, draftOrders, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";

export default async function DraftOrdersPage() {
  const actor = await requirePermission("sales:read");
  const db = getDb();
  const condition = actor.role === "cashier"
    ? and(eq(draftOrders.status, "draft"), eq(draftOrders.createdBy, actor.id))
    : eq(draftOrders.status, "draft");
  const rows = await db.select({ order: draftOrders, customer: customers.name, cashier: users.displayName })
    .from(draftOrders)
    .leftJoin(customers, eq(draftOrders.customerId, customers.id))
    .innerJoin(users, eq(draftOrders.createdBy, users.id))
    .where(condition)
    .orderBy(desc(draftOrders.updatedAt))
    .limit(100);
  const ids = rows.map((row) => row.order.id);
  const itemRows = ids.length ? await db.select().from(draftOrderItems).where(inArray(draftOrderItems.draftOrderId, ids)) : [];
  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) itemsByOrder.set(item.draftOrderId, [...(itemsByOrder.get(item.draftOrderId) ?? []), item]);

  return <>
    <PageHeader title="Draft Orders" description="Orders saved for later payment. Drafts do not reserve stock, create receipts or appear as completed sales." action={<Link href="/sales" className="rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-xs font-semibold text-forest-700 hover:bg-forest-50">Back to POS</Link>} />
    {rows.length ? <div className="space-y-3">
      {rows.map(({ order, customer, cashier }) => {
        const items = itemsByOrder.get(order.id) ?? [];
        const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
        const total = Math.max(0, subtotal - Number(order.discount));
        return <article key={order.id} className="card min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><FileClock size={17} className="text-amber-600" /><h2 className="break-all text-sm font-extrabold text-slate-800">{order.orderNumber}</h2><span className="badge badge-amber">Draft</span></div>
              <p className="mt-1 text-xs text-slate-500">{dateTime(order.updatedAt)} · {customer ?? order.customerName ?? "Walk-in customer"} · {cashier}</p>
            </div>
            <Link href={`/sales?draftId=${order.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-forest-700 px-4 text-xs font-bold text-white hover:bg-forest-800"><Package size={15} />Continue order</Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><div className="min-w-0"><p className="break-words text-xs font-semibold text-slate-700">{item.productName}</p><p className="text-[10px] text-slate-500">{item.quantity} {item.unitName} × {money(item.unitPrice)}</p></div><span className="shrink-0 text-xs font-bold text-slate-800">{money(item.lineTotal)}</span></div>)}
          </div>
          {order.deliveryLocation && <p className="mt-3 text-xs text-slate-600"><strong>Delivery:</strong> {order.deliveryLocation}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">{items.length} line item(s) · {order.saleType}</span><span className="font-extrabold text-slate-900">Order total: {money(total)}</span></div>
        </article>;
      })}
    </div> : <div className="card px-4 py-14 text-center"><FileClock className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-semibold text-slate-700">No draft orders yet</p><p className="mt-1 text-xs text-slate-500">Create an order in POS and choose “Save as draft order”.</p><Link href="/sales" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-forest-700 px-4 text-xs font-bold text-white">Open POS</Link></div>}
  </>;
}

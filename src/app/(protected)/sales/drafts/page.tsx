import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { FileClock } from "lucide-react";
import { getDb } from "@/db";
import { customers, draftOrderItems, draftOrders, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export default async function DraftOrdersPage() {
  const actor = await requirePermission("sales:read");
  const locale = await getLocale();
  const sw = locale === "sw";
  const db = getDb();

  const orders = await db
    .select({
      order: draftOrders,
      customer: customers.name,
      cashier: users.displayName,
    })
    .from(draftOrders)
    .leftJoin(customers, eq(draftOrders.customerId, customers.id))
    .leftJoin(users, eq(draftOrders.createdBy, users.id))
    .where(eq(draftOrders.status, "draft"))
    .orderBy(desc(draftOrders.updatedAt))
    .limit(100);

  const visibleOrders = actor.role === "cashier"
    ? orders.filter(({ order }) => order.createdBy === actor.id)
    : orders;

  const ids = visibleOrders.map(({ order }) => order.id);
  const itemRows = ids.length
    ? await db.select().from(draftOrderItems).where(inArray(draftOrderItems.draftOrderId, ids))
    : [];

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const current = itemsByOrder.get(item.draftOrderId) ?? [];
    current.push(item);
    itemsByOrder.set(item.draftOrderId, current);
  }

  return (
    <>
      <PageHeader
        title={sw ? "Oda zilizohifadhiwa" : "Draft orders"}
        description={sw ? "Endelea na oda ambazo hazijakamilishwa." : "Continue orders that have not been checked out yet."}
        action={
          <Link href="/sales" className="rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white">
            {sw ? "Tengeneza mauzo" : "New sale"}
          </Link>
        }
      />

      {visibleOrders.length ? (
        <div className="space-y-4">
          {visibleOrders.map(({ order, customer, cashier }) => {
            const items = itemsByOrder.get(order.id) ?? [];
            const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
            const total = Math.max(0, subtotal - Number(order.discount));

            return (
              <section key={order.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-slate-800">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateTime(order.updatedAt)} · {customer ?? order.customerName ?? (sw ? "Mteja wa kawaida" : "Walk-in customer")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sw ? "Aliyehifadhi" : "Saved by"}: {cashier ?? "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    {sw ? "Haijakamilika" : "Draft"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 p-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                        <p className="mt-1 text-slate-500">{item.quantity} × {item.unitName}</p>
                      </div>
                      <p className="font-bold text-slate-800">{money(item.lineTotal)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">{sw ? "Jumla ya oda" : "Order total"}</p>
                    <p className="text-lg font-extrabold text-forest-800">{money(total)}</p>
                  </div>
                  <Link
                    href={`/sales?draftId=${order.id}`}
                    className="rounded-xl bg-forest-700 px-5 py-3 text-xs font-bold text-white"
                  >
                    {sw ? "Endelea na oda" : "Continue order"}
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card px-4 py-14 text-center">
          <FileClock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-700">
            {sw ? "Hakuna oda zilizohifadhiwa." : "No draft orders yet."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {sw ? "Oda utakazohifadhi zitaonekana hapa." : "Orders you save will appear here."}
          </p>
        </div>
      )}
    </>
  );
}

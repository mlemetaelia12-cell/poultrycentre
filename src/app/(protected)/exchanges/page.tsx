import { desc, eq, sql } from "drizzle-orm";
import { ArrowLeftRight, ShieldAlert } from "lucide-react";
import { getDb } from "@/db";
import {
  batches,
  exchanges,
  products,
  quarantinedStock,
  saleItems,
  sales,
  users,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import {
  createExchangeAction,
  resolveQuarantineAction,
} from "@/lib/actions";
import { DataTable } from "@/components/data-table";
import { dateTime, money, number } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export default async function ExchangesPage() {
  const actor = await requireUser();
  const db = getDb();

  const [saleLines, productRows, quarantineRows, exchangeRows] =
    await Promise.all([
      db
        .select({
          item: saleItems,
          sale: sales,
          product: products.name,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(products, eq(products.id, saleItems.productId))
        .where(sql`${sales.status} <> 'void'`)
        .orderBy(desc(sales.createdAt))
        .limit(200),

      db
        .select({
          id: products.id,
          name: products.name,
          baseUnit: products.baseUnit,
          active: products.active,
        })
        .from(products)
        .where(eq(products.active, true))
        .orderBy(products.name),

      db
        .select({
          quarantine: quarantinedStock,
          product: products.name,
          batch: batches.batchNumber,
          exchangeId: exchanges.id,
        })
        .from(quarantinedStock)
        .innerJoin(
          products,
          eq(products.id, quarantinedStock.productId),
        )
        .innerJoin(
          batches,
          eq(batches.id, quarantinedStock.originalBatchId),
        )
        .innerJoin(
          exchanges,
          eq(exchanges.id, quarantinedStock.exchangeId),
        )
        .orderBy(desc(quarantinedStock.createdAt))
        .limit(200),

      db
        .select({
          exchange: exchanges,
          original: products.name,
          replacementId: exchanges.replacementProductId,
          staff: users.displayName,
        })
        .from(exchanges)
        .innerJoin(
          products,
          eq(products.id, exchanges.originalProductId),
        )
        .innerJoin(
          users,
          eq(users.id, exchanges.approvedBy),
        )
        .orderBy(desc(exchanges.createdAt))
        .limit(100),
    ]);

  const canApproveExchange =
    (actor.role === "owner" || actor.role === "manager") &&
    actor.accessMode === "full";

  return (
    <>
      <PageHeader
        title="Exceptional customer exchanges"
        description="Routine medicine returns are not accepted. Only an owner or manager can approve an exceptional exchange; returned medicine is quarantined and never automatically put back into sellable stock."
      />

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        <strong>Important control:</strong> this is an exchange workflow,
        not a general return/refund function. The original sale remains
        in history. Returned product is recorded in quarantine and
        replacement stock is deducted using FEFO.
      </div>

      {canApproveExchange && (
        <section className="card mb-5 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <ArrowLeftRight
              size={18}
              className="text-forest-700"
            />
            <h2 className="section-title">
              Approve an exceptional exchange
            </h2>
          </div>

          <ActionForm
            action={createExchangeAction}
            submitLabel="Approve & record exchange"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div className="sm:col-span-2 xl:col-span-3">
              <label className="field-label">
                Original sale item *
              </label>

              <select
                name="originalSaleItemId"
                className="field"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select sale line
                </option>

                {saleLines.map(({ item, sale, product }) => (
                  <option key={item.id} value={item.id}>
                    {sale.receiptNumber} · {product} · sold base qty{" "}
                    {number(item.baseQuantity, 3)} ·{" "}
                    {dateTime(sale.createdAt)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">
                Returned quantity (original base units) *
              </label>

              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                className="field"
              />
            </div>

            <div>
              <label className="field-label">
                Replacement product *
              </label>

              <select
                name="replacementProductId"
                className="field"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select replacement
                </option>

                {productRows.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.baseUnit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">
                Replacement quantity (base units) *
              </label>

              <input
                name="replacementQuantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                className="field"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">
                Reason for exception *
              </label>

              <input
                name="reason"
                minLength={5}
                required
                className="field"
                placeholder="Explain the exceptional circumstances"
              />
            </div>

            <div>
              <label className="field-label">
                Payment method for any price difference *
              </label>

              <select
                name="paymentMethod"
                className="field"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="mixx">Mixx by Yas</option>
                <option value="airtel_money">Airtel Money</option>
                <option value="halopesa">HaloPesa</option>
                <option value="bank_transfer">
                  Bank transfer
                </option>
              </select>
            </div>

            <div className="sm:col-span-2 xl:col-span-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              The system computes the price difference using the
              recorded original sale value and the replacement
              product&apos;s configured retail/wholesale base-unit price.
              Returned stock remains quarantined. No returned medicine
              is added back to available stock.
            </div>
          </ActionForm>
        </section>
      )}

      <section className="mb-5">
        <h2 className="section-title mb-3">
          Quarantined returned stock
        </h2>

        <DataTable
          headers={[
            "Product",
            "Original batch",
            "Qty quarantined",
            "Reason",
            "Status",
            "Recorded",
          ]}
          rows={quarantineRows.map(
            ({ quarantine, product, batch }) => [
              <span
                key={quarantine.id}
                className="font-semibold"
              >
                {product}
              </span>,
              batch,
              number(quarantine.quantity, 3),
              quarantine.reason,
              <span
                key={`${quarantine.id}-status`}
                className={`badge ${
                  quarantine.status === "disposed"
                    ? "badge-gray"
                    : "badge-amber"
                }`}
              >
                {quarantine.status.replaceAll("_", " ")}
              </span>,
              dateTime(quarantine.createdAt),
            ],
          )}
        />
      </section>

      {actor.role === "owner" && (
        <section className="card mb-5 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert
              size={18}
              className="text-forest-700"
            />
            <h2 className="section-title">
              Resolve quarantine record
            </h2>
          </div>

          <p className="mb-3 text-xs text-slate-500">
            V1 only records final disposal. Quarantined medicine
            cannot be released into sellable stock.
          </p>

          <div className="space-y-3">
            {quarantineRows
              .filter(
                (row) =>
                  row.quarantine.status === "pending_inspection",
              )
              .map(({ quarantine, product }) => (
                <form
                  key={quarantine.id}
                  action={resolveQuarantineAction}
                  className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                >
                  <input
                    type="hidden"
                    name="id"
                    value={quarantine.id}
                  />

                  <div>
                    <p className="text-xs font-semibold">
                      {product} ·{" "}
                      {number(quarantine.quantity, 3)} units
                    </p>

                    <p className="text-[10px] text-slate-500">
                      {quarantine.reason}
                    </p>
                  </div>

                  <div>
                    <label className="field-label">
                      Disposal / resolution notes
                    </label>

                    <input
                      name="notes"
                      required
                      minLength={5}
                      className="field"
                    />
                  </div>

                  <button className="min-h-11 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white">
                    Mark disposed
                  </button>
                </form>
              ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">
          Exchange history
        </h2>

        <DataTable
          headers={[
            "Date",
            "Original product",
            "Replacement product",
            "Returned qty",
            "Replacement qty",
            "Price difference",
            "Approved by",
            "Inspection",
          ]}
          rows={exchangeRows.map(
            ({
              exchange,
              original,
              replacementId,
              staff,
            }) => [
              dateTime(exchange.createdAt),
              original,
              productRows.find(
                (product) => product.id === replacementId,
              )?.name ?? "—",
              number(exchange.quantity, 3),
              number(exchange.replacementQuantity, 3),
              money(exchange.priceDifference),
              staff,
              <span
                key={`${exchange.id}-inspection`}
                className={`badge ${
                  exchange.inspected
                    ? "badge-gray"
                    : "badge-amber"
                }`}
              >
                {exchange.inspected
                  ? "Quarantine resolved"
                  : "Pending"}
              </span>,
            ],
          )}
        />
      </section>
    </>
  );
}
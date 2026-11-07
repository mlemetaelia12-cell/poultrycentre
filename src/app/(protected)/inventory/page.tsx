import { asc, eq } from "drizzle-orm";
import { CalendarClock, PackageSearch, SlidersHorizontal } from "lucide-react";
import { getDb } from "@/db";
import { batches, products } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { adjustStockAction } from "@/lib/actions";
import { dateOnly, money, number, todayDateTz } from "@/lib/format";

export default async function InventoryPage() {
  const db = getDb();
  const [batchRows, productRows] = await Promise.all([
    db.select({ batch: batches, product: products.name, sku: products.sku }).from(batches).innerJoin(products, eq(products.id, batches.productId)).orderBy(asc(batches.expiryDate)).limit(500),
    db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
  ]);
  const today = todayDateTz();
  const activeStock = batchRows.filter((row) => Number(row.batch.quantityRemaining) > 0 && row.batch.expiryDate >= today);
  const expiring = activeStock.filter((row) => row.batch.expiryDate <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
  const expired = batchRows.filter((row) => Number(row.batch.quantityRemaining) > 0 && row.batch.expiryDate < today);
  return <>
    <PageHeader title="Inventory & batch control" description="Every batch is tracked independently. POS uses first-expiry-first-out (FEFO) and rejects expired batches." />
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="card p-4"><p className="text-xs text-slate-500">Active batches</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{activeStock.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Expiring within 90 days</p><p className="mt-2 text-2xl font-extrabold text-amber-700">{expiring.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Expired with stock</p><p className="mt-2 text-2xl font-extrabold text-red-700">{expired.length}</p></div><div className="card p-4"><p className="text-xs text-slate-500">Product records</p><p className="mt-2 text-2xl font-extrabold text-slate-800">{productRows.length}</p></div></div>
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={18} className="text-forest-700" /><div><h2 className="section-title">Record stock adjustment</h2><p className="section-subtitle">Use for verified corrections, damage, expiry or loss. Every adjustment is retained in stock history and audit logs.</p></div></div>
      <ActionForm action={adjustStockAction} submitLabel="Record adjustment" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div><label className="field-label">Product *</label><select name="productId" className="field" required defaultValue=""><option value="" disabled>Select product</option>{productRows.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></div>
        <div><label className="field-label">Batch ID *</label><select name="batchId" className="field" required defaultValue=""><option value="" disabled>Select batch</option>{batchRows.map(({ batch, product }) => <option key={batch.id} value={batch.id}>{product} · {batch.batchNumber} · {dateOnly(batch.expiryDate)}</option>)}</select></div>
        <div><label className="field-label">Direction *</label><select name="direction" className="field"><option value="in">Add stock</option><option value="out">Remove stock</option></select></div>
        <div><label className="field-label">Quantity *</label><input name="quantity" type="number" min="0.001" step="0.001" required className="field" /></div>
        <div><label className="field-label">Reason type</label><select name="reasonType" className="field"><option value="count_correction">Stock count correction</option><option value="damage">Damaged stock</option><option value="expiry">Expired stock</option><option value="loss">Lost stock</option><option value="other">Other adjustment</option></select></div>
        <div><label className="field-label">Reason *</label><input name="reason" required minLength={5} className="field" placeholder="Describe the adjustment…" /></div>
      </ActionForm>
    </section>
    <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center gap-2"><PackageSearch size={18} className="text-forest-700" /><h2 className="section-title">Stock batches</h2></div>
      <DataTable headers={["Product", "SKU", "Batch", "Expiry", "Remaining", "Unit cost", "Stock value", "Condition"]} rows={batchRows.map(({ batch, product, sku }) => {
        const expiredBatch = batch.expiryDate < today;
        const qty = Number(batch.quantityRemaining);
        return [<span className="font-semibold">{product}</span>, sku, batch.batchNumber, <span className={expiredBatch ? "font-semibold text-red-600" : batch.expiryDate <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) ? "font-semibold text-amber-700" : ""}>{dateOnly(batch.expiryDate)}</span>, number(qty, 3), money(batch.unitCost), money(qty * Number(batch.unitCost)), <span className={`badge ${qty <= 0 ? "badge-gray" : expiredBatch ? "badge-red" : batch.expiryDate <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) ? "badge-amber" : "badge-green"}`}>{qty <= 0 ? "Depleted" : expiredBatch ? "Expired · Blocked" : "Sellable"}</span>];
      })} />
      <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400"><CalendarClock size={14} /> Expired batches remain in history and must be formally adjusted out; they cannot be sold through POS.</p>
    </section>
  </>;
}

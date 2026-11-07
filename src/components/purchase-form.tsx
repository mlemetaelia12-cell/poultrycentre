"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { receivePurchaseAction, type ActionState } from "@/lib/actions";
import { money, todayDateTz } from "@/lib/format";

type Unit = { unitName: string; baseQuantity: string };
type Product = { id: string; name: string; sku: string; baseUnit: string; buyingPrice: string; units: Unit[] };
type Supplier = { id: string; name: string };
type Line = { productId: string; productName: string; batchNumber: string; expiryDate: string; quantity: number; baseQuantity: number; unitCost: number; baseUnit: string };

export function PurchaseForm({ products, suppliers }: { products: Product[]; suppliers: Supplier[] }) {
  const [state, formAction, pending] = useActionState(receivePurchaseAction, {} as ActionState);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => { if (!idempotencyKey) setIdempotencyKey(crypto.randomUUID()); }, [idempotencyKey]);
  useEffect(() => {
    if (!state.success) return;
    setItems([]);
    setInvoiceNumber("");
    setNotes("");
    setPaymentReference("");
    setIdempotencyKey(crypto.randomUUID());
  }, [state.success]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selected = products.find((p) => p.id === productId);
  const [unitName, setUnitName] = useState(selected?.baseUnit ?? "piece");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState(selected?.buyingPrice ?? "0");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const factor = Number(selected?.units.find((u) => u.unitName === unitName)?.baseQuantity ?? 1);
  const baseCost = Number(unitCost) / factor;
  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), [items]);

  function addItem() {
    if (!selected || !batchNumber.trim() || !expiryDate || Number(quantity) <= 0 || Number(unitCost) < 0) return;
    setItems((current) => [...current, { productId: selected.id, productName: selected.name, batchNumber: batchNumber.trim(), expiryDate, quantity: Number(quantity) * factor, baseQuantity: Number(quantity) * factor, unitCost: baseCost, baseUnit: selected.baseUnit }]);
    setBatchNumber(""); setExpiryDate(""); setQuantity("1");
  }

  return <form action={formAction} className="min-w-0 space-y-4">
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="supplierId" value={supplierId} /><input type="hidden" name="invoiceNumber" value={invoiceNumber} /><input type="hidden" name="notes" value={notes} /><input type="hidden" name="paymentMethod" value={paymentMethod} /><input type="hidden" name="paymentReference" value={paymentReference} />
    <input type="hidden" name="items" value={JSON.stringify(items.map((item) => ({ productId: item.productId, batchNumber: item.batchNumber, expiryDate: item.expiryDate, quantity: item.baseQuantity, unitCost: item.unitCost })))} />
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label">Supplier</label><select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="field-label">Supplier invoice number</label><input className="field" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className="xl:col-span-2"><label className="field-label">Product *</label><select className="field" value={productId} onChange={(e) => { const value = e.target.value; const product = products.find((p) => p.id === value); setProductId(value); setUnitName(product?.baseUnit ?? "piece"); setUnitCost(product?.buyingPrice ?? "0"); }}><option value="">Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
      <div><label className="field-label">Purchase unit</label><select className="field" value={unitName} onChange={(e) => { const nextUnit = e.target.value; const nextFactor = Number(selected?.units.find((u) => u.unitName === nextUnit)?.baseQuantity ?? 1); setUnitName(nextUnit); setUnitCost((Number(selected?.buyingPrice ?? 0) * nextFactor).toFixed(2)); }}><option value={selected?.baseUnit}>{selected?.baseUnit}</option>{selected?.units.map((u) => <option key={u.unitName} value={u.unitName}>{u.unitName} ({u.baseQuantity})</option>)}</select></div>
      <div><label className="field-label">Quantity</label><input className="field" type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
      <div><label className="field-label">Cost per purchase unit</label><input className="field" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div>
      <div><label className="field-label">Batch number *</label><input className="field" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Batch code" /></div>
      <div><label className="field-label">Expiry date *</label><input className="field" type="date" min={todayDateTz()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
      <div className="flex items-end xl:col-span-6"><div className="flex-1 text-[11px] text-slate-500">Stock entry: {Number(quantity) * factor || 0} {selected?.baseUnit ?? "base units"} · Cost per base unit: {money(baseCost)}</div><button type="button" onClick={addItem} className="min-h-10 rounded-xl bg-forest-700 px-4 text-xs font-semibold text-white">Add batch line</button></div>
    </div>
    <div className="table-wrap min-w-0 max-w-full"><table className="data-table"><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th>Qty (base)</th><th>Cost / base</th><th>Line total</th><th /></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`${item.productId}-${item.batchNumber}-${index}`}><td className="font-semibold">{item.productName}</td><td>{item.batchNumber}</td><td>{item.expiryDate}</td><td>{item.baseQuantity} {item.baseUnit}</td><td>{money(item.unitCost)}</td><td>{money(item.quantity * item.unitCost)}</td><td><button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-600">Remove</button></td></tr>) : <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">No purchase lines added.</td></tr>}</tbody></table></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div><label className="field-label">Paid using *</label><select className="field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="mixx">Mixx by Yas</option><option value="airtel_money">Airtel Money</option><option value="halopesa">HaloPesa</option><option value="bank_transfer">Bank transfer</option></select></div><div><label className="field-label">Payment reference</label><input className="field" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></div><div className="sm:col-span-2"><label className="field-label">Notes</label><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></div></div><p className="text-right text-lg font-extrabold text-slate-800">Purchase total: {money(total)}</p>
    {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</p>}
    <button disabled={pending || !idempotencyKey || items.length === 0} className="min-h-11 rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Receiving stock…" : "Receive purchase & stock"}</button>
    <p className="text-[11px] leading-5 text-slate-500">Supplier payments are made immediately outside this system in V1. Record the supplier invoice/reference in notes; no supplier-credit ledger is enabled.</p>
  </form>;
}

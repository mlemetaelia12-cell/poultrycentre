"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/lib/actions";
import { createSaleAction, saveDraftOrderAction } from "@/lib/actions";
import { money } from "@/lib/format";

type Unit = { unitName: string; barcode: string | null; baseQuantity: string; retailPrice: string | null; wholesalePrice: string | null };
type Product = { id: string; sku: string; barcode: string | null; name: string; baseUnit: string; retailPrice: string; wholesalePrice: string; minimumPrice: string; units: Unit[] };
type Customer = { id: string; name: string; phone: string | null; creditLimit: string };
type CartLine = { productId: string; productName: string; unitName: string; quantity: number; unitPrice: number; baseQuantity: number };
type Payment = { method: string; amount: string; reference: string };

const paymentOptions = [{ value: "cash", label: "Cash" }, { value: "mpesa", label: "M-Pesa" }, { value: "mixx", label: "Mixx by Yas" }, { value: "airtel_money", label: "Airtel Money" }, { value: "halopesa", label: "HaloPesa" }, { value: "bank_transfer", label: "Bank transfer" }];

type InitialDraft = { id: string; customerId: string | null; customerName: string | null; customerPhone: string | null; deliveryLocation: string | null; saleType: "retail" | "wholesale"; discount: string; notes: string | null; items: CartLine[] };

export function PosForm({ products, customers, initialDraft }: { products: Product[]; customers: Customer[]; initialDraft?: InitialDraft | null }) {
  const [state, formAction, pending] = useActionState(createSaleAction, {} as ActionState);
  const [draftState, draftFormAction, draftPending] = useActionState(saveDraftOrderAction, {} as ActionState);
  const [draftOrderId, setDraftOrderId] = useState(initialDraft?.id ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => { if (!idempotencyKey) setIdempotencyKey(crypto.randomUUID()); }, [idempotencyKey]);
  useEffect(() => {
    if (!state.success) return;
    setCart([]);
    setPayments([{ method: "cash", amount: "", reference: "" }]);
    setDiscount("0");
    setNotes("");
    setIdempotencyKey(crypto.randomUUID());
  }, [state.success]);
  useEffect(() => { if (draftState.draftOrderId) setDraftOrderId(draftState.draftOrderId); }, [draftState.draftOrderId]);
  const [saleType, setSaleType] = useState<"retail" | "wholesale">(initialDraft?.saleType ?? "retail");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [productSearch, setProductSearch] = useState("");
  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((product) => [product.name, product.sku, product.barcode ?? "", ...product.units.map((unit) => unit.barcode ?? "")].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [productSearch, products]);
  const selected = products.find((p) => p.id === productId);
  function selectScannedProduct(query: string) {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return;
    const found = products.find((product) => product.name.toLocaleLowerCase() === value || product.barcode?.toLocaleLowerCase() === value || product.sku.toLocaleLowerCase() === value || product.units.some((unit) => unit.barcode?.toLocaleLowerCase() === value));
    if (!found) return;
    setProductId(found.id);
    const matchedUnit = found.units.find((unit) => unit.barcode?.toLocaleLowerCase() === value);
    setUnitName(matchedUnit?.unitName ?? found.baseUnit);
    setProductSearch("");
  }
  const [unitName, setUnitName] = useState(selected?.baseUnit ?? "piece");
  const selectedUnit = selected?.units.find((u) => u.unitName === unitName);
  const factor = Number(selectedUnit?.baseQuantity ?? 1);
  const defaultPrice = selectedUnit ? (saleType === "retail" ? selectedUnit.retailPrice : selectedUnit.wholesalePrice) : null;
  const basePrice = Number((saleType === "retail" ? selected?.retailPrice : selected?.wholesalePrice) ?? 0);
  const price = Number(defaultPrice ?? basePrice * factor);
  const [quantity, setQuantity] = useState("1");
  const [cart, setCart] = useState<CartLine[]>(initialDraft?.items ?? []);
  const [customerId, setCustomerId] = useState(initialDraft?.customerId ?? "");
  const [customerName, setCustomerName] = useState(initialDraft?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialDraft?.customerPhone ?? "");
  const [deliveryLocation, setDeliveryLocation] = useState(initialDraft?.deliveryLocation ?? "");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(initialDraft?.discount ?? "0");
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: "", reference: "" }]);
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice * 100), 0) / 100, [cart]);
  const total = Math.max(0, subtotal - Math.max(0, Number(discount) || 0));
  const paid = payments.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const due = Math.max(0, total - paid);

  function addLine() {
    if (!selected || Number(quantity) <= 0 || price <= 0) return;
    const qty = Number(quantity);
    const existingIndex = cart.findIndex((line) => line.productId === selected.id && line.unitName === unitName && line.unitPrice === price);
    if (existingIndex >= 0) setCart((current) => current.map((line, i) => i === existingIndex ? { ...line, quantity: line.quantity + qty, baseQuantity: (line.quantity + qty) * factor } : line));
    else setCart((current) => [...current, { productId: selected.id, productName: selected.name, unitName, quantity: qty, unitPrice: price, baseQuantity: qty * factor }]);
    setQuantity("1");
  }

  function changeSaleType(value: "retail" | "wholesale") {
    setSaleType(value);
    setCart([]);
  }
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  return <form action={formAction} className="min-w-0 space-y-5">
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="draftOrderId" value={draftOrderId} />
    <input type="hidden" name="customerName" value={customerName} /><input type="hidden" name="customerPhone" value={customerPhone} /><input type="hidden" name="deliveryLocation" value={deliveryLocation} />
    <input type="hidden" name="items" value={JSON.stringify(cart.map(({ productId, quantity, unitName, unitPrice }) => ({ productId, quantity, unitName, unitPrice })))} />
    <input type="hidden" name="payments" value={JSON.stringify(payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference })))} />
    <input type="hidden" name="saleType" value={saleType} /><input type="hidden" name="customerId" value={customerId} /><input type="hidden" name="dueDate" value={dueDate} /><input type="hidden" name="discount" value={discount} /><input type="hidden" name="notes" value={notes} />
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="section-title">Build sale</h2><p className="section-subtitle">Select products and scan or type barcode/SKU using search.</p></div><div className="inline-flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => changeSaleType("retail")} className={`rounded-lg px-4 py-2 text-xs font-semibold ${saleType === "retail" ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>Retail</button><button type="button" onClick={() => changeSaleType("wholesale")} className={`rounded-lg px-4 py-2 text-xs font-semibold ${saleType === "wholesale" ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>Wholesale</button></div></div>
        <div className="card grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <div className="min-w-0"><label className="field-label" htmlFor="pos-product-search">Find product or scan barcode/SKU *</label><input id="pos-product-search" className="field mb-2" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); selectScannedProduct(productSearch); } }} placeholder="Type product, SKU or scan barcode" /><select className="field" value={productId} onChange={(event) => { const next = products.find((item) => item.id === event.target.value); setProductId(event.target.value); setUnitName(next?.baseUnit ?? "piece"); setProductSearch(""); }}><option value="">Select product</option>{matchingProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}{!matchingProducts.length && <option value="" disabled>No matching product</option>}</select></div>
          <div><label className="field-label">Unit</label><select className="field" value={unitName} onChange={(e) => setUnitName(e.target.value)} disabled={!selected}><option value={selected?.baseUnit}>{selected?.baseUnit}</option>{selected?.units.map((unit) => <option key={unit.unitName} value={unit.unitName}>{unit.unitName} ({unit.baseQuantity} base units)</option>)}</select></div>
          <div><label className="field-label">Quantity</label><input className="field" type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <button type="button" onClick={addLine} disabled={!selected || price <= 0} className="min-h-11 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Add item</button>
          <div className="sm:col-span-4"><p className="text-[11px] text-slate-500">Configured unit price: <strong className="text-slate-800">{money(price)}</strong> · Base stock required per selected unit: {factor}</p></div>
        </div>
        <div className="table-wrap min-w-0 max-w-full"><table className="data-table"><thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit price</th><th>Total</th><th /></tr></thead><tbody>
          {cart.length ? cart.map((line, index) => <tr key={`${line.productId}-${line.unitName}-${index}`}><td className="font-semibold">{line.productName}</td><td>{line.unitName}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td className="font-semibold">{money(line.quantity * line.unitPrice)}</td><td><button type="button" onClick={() => setCart((current) => current.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">Remove</button></td></tr>) : <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">Basket is empty. Add at least one product.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="space-y-4">
        <section className="card p-4"><h2 className="section-title">Customer & payment</h2><div className="mt-4 space-y-3"><div><label className="field-label">Customer (required for credit)</label><select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in customer / no credit</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></div>
          <div className="grid gap-2 sm:grid-cols-2"><div><label className="field-label">Customer name (optional for walk-in)</label><input className="field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={180} placeholder="Customer / company name" /></div><div><label className="field-label">Customer phone</label><input className="field" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={32} placeholder="Phone number" /></div></div>
          <div><label className="field-label">Delivery location / destination</label><textarea className="field" rows={2} value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} maxLength={1000} placeholder="Where should this order be delivered?" /></div>{selectedCustomer && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">Customer credit limit: <strong>{money(selectedCustomer.creditLimit)}</strong></p>}
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Split payments</h3><button type="button" onClick={() => setPayments((current) => [...current, { method: "mpesa", amount: "", reference: "" }])} className="text-xs font-semibold text-forest-700">+ Add payment</button></div>
          {payments.map((payment, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><select className="field" value={payment.method} onChange={(e) => setPayments((current) => current.map((p, i) => i === index ? { ...p, method: e.target.value } : p))}>{paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="field" type="number" min="0" step="0.01" placeholder="Amount" value={payment.amount} onChange={(e) => setPayments((current) => current.map((p, i) => i === index ? { ...p, amount: e.target.value } : p))} /><button type="button" aria-label="Remove payment" onClick={() => setPayments((current) => current.filter((_, i) => i !== index))} className="px-2 text-xs text-red-600">×</button><input className="field col-span-3" placeholder="Payment reference (optional)" value={payment.reference} onChange={(e) => setPayments((current) => current.map((p, i) => i === index ? { ...p, reference: e.target.value } : p))} /></div>)}
          {due > 0 && <div><label className="field-label">Credit due date (optional)</label><input className="field" type="date" min={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Dar_es_Salaam" })} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><p className="mt-1 text-[10px] text-slate-500">Set when the customer should clear the outstanding balance.</p></div>}
          <div><label className="field-label">Discount (TZS) · Manager/Owner approval required</label><input className="field" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div><label className="field-label">Notes</label><textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div></section>
        
<section
  className="card p-5"
  style={{
    backgroundColor: "#14532D",
    color: "#FFFFFF",
  }}
>
  <div className="flex justify-between text-sm">
    <span style={{ color: "#D1FAE5" }}>Subtotal</span>
    <span style={{ color: "#FFFFFF" }}>{money(subtotal)}</span>
  </div>

  <div className="mt-2 flex justify-between text-sm">
    <span style={{ color: "#D1FAE5" }}>Discount</span>
    <span style={{ color: "#FFFFFF" }}>− {money(discount)}</span>
  </div>

  <div className="mt-4 border-t border-white/20 pt-4">
    <div className="flex items-end justify-between">
      <span className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>
        Total due
      </span>
      <span className="text-2xl font-extrabold" style={{ color: "#FFFFFF" }}>
        {money(total)}
      </span>
    </div>

    <div className="mt-3 flex justify-between text-xs">
      <span style={{ color: "#D1FAE5" }}>Amount entered</span>
      <span style={{ color: "#FFFFFF" }}>{money(paid)}</span>
    </div>

    <div className="mt-1 flex justify-between text-xs">
      <span style={{ color: "#FDE68A" }}>Customer balance</span>
      <span style={{ color: "#FDE68A" }}>{money(due)}</span>
    </div>
  </div>

  {state.error && (
    <p
      role="alert"
      className="mt-4 rounded-lg p-3 text-xs"
      style={{ backgroundColor: "#7F1D1D", color: "#FFFFFF" }}
    >
      {state.error}
    </p>
  )}

  {state.success && (
    <p role="status" className="mt-4 rounded-lg p-3 text-xs" style={{ backgroundColor: "#064E3B", color: "#FFFFFF" }}>{state.success}</p>
  )}
  {draftState.error && <p role="alert" className="mt-3 rounded-lg bg-red-100 p-3 text-xs text-red-800">{draftState.error}</p>}
  {draftState.success && <p role="status" className="mt-3 rounded-lg bg-emerald-100 p-3 text-xs text-emerald-800">{draftState.success}</p>}
  <button type="submit" formAction={draftFormAction} disabled={draftPending || pending || !idempotencyKey || cart.length === 0 || total <= 0} className="mt-4 min-h-12 w-full rounded-xl border border-white/40 bg-white px-4 text-sm font-bold text-forest-800 disabled:opacity-50">{draftPending ? "Saving draft..." : draftOrderId ? "Update draft order" : "Save as draft order"}</button>
  {
<button
  type="submit"
  disabled={
    pending ||
    !idempotencyKey ||
    cart.length === 0 ||
    total <= 0 ||
    paid > total + 0.001 ||
    (due > 0 && !customerId)
  }
  style={{
    display: "block",
    width: "100%",
    minHeight: "52px",
    marginTop: "16px",
    backgroundColor: "#A3E635",
    color: "#14532D",
    WebkitTextFillColor: "#14532D",
    fontSize: "14px",
    fontWeight: 900,
    borderRadius: "12px",
    opacity: 1,
  }}
>
  {pending
    ? "Processing sale..."
    : due > 0
      ? "Complete sale · Record balance"
      : "Complete sale"}
</button>
}

  <p
    className="mt-3 text-center text-[10px] leading-4"
    style={{ color: "#D1FAE5" }}
  >
    Stock is deducted using FEFO inside a database transaction.
    Expired batches cannot be sold.
  </p>
</section>

      </div>
    </div>
  </form>;
}

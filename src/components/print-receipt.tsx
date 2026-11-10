"use client";

import { useState } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";
import { money, dateTime } from "@/lib/format";
import type { Locale } from "@/i18n/messages";

type Receipt = { businessName: string; phone: string | null; address: string | null; receiptNumber: string; createdAt: Date; cashier: string; customer: string | null; saleType: string; subtotal: string; discount: string; total: string; amountPaid: string; balanceDue: string; notes: string | null; items: Array<{ name: string; sku: string; unitName: string; quantity: string; unitPrice: string; lineTotal: string }>; payments: Array<{ method: string; amount: string; reference: string | null; paymentType: string }> };

export function PrintReceipt({ receipt, locale = "en" }: { receipt: Receipt; locale?: Locale }) {
  const [layout, setLayout] = useState<"thermal" | "a4">("thermal");
  const sw = locale === "sw";
  return <>
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs text-slate-500">{sw ? "Chagua ukubwa wa risiti. Unaweza kuchagua Save as PDF kwenye dirisha la kuchapisha." : "Choose a print size. You can select Save as PDF in the print dialog."}</p>
        <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
          <button onClick={() => setLayout("thermal")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${layout === "thermal" ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>80mm thermal</button>
          <button onClick={() => setLayout("a4")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${layout === "a4" ? "bg-white text-forest-800 shadow-sm" : "text-slate-500"}`}>A4</button>
        </div>
      </div>
      <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-700 px-5 text-sm font-semibold text-white"><Printer size={16} /> {sw ? "Chapisha / Hifadhi PDF" : "Print / Save PDF"}</button>
    </div>
    <div className={`print-area mx-auto bg-white text-slate-900 ${layout === "thermal" ? "max-w-[340px] p-5" : "max-w-[800px] p-8 sm:p-12"}`}>
      <div className="text-center">
        <Image src="/poultry-farm-logo.jpeg" alt="Poultry Farm logo" width={240} height={240} priority className={`mx-auto mb-2 h-auto object-contain ${layout === "thermal" ? "w-[78px]" : "w-[125px]"}`} />
        <div className="text-xl font-black tracking-[.08em]">POULTRY CENTRE</div>
        {receipt.address && <p className="mt-1 text-xs">{receipt.address}</p>}
        {receipt.phone && <p className="text-xs">{sw ? "Simu" : "Tel"}: {receipt.phone}</p>}
        <p className="mt-3 border-y border-dashed border-slate-400 py-2 text-xs font-bold tracking-[.12em]">{sw ? "RISITI YA MAUZO · NAKALA YA BIASHARA" : "SALES RECEIPT · INTERNAL COPY"}</p>
      </div>
      <div className="my-4 space-y-1 text-xs">
        <div className="flex justify-between gap-3"><span>{sw ? "Risiti" : "Receipt"}</span><strong>{receipt.receiptNumber}</strong></div>
        <div className="flex justify-between gap-3"><span>{sw ? "Tarehe" : "Date"}</span><span>{dateTime(receipt.createdAt)}</span></div>
        <div className="flex justify-between gap-3"><span>{sw ? "Aliyehudumia" : "Served by"}</span><span>{receipt.cashier}</span></div>
        <div className="flex justify-between gap-3"><span>{sw ? "Mteja" : "Customer"}</span><span>{receipt.customer ?? (sw ? "Mteja wa kawaida" : "Walk-in")}</span></div>
        <div className="flex justify-between gap-3"><span>{sw ? "Aina ya mauzo" : "Sale type"}</span><span className="capitalize">{receipt.saleType}</span></div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead><tr className="border-y border-slate-400"><th className="py-2 text-left">{sw ? "Bidhaa" : "Item"}</th><th className="py-2 text-right">{sw ? "Idadi" : "Qty"}</th><th className="py-2 text-right">{sw ? "Bei" : "Price"}</th><th className="py-2 text-right">{sw ? "Jumla" : "Total"}</th></tr></thead>
        <tbody>{receipt.items.map((item, index) => <tr key={index} className="border-b border-dashed border-slate-300"><td className="py-2 pr-2"><div className="font-semibold">{item.name}</div><div className="text-[10px] text-slate-500">{item.sku} · {item.unitName}</div></td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{money(item.unitPrice)}</td><td className="py-2 text-right">{money(item.lineTotal)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-4 max-w-[250px] space-y-2 text-xs">
        <div className="flex justify-between"><span>{sw ? "Jumla kabla ya punguzo" : "Subtotal"}</span><span>{money(receipt.subtotal)}</span></div>
        <div className="flex justify-between"><span>{sw ? "Punguzo" : "Discount"}</span><span>{money(receipt.discount)}</span></div>
        <div className="flex justify-between border-t border-slate-400 pt-2 text-base font-black"><span>{sw ? "Jumla" : "Total"}</span><span>{money(receipt.total)}</span></div>
        <div className="flex justify-between"><span>{sw ? "Iliyolipwa" : "Paid"}</span><span>{money(receipt.amountPaid)}</span></div>
        <div className="flex justify-between font-bold"><span>{sw ? "Salio" : "Balance"}</span><span>{money(receipt.balanceDue)}</span></div>
      </div>
      {receipt.payments.length > 0 && <div className="mt-5 text-xs"><p className="mb-2 font-bold">{sw ? "Malipo" : "Payments"}</p>{receipt.payments.map((payment, index) => <div key={index} className="flex justify-between gap-3"><span className="capitalize">{payment.method.replaceAll("_", " ")}{payment.paymentType !== "sale" ? ` · ${payment.paymentType.replaceAll("_", " ")}` : ""}{payment.reference ? ` · ${payment.reference}` : ""}</span><span>{money(payment.amount)}</span></div>)}</div>}
      {receipt.notes && <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-2 text-xs"><strong>{sw ? "Mahali / maelezo ya oda" : "Delivery / order details"}:</strong> {receipt.notes}</div>}
      <div className="mt-8 border-t border-dashed border-slate-400 pt-3 text-center text-[10px] leading-5">
        <p className="font-bold">{sw ? "Asante kwa kufanya biashara nasi." : "Thank you for your business."}</p>
        <p>{sw ? "Hii ni risiti ya ndani ya biashara; si risiti ya kodi ya EFD/VFD." : "This is an internal business receipt. It is not an EFD/VFD fiscal receipt."}</p>
        <p className="mt-2 font-semibold text-slate-500">+255 784 452 159</p>
        
      </div>
    </div>
    <style jsx>{`@media print { .print-area { ${layout === "thermal" ? "width: 80mm; max-width: 80mm; padding: 4mm; margin: 0;" : "width: 210mm; max-width: 210mm; padding: 15mm; margin: 0 auto;"} } @page { size: ${layout === "thermal" ? "80mm auto" : "A4"}; margin: ${layout === "thermal" ? "2mm" : "10mm"}; } }`}</style>
  </>;
}

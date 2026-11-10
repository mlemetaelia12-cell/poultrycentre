import { desc, eq } from "drizzle-orm";
import { Truck, UserPlus } from "lucide-react";
import { getDb } from "@/db";
import { purchases, suppliers, users, products, purchaseItems, unitConversions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { createSupplierAction } from "@/lib/actions";
import { PurchaseForm } from "@/components/purchase-form";
import { dateTime, money } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export default async function PurchasesPage() {
  const db = getDb();
  const locale = await getLocale();
  const sw = locale === "sw";
  const [productRows, units, supplierRows, purchaseRows, itemRows] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(products.name), db.select().from(unitConversions),
    db.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(suppliers.name),
    db.select({ purchase: purchases, supplier: suppliers.name, staff: users.displayName }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id)).innerJoin(users, eq(purchases.createdBy, users.id)).orderBy(desc(purchases.createdAt)).limit(100),
    db.select({ purchaseId: purchaseItems.purchaseId, count: purchaseItems.id }).from(purchaseItems),
  ]);
  const productProps = productRows.map((p) => ({ id: p.id, name: p.name, sku: p.sku, baseUnit: p.baseUnit, buyingPrice: p.buyingPrice, units: units.filter((u) => u.productId === p.id).map((u) => ({ unitName: u.unitName, baseQuantity: u.baseQuantity })) }));
  const lineCounts = new Map<string, number>(); for (const item of itemRows) lineCounts.set(item.purchaseId, (lineCounts.get(item.purchaseId) ?? 0) + 1);
  return <>
    <PageHeader title={sw ? "Manunuzi na wasambazaji" : "Purchases & suppliers"} description={sw ? "Pokea bidhaa kutoka kwa wasambazaji na hifadhi namba za ankara, mafungu, tarehe za mwisho na gharama." : "Receive supplier stock with invoice references, batch numbers, expiry dates and actual purchase costs."} />
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><Truck className="text-forest-700" size={19} /><div><h2 className="section-title">{sw ? "Pokea manunuzi" : "Receive a purchase"}</h2><p className="section-subtitle">{sw ? "Kila bidhaa itakayopokelewa itaongeza stoo na historia ya mabadiliko." : "Every received line creates a batch and an auditable stock movement."}</p></div></div><PurchaseForm products={productProps} suppliers={supplierRows.map((s) => ({ id: s.id, name: s.name }))} locale={locale} /></section>
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><UserPlus className="text-forest-700" size={19} /><h2 className="section-title">{sw ? "Ongeza msambazaji" : "Add supplier"}</h2></div><ActionForm action={createSupplierAction} submitLabel={sw ? "Ongeza msambazaji" : "Add supplier"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div><label className="field-label">{sw ? "Jina la msambazaji *" : "Supplier name *"}</label><input name="name" required className="field" /></div><div><label className="field-label">{sw ? "Mtu wa mawasiliano" : "Contact person"}</label><input name="contactPerson" className="field" /></div><div><label className="field-label">{sw ? "Simu" : "Phone"}</label><input name="phone" className="field" /></div><div><label className="field-label">{sw ? "Barua pepe" : "Email"}</label><input name="email" type="email" className="field" /></div><div><label className="field-label">{sw ? "Anuani" : "Address"}</label><input name="address" className="field" /></div></ActionForm></section>
    <h2 className="section-title mb-3">{sw ? "Historia ya manunuzi" : "Purchase history"}</h2><DataTable headers={sw ? ["Rejea", "Tarehe", "Msambazaji", "Ankara", "Bidhaa", "Jumla", "Amepokea"] : ["Reference", "Date", "Supplier", "Invoice", "Lines", "Total", "Received by"]} rows={purchaseRows.map(({ purchase, supplier, staff }) => [<span key={`${purchase.id}-reference`} className="font-semibold">{purchase.reference}</span>, dateTime(purchase.purchasedAt), supplier ?? "—", purchase.invoiceNumber ?? "—", lineCounts.get(purchase.id) ?? 0, money(purchase.subtotal), staff])} />
  </>;
}

import { desc, eq, gte, gt, sql, and } from "drizzle-orm";
import { Plus, Package } from "lucide-react";
import { getDb } from "@/db";
import { batches, categories, products, unitConversions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ProductCreateForm } from "@/components/product-create-form";
import { money, number, todayDateTz } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { setProductActiveAction, updateProductPricingAction } from "@/lib/actions";
import { getLocale } from "@/i18n/server";
import Link from "next/link";

export default async function ProductsPage() {
  const actor = await requireUser();
  const locale = await getLocale();
  const sw = locale === "sw";
  const canManageProducts = actor.role === "owner" || actor.role === "manager";
  const canViewPrices = actor.role !== "stock_attendant";
  const db = getDb();
  const [categoryRows, productRows, conversionRows, stockRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(categories.name),
    db.select({ product: products, category: categories.name }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt)).limit(200),
    db.select({ productId: unitConversions.productId, unitName: unitConversions.unitName, baseQuantity: unitConversions.baseQuantity }).from(unitConversions),
    db.select({ productId: batches.productId, quantity: sql<string>`COALESCE(SUM(${batches.quantityRemaining}), 0)` }).from(batches).where(and(gte(batches.expiryDate, todayDateTz()), gt(batches.quantityRemaining, "0"))).groupBy(batches.productId),
  ]);
  const stockMap = new Map(stockRows.map((row) => [row.productId, Number(row.quantity)]));
  const conversionMap = new Map<string, string[]>();
  for (const item of conversionRows) conversionMap.set(item.productId, [...(conversionMap.get(item.productId) ?? []), `${item.unitName} = ${number(item.baseQuantity, 3)} base units`]);
  return <>
    <PageHeader title={sw ? "Bidhaa na stoo" : "Products & stock"} description={sw ? "Ongeza bidhaa, angalia bei na hakiki kiasi kilichopo." : "Add products, view prices and check available stock."} action={<Link href="/purchases" className="inline-flex min-h-10 items-center rounded-xl bg-forest-700 px-4 text-xs font-bold text-white">{sw ? "Pokea bidhaa / ongeza stoo" : "Receive stock"}</Link>} />
    {canManageProducts && <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="rounded-xl bg-forest-50 p-2 text-forest-700"><Plus size={18} /></span><div><h2 className="section-title">{sw ? "Ongeza bidhaa" : "Add a product"}</h2><p className="section-subtitle">{sw ? "Weka taarifa muhimu za bidhaa. Maelezo ya dawa ni kwa kumbukumbu tu." : "Enter the essential product details. Medicine references are for record-keeping only."}</p></div></div><ProductCreateForm categories={categoryRows} locale={locale} /></section>}
    <div className="mb-3 flex items-center gap-2"><Package size={18} className="text-forest-700" /><h2 className="section-title">{sw ? `Bidhaa (${productRows.length})` : `Products (${productRows.length})`}</h2></div>
    <DataTable headers={sw ? ["Bidhaa", "SKU / barcode", "Kundi", "Kipimo cha msingi", "Zilizopo", ...(canViewPrices ? ["Rejareja", "Jumla"] : []), "Vipimo", "Hali", ...(canManageProducts ? ["Simamia"] : [])] : ["Product", "SKU / barcode", "Category", "Base unit", "In stock", ...(canViewPrices ? ["Retail", "Wholesale"] : []), "Unit conversions", "Status", ...(canManageProducts ? ["Manage"] : [])]} rows={productRows.map(({ product, category }) => [<span key={`${product.id}-name`} className="font-semibold">{product.name}</span>, <span key={`${product.id}-sku`}>{product.sku}<br /><span className="text-xs text-slate-400">{product.barcode ?? (sw ? "Hakuna barcode" : "No barcode")}</span></span>, category ?? (sw ? "Bila kundi" : "Uncategorised"), product.baseUnit, number(stockMap.get(product.id) ?? 0, 3), ...(canViewPrices ? [money(product.retailPrice), money(product.wholesalePrice)] : []), <span key={`${product.id}-conversions`} className="text-xs text-slate-500">{(conversionMap.get(product.id) ?? []).join(" · ") || (sw ? "Kipimo cha msingi pekee" : "Base unit only")}</span>, <span key={`${product.id}-status`} className={`badge ${product.active ? "badge-green" : "badge-gray"}`}>{product.active ? (sw ? "Hai" : "Active") : (sw ? "Haifanyi kazi" : "Inactive")}</span>, ...(canManageProducts ? [<div key={`${product.id}-manage`} className="min-w-[220px] space-y-2"><details><summary className="cursor-pointer text-xs font-semibold text-forest-700">{sw ? "Hariri bei na kiwango cha stoo" : "Edit prices & reorder"}</summary><form action={updateProductPricingAction} className="mt-2 grid grid-cols-2 gap-2"><input type="hidden" name="productId" value={product.id} /><label className="text-[10px]">{sw ? "Bei ya kununua" : "Buying"}<input name="buyingPrice" type="number" min="0" step="0.01" defaultValue={product.buyingPrice} className="field mt-1" /></label><label className="text-[10px]">{sw ? "Rejareja" : "Retail"}<input name="retailPrice" type="number" min="0" step="0.01" defaultValue={product.retailPrice} className="field mt-1" /></label><label className="text-[10px]">{sw ? "Jumla" : "Wholesale"}<input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={product.wholesalePrice} className="field mt-1" /></label><label className="text-[10px]">{sw ? "Bei ya chini" : "Min. price"}<input name="minimumPrice" type="number" min="0" step="0.01" defaultValue={product.minimumPrice} className="field mt-1" /></label><label className="col-span-2 text-[10px]">{sw ? "Kiwango cha kuagiza" : "Reorder level"}<input name="reorderLevel" type="number" min="0" step="0.001" defaultValue={product.reorderLevel} className="field mt-1" /></label><button className="col-span-2 rounded-lg bg-forest-700 px-3 py-2 text-xs font-semibold text-white">{sw ? "Hifadhi bei" : "Save pricing"}</button></form></details><form action={setProductActiveAction}><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="active" value={String(!product.active)} /><button className={`text-xs font-semibold ${product.active ? "text-red-600" : "text-forest-700"}`}>{product.active ? (sw ? "Zima" : "Deactivate") : (sw ? "Washa" : "Activate")}</button></form></div>] : [])])} />
  </>;
}

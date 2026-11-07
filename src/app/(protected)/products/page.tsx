import { desc, eq } from "drizzle-orm";
import { Plus, Package } from "lucide-react";
import { getDb } from "@/db";
import { categories, products, unitConversions } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ProductCreateForm } from "@/components/product-create-form";
import { money, number } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { setProductActiveAction, updateProductPricingAction } from "@/lib/actions";

export default async function ProductsPage() {
  const actor = await requireUser();
  const canManageProducts = actor.role === "owner" || actor.role === "manager";
  const canViewPrices = actor.role !== "stock_attendant";
  const db = getDb();
  const [categoryRows, productRows, conversionRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(categories.name),
    db.select({ product: products, category: categories.name }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt)).limit(200),
    db.select({ productId: unitConversions.productId, unitName: unitConversions.unitName, baseQuantity: unitConversions.baseQuantity }).from(unitConversions),
  ]);
  const conversionMap = new Map<string, string[]>();
  for (const item of conversionRows) conversionMap.set(item.productId, [...(conversionMap.get(item.productId) ?? []), `${item.unitName} = ${number(item.baseQuantity, 3)} base units`]);
  return <>
    <PageHeader title="Product catalogue" description="Maintain products, prices, categories, barcodes and each product's own unit conversions." />
    {canManageProducts && <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="rounded-xl bg-forest-50 p-2 text-forest-700"><Plus size={18} /></span><div><h2 className="section-title">Add a product</h2><p className="section-subtitle">Product names and clinical references are informational only; this system does not diagnose or prescribe.</p></div></div><ProductCreateForm categories={categoryRows} /></section>}
    <div className="mb-3 flex items-center gap-2"><Package size={18} className="text-forest-700" /><h2 className="section-title">Products ({productRows.length})</h2></div>
    <DataTable headers={["Product", "SKU / barcode", "Category", "Base unit", ...(canViewPrices ? ["Retail", "Wholesale"] : []), "Unit conversions", "Status", ...(canManageProducts ? ["Manage"] : [])]} rows={productRows.map(({ product, category }) => [<span key={`${product.id}-name`} className="font-semibold">{product.name}</span>, <span key={`${product.id}-sku`}>{product.sku}<br /><span className="text-xs text-slate-400">{product.barcode ?? "No barcode"}</span></span>, category ?? "Uncategorised", product.baseUnit, ...(canViewPrices ? [money(product.retailPrice), money(product.wholesalePrice)] : []), <span key={`${product.id}-conversions`} className="text-xs text-slate-500">{(conversionMap.get(product.id) ?? []).join(" · ") || "Base unit only"}</span>, <span key={`${product.id}-status`} className={`badge ${product.active ? "badge-green" : "badge-gray"}`}>{product.active ? "Active" : "Inactive"}</span>, ...(canManageProducts ? [<div key={`${product.id}-manage`} className="min-w-[220px] space-y-2"><details><summary className="cursor-pointer text-xs font-semibold text-forest-700">Edit prices & reorder</summary><form action={updateProductPricingAction} className="mt-2 grid grid-cols-2 gap-2"><input type="hidden" name="productId" value={product.id} /><label className="text-[10px]">Buying<input name="buyingPrice" type="number" min="0" step="0.01" defaultValue={product.buyingPrice} className="field mt-1" /></label><label className="text-[10px]">Retail<input name="retailPrice" type="number" min="0" step="0.01" defaultValue={product.retailPrice} className="field mt-1" /></label><label className="text-[10px]">Wholesale<input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={product.wholesalePrice} className="field mt-1" /></label><label className="text-[10px]">Min. price<input name="minimumPrice" type="number" min="0" step="0.01" defaultValue={product.minimumPrice} className="field mt-1" /></label><label className="col-span-2 text-[10px]">Reorder level<input name="reorderLevel" type="number" min="0" step="0.001" defaultValue={product.reorderLevel} className="field mt-1" /></label><button className="col-span-2 rounded-lg bg-forest-700 px-3 py-2 text-xs font-semibold text-white">Save pricing</button></form></details><form action={setProductActiveAction}><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="active" value={String(!product.active)} /><button className={`text-xs font-semibold ${product.active ? "text-red-600" : "text-forest-700"}`}>{product.active ? "Deactivate" : "Activate"}</button></form></div>] : [])])} />
  </>;
}

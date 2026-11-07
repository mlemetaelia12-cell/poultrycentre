import { desc, eq } from "drizzle-orm";
import { Tags } from "lucide-react";
import { getDb } from "@/db";
import { categories, products } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { createCategoryAction, setCategoryActiveAction } from "@/lib/actions";

export default async function CategoriesPage() {
  const rows = await getDb().select({ category: categories, total: products.id }).from(categories).leftJoin(products, eq(products.categoryId, categories.id)).orderBy(desc(categories.createdAt));
  const summary = new Map<string, { category: typeof rows[number]["category"]; count: number }>();
  for (const row of rows) {
    const current = summary.get(row.category.id) ?? { category: row.category, count: 0 };
    if (row.total) current.count += 1;
    summary.set(row.category.id, current);
  }
  return <>
    <PageHeader title="Product categories" description="Manage the categories used by the product catalogue. Existing product records remain intact if a category is deactivated." />
    <section className="card mb-5 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><Tags size={18} className="text-forest-700" /><h2 className="section-title">Add category</h2></div><ActionForm action={createCategoryAction} submitLabel="Create category" className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><div><label className="field-label">Category name *</label><input name="name" required className="field" /></div><div><label className="field-label">Description</label><input name="description" className="field" /></div></ActionForm></section>
    <DataTable headers={["Category", "Description", "Products", "Status", ""]} rows={[...summary.values()].map(({ category, count }) => [<span key={`${category.id}-name`} className="font-semibold">{category.name}</span>, category.description ?? "—", count, <span key={`${category.id}-status`} className={`badge ${category.active ? "badge-green" : "badge-gray"}`}>{category.active ? "Active" : "Inactive"}</span>, <form key={`${category.id}-toggle`} action={setCategoryActiveAction}><input type="hidden" name="categoryId" value={category.id} /><input type="hidden" name="active" value={String(!category.active)} /><button className={`text-xs font-semibold ${category.active ? "text-red-600" : "text-forest-700"}`}>{category.active ? "Deactivate" : "Activate"}</button></form>])} />
  </>;
}

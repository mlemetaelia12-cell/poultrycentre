import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}

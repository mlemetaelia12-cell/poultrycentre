import type { ReactNode } from "react";
export function StatCard({ label, value, icon, accent = "green", note }: { label: string; value: string; icon: ReactNode; accent?: "green" | "amber" | "red" | "slate"; note?: string }) {
  const styles = { green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-700" };
  return <div className="card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`rounded-xl p-2 ${styles[accent]}`}>{icon}</span></div><p className="stat-value mt-3">{value}</p>{note && <p className="mt-1 text-[11px] text-slate-400">{note}</p>}</div>;
}

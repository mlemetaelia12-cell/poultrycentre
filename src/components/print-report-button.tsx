"use client";

import { Printer } from "lucide-react";

export function PrintReportButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-forest-800"><Printer size={15} />{label}</button>;
}

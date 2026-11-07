"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText, X } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { AIChat } from "./ai-chat";

export function FloatingAI({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/dashboard";
  return <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <div className="w-[min(430px,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-slate-900/10"><AIChat pagePath={pathname} locale={locale} compact /></div>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close POULTRY CENTRE AI" : "Open POULTRY CENTRE AI"} className="flex h-12 items-center gap-2 rounded-full bg-forest-800 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">{open ? <X size={16} /> : <MessageSquareText size={16} />}</span><span>{open ? (locale === "sw" ? "Funga AI" : "Close AI") : "POULTRY CENTRE AI"}</span></button>
  </div>;
}

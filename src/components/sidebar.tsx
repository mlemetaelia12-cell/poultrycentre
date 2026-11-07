import Link from "next/link";
import { Activity, BarChart3, Bell, Boxes, ClipboardList, CreditCard, FileText, LayoutDashboard, LogOut, Package, Settings, ShoppingCart, Truck, Users, Wallet, Tags, type LucideIcon } from "lucide-react";
import { Logo } from "./logo";
import { logoutAction, setLanguageAction } from "@/lib/actions";
import type { Role } from "@/lib/types";
import { getLocale, t } from "@/i18n/messages";
import { hasPermission } from "@/lib/permissions";

const navItems: Array<{ href: string; key: Parameters<typeof t>[1]; permission: Parameters<typeof hasPermission>[1]; icon: LucideIcon }> = [
  { href: "/dashboard", key: "dashboard", permission: "dashboard:read", icon: LayoutDashboard },
  { href: "/sales", key: "sales", permission: "sales:read", icon: ShoppingCart },
  { href: "/exchanges", key: "exchanges", permission: "sales:read", icon: ClipboardList },
  { href: "/products", key: "products", permission: "products:read", icon: Package },
  { href: "/categories", key: "categories", permission: "settings:write", icon: Tags },
  { href: "/inventory", key: "inventory", permission: "inventory:read", icon: Boxes },
  { href: "/purchases", key: "purchases", permission: "purchases:read", icon: Truck },
  { href: "/customers", key: "customers", permission: "customers:read", icon: Users },
  { href: "/debts", key: "debts", permission: "debts:read", icon: CreditCard },
  { href: "/expenses", key: "expenses", permission: "expenses:read", icon: Wallet },
  { href: "/reports", key: "reports", permission: "reports:read", icon: BarChart3 },
  { href: "/receipts", key: "receipts", permission: "receipts:read", icon: FileText },
  { href: "/notifications", key: "notifications", permission: "notifications:read", icon: Bell },
  { href: "/staff", key: "staff", permission: "staff:read", icon: Users },
  { href: "/audit", key: "audit", permission: "audit:read", icon: Activity },
  { href: "/settings", key: "settings", permission: "settings:read", icon: Settings },
];

export async function Sidebar({ role, displayName, dashboardOnly = false }: { role: Role; displayName: string; dashboardOnly?: boolean }) {
  const locale = await getLocale();
  const items = navItems.filter((item) => !dashboardOnly && hasPermission(role, item.permission) || item.href === "/dashboard");
  return (
    <aside className="no-print hidden min-h-screen w-[264px] shrink-0 flex-col bg-forest-900 px-4 py-6 text-white lg:flex">
      <div className="px-2"><Logo /></div>
      <div className="my-7 rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-emerald-200">Signed in as</p><p className="mt-1 truncate text-sm font-semibold">{displayName}</p><p className="mt-1 text-xs capitalize text-emerald-100/70">{role.replaceAll("_", " ")}</p></div>
      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        {items.map(({ href, key, icon: Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-emerald-50/80 transition hover:bg-white/10 hover:text-white"><Icon size={18} strokeWidth={1.8} /><span>{t(locale, key)}</span></Link>)}
      </nav>
      <div className="mt-6 border-t border-white/10 pt-4">
        <form action={setLanguageAction} className="flex gap-2 px-2 pb-3"><button name="language" value="en" className={`rounded-lg px-3 py-1.5 text-xs ${locale === "en" ? "bg-white text-forest-900" : "text-emerald-100 hover:bg-white/10"}`}>EN</button><button name="language" value="sw" className={`rounded-lg px-3 py-1.5 text-xs ${locale === "sw" ? "bg-white text-forest-900" : "text-emerald-100 hover:bg-white/10"}`}>SW</button></form>
        <form action={logoutAction}><button className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-emerald-100/80 hover:bg-white/10"><LogOut size={17} />{t(locale, "signOut")}</button></form>
        <p className="px-3 pt-4 text-[10px] tracking-wide text-emerald-100/40">Built by Brell</p>
      </div>
    </aside>
  );
}

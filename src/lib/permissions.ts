import type { Role } from "./types";

export type Permission =
  | "dashboard:read" | "products:read" | "products:write" | "inventory:read" | "inventory:write"
  | "sales:read" | "sales:write" | "purchases:read" | "purchases:write"
  | "customers:read" | "customers:write" | "debts:read" | "debts:write"
  | "expenses:read" | "expenses:write" | "reports:read" | "staff:read" | "staff:write"
  | "notifications:read" | "notifications:write" | "audit:read" | "settings:read" | "settings:write"
  | "receipts:read" | "shifts:write";

const rolePermissions: Record<Role, Permission[]> = {
  owner: ["dashboard:read", "products:read", "products:write", "inventory:read", "inventory:write", "sales:read", "sales:write", "purchases:read", "purchases:write", "customers:read", "customers:write", "debts:read", "debts:write", "expenses:read", "expenses:write", "reports:read", "staff:read", "staff:write", "notifications:read", "notifications:write", "audit:read", "settings:read", "settings:write", "receipts:read", "shifts:write"],
  manager: ["dashboard:read", "products:read", "products:write", "inventory:read", "inventory:write", "sales:read", "sales:write", "purchases:read", "purchases:write", "customers:read", "customers:write", "debts:read", "debts:write", "expenses:read", "expenses:write", "reports:read", "staff:read", "notifications:read", "notifications:write", "receipts:read", "shifts:write"],
  cashier: ["dashboard:read", "sales:read", "sales:write", "customers:read", "customers:write", "debts:read", "debts:write", "notifications:read", "receipts:read", "shifts:write"],
  stock_attendant: ["dashboard:read", "products:read", "inventory:read", "inventory:write", "purchases:read", "purchases:write", "notifications:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function canAccessPath(role: Role, pathname: string): boolean {
  if (pathname === "/exchanges" || pathname.startsWith("/exchanges/")) return role === "owner" || role === "manager";
  const rules: Array<[string, Permission]> = [
    ["/dashboard", "dashboard:read"], ["/products", "products:read"], ["/categories", "settings:write"], ["/inventory", "inventory:read"],
    ["/sales", "sales:read"], ["/exchanges", "sales:read"], ["/purchases", "purchases:read"], ["/customers", "customers:read"],
    ["/debts", "debts:read"], ["/expenses", "expenses:read"], ["/reports", "reports:read"],
    ["/staff", "staff:read"], ["/notifications", "notifications:read"], ["/audit", "audit:read"],
    ["/settings", "settings:read"], ["/receipts", "receipts:read"],
  ];
  const rule = rules.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return !rule || hasPermission(role, rule[1]);
}

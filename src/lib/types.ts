export type Role = "owner" | "manager" | "cashier" | "stock_attendant";
export type AccessMode = "full" | "dashboard";
export type PaymentMethod = "cash" | "mpesa" | "mixx" | "airtel_money" | "halopesa" | "bank_transfer";
export type SessionUser = { id: string; username: string; displayName: string; role: Role; language: "en" | "sw"; forcePasswordChange: boolean; accessMode: AccessMode; sessionId: string };

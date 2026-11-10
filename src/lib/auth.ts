import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import type { Permission } from "./permissions";
import { hasPermission } from "./permissions";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "pc_session";
// Keep the same browser signed in for 30 days unless the user signs out or access is revoked.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export function sha256(value: string): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("APP_SESSION_SECRET must be configured with at least 32 random characters in production.");
  }
  return createHmac("sha256", secret || "local-development-only-session-key").update(value).digest("hex");
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /android|iphone|ipod|mobile|windows phone|blackberry|opera mini/i.test(userAgent);
}

export async function createSession(userId: string, accessMode: "full" | "dashboard", userAgent: string, ip: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await getDb().insert(sessions).values({
    userId, tokenHash: sha256(token), accessMode, userAgent: userAgent.slice(0, 500), ipHash: sha256(ip), expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    expires: expiresAt, priority: "high",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const result = await db.select({
    sessionId: sessions.id, userId: users.id, username: users.username,
    displayName: users.displayName, role: users.role, language: users.language, forcePasswordChange: users.forcePasswordChange, accessMode: sessions.accessMode,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true))).limit(1);
  const found = result[0];
  if (!found) return null;
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, found.sessionId));
  return { id: found.userId, username: found.username, displayName: found.displayName, role: found.role, language: found.language === "sw" ? "sw" : "en", forcePasswordChange: found.forcePasswordChange, accessMode: found.accessMode, sessionId: found.sessionId };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireFullAccess(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.forcePasswordChange) redirect("/change-password");
  const meta = await requestMeta();
  if (user.accessMode !== "full" || isMobileUserAgent(meta.userAgent)) throw new Error("This mobile owner session is read-only. Use an approved desktop or laptop session to make changes.");
  return user;
}

export async function requirePermission(permission: Permission, write = false): Promise<SessionUser> {
  const user = write ? await requireFullAccess() : await requireUser();
  if (user.forcePasswordChange) redirect("/change-password");
  if (!hasPermission(user.role, permission)) throw new Error("You do not have permission to perform this action.");
  return user;
}

export async function enforcePageAccess(pathname: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.forcePasswordChange && pathname !== "/change-password") redirect("/change-password");
  const meta = await requestMeta();
  if ((user.accessMode === "dashboard" || isMobileUserAgent(meta.userAgent)) && pathname !== "/dashboard") redirect("/dashboard");
  const { canAccessPath } = await import("./permissions");
  if (!canAccessPath(user.role, pathname)) redirect("/dashboard");
  return user;
}

export async function requestMeta() {
  const h = await headers();
  return { userAgent: h.get("user-agent") ?? "", ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" };
}

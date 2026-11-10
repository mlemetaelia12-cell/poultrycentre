import "server-only";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import type { Locale } from "./messages";

export { t } from "./messages";
export type { Locale } from "./messages";

export async function getLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get("pc_locale")?.value;
  if (cookieValue === "sw" || cookieValue === "en") return cookieValue;
  const session = await getSession();
  return session?.language === "sw" ? "sw" : "en";
}

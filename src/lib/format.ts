export function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

export function number(value: number | string | null | undefined, digits = 2): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-TZ", { maximumFractionDigits: digits }).format(Number.isFinite(amount) ? amount : 0);
}

export function dateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dar_es_Salaam" }).format(date);
}

export function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeZone: "Africa/Dar_es_Salaam" }).format(date);
}

export function safeNumber(raw: FormDataEntryValue | null, fallback = 0): number {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeText(raw: FormDataEntryValue | null, max = 500): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export function todayDateTz(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

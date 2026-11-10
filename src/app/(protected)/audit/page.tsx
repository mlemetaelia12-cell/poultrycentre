import Link from "next/link";
import { and, count, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { Activity, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { dateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { getLocale, t } from "@/i18n/server";

const PAGE_SIZE = 30;
const isDate = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
const dayStart = (value: string) => new Date(`${value}T00:00:00+03:00`);
const nextDay = (value: string) => new Date(dayStart(value).getTime() + 24 * 60 * 60 * 1000);

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; user?: string; from?: string; to?: string; page?: string }> }) {
  await requirePermission("audit:read");
  const locale = await getLocale();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const action = (params.action ?? "").trim().slice(0, 100);
  const rawUserId = (params.user ?? "").trim();
  const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawUserId) ? rawUserId : "";
  const from = isDate(params.from) ? params.from : "";
  const to = isDate(params.to) ? params.to : "";
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1", 10) || 1));
  const db = getDb();
  const filters: SQL[] = [];
  if (query) filters.push(or(ilike(auditLogs.action, `%${query}%`), ilike(auditLogs.entityType, `%${query}%`), ilike(users.displayName, `%${query}%`), ilike(users.username, `%${query}%`))!);
  if (action) filters.push(eq(auditLogs.action, action));
  if (userId) filters.push(eq(auditLogs.actorId, userId));
  if (from) filters.push(gte(auditLogs.createdAt, dayStart(from)));
  if (to) filters.push(lt(auditLogs.createdAt, nextDay(to)));
  const condition = filters.length ? and(...filters) : undefined;
  const [countRows, rows, userRows, actionRows] = await Promise.all([
    db.select({ value: count() }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).where(condition),
    db.select({ log: auditLogs, actor: users.displayName, username: users.username }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).where(condition).orderBy(desc(auditLogs.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ id: users.id, name: users.displayName }).from(users).where(eq(users.active, true)).orderBy(users.displayName),
    db.selectDistinct({ action: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
  ]);
  const total = Number(countRows[0]?.value ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (action) search.set("action", action);
    if (userId) search.set("user", userId);
    if (from) search.set("from", from);
    if (to) search.set("to", to);
    search.set("page", String(target));
    return `/audit?${search.toString()}`;
  };
  return <>
    <PageHeader title={t(locale, "audit")} description={locale === "sw" ? "Tafuta na kagua miingio, vitendo vya fedha, mabadiliko ya stoo na matukio ya mfumo." : "Find and review recorded logins, financial actions, stock movements, account changes and system events."} />
    <div className="mb-4 rounded-xl border border-forest-100 bg-forest-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-forest-900"><ShieldCheck size={18} /> {t(locale, "protectedHistory")}</div><p className="mt-1 text-xs leading-5 text-forest-800">{t(locale, "protectedHistoryHelp")}</p></div>
    <form method="get" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
      <div className="xl:col-span-2"><label className="field-label" htmlFor="q">{t(locale, "searchEvents")}</label><input id="q" name="q" defaultValue={query} className="field" placeholder={locale === "sw" ? "Kitendo, aina ya rekodi au mtumiaji…" : "Action, record type or user…"} /></div>
      <div><label className="field-label" htmlFor="action">{t(locale, "actionType")}</label><select id="action" name="action" defaultValue={action} className="field"><option value="">{t(locale, "allActions")}</option>{actionRows.map((row) => <option key={row.action} value={row.action}>{row.action}</option>)}</select></div>
      <div><label className="field-label" htmlFor="user">{t(locale, "user")}</label><select id="user" name="user" defaultValue={userId} className="field"><option value="">{t(locale, "allUsers")}</option>{userRows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-2"><label><span className="field-label">{t(locale, "from")}</span><input name="from" type="date" defaultValue={from} className="field" /></label><label><span className="field-label">{t(locale, "to")}</span><input name="to" type="date" defaultValue={to} className="field" /></label></div>
      <div className="flex gap-2 xl:col-span-5"><button className="min-h-11 rounded-xl bg-forest-700 px-5 text-sm font-semibold text-white">{t(locale, "applyFilters")}</button><Link href="/audit" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">{t(locale, "clear")}</Link></div>
    </form>
    <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Activity size={18} className="text-forest-700" /><h2 className="section-title">{t(locale, "recordedActions")}</h2></div><p className="text-xs text-slate-500">{total.toLocaleString()} {t(locale, "events")} · {t(locale, "page")} {Math.min(page, pageCount)} {t(locale, "of")} {pageCount}</p></div>
    {rows.length ? <div className="space-y-2">{rows.map(({ log, actor, username }) => <article key={log.id} className="card min-w-0 p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-all text-sm font-bold text-slate-800">{log.action}</span><span className="badge badge-gray">{log.entityType}</span></div><p className="mt-1 text-xs text-slate-500">{dateTime(log.createdAt)} · {actor ?? t(locale, "formerUser")}{username ? ` (@${username})` : ""}</p></div><details className="max-w-full"><summary className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-forest-700">{t(locale, "details")}</summary><div className="mt-2 max-w-[min(80vw,640px)] overflow-x-auto rounded-lg bg-slate-50 p-3"><p className="mb-1 text-[10px] text-slate-500">{t(locale, "recordId")}: {log.entityId ?? "—"}</p><pre className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{log.details ? JSON.stringify(log.details, null, 2) : t(locale, "noAdditionalDetails")}</pre></div></details></div>
    </article>)}</div> : <div className="card px-4 py-14 text-center"><p className="text-sm font-semibold text-slate-700">{t(locale, "noAuditEvents")}</p><p className="mt-1 text-xs text-slate-500">{t(locale, "clearFiltersHint")}</p></div>}
    <div className="mt-5 flex items-center justify-between gap-3"><Link aria-disabled={page <= 1} className={`inline-flex min-h-10 items-center rounded-xl border px-4 text-xs font-semibold ${page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`} href={pageHref(Math.max(1, page - 1))}>{t(locale, "previous")}</Link><Link aria-disabled={page >= pageCount} className={`inline-flex min-h-10 items-center rounded-xl border px-4 text-xs font-semibold ${page >= pageCount ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`} href={pageHref(Math.min(pageCount, page + 1))}>{t(locale, "next")}</Link></div>
  </>;
}

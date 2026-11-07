import { desc, eq } from "drizzle-orm";
import { Activity, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { dateTime } from "@/lib/format";

export default async function AuditPage() {
  const rows = await getDb().select({ log: auditLogs, actor: users.displayName, username: users.username }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(300);
  return <>
    <PageHeader title="Audit trail" description="Append-only record of logins, financial actions, stock movements, account changes and system events." />
    <div className="mb-4 rounded-xl border border-forest-100 bg-forest-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-forest-900"><ShieldCheck size={18} /> Protected history</div><p className="mt-1 text-xs leading-5 text-forest-800">Business transactions are not silently deleted. Voids and corrections should be recorded as new actions and remain visible in this history.</p></div>
    <div className="mb-3 flex items-center gap-2"><Activity size={18} className="text-forest-700" /><h2 className="section-title">Latest recorded actions</h2></div>
    <DataTable headers={["Date/time", "User", "Action", "Record type", "Record ID", "Details"]} rows={rows.map(({ log, actor, username }) => [dateTime(log.createdAt), <span>{actor ?? "Former user"}<br /><span className="text-[10px] text-slate-400">{username ?? "—"}</span></span>, <span className="font-semibold">{log.action}</span>, log.entityType, <span className="font-mono text-[10px]">{log.entityId ?? "—"}</span>, <span className="max-w-[260px] truncate text-xs text-slate-500">{log.details ? JSON.stringify(log.details) : "—"}</span>])} />
  </>;
}

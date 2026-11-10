import { desc } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { dateTime } from "@/lib/format";

export default async function NotificationsPage() {
  const actor = await requireUser();
  const rows = await getDb().select().from(notifications).orderBy(desc(notifications.createdAt)).limit(200);
  const canMark = hasPermission(actor.role, "notifications:write") && actor.accessMode === "full";
  return <>
    <PageHeader title="Dashboard notifications" description="Important operational alerts are shown inside the application only. No SMS, email or WhatsApp automation is enabled." action={canMark ? <form action={markAllNotificationsReadAction}><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><CheckCheck size={15} /> Mark all read</button></form> : undefined} />
    <div className="space-y-3">{rows.length ? rows.map((notice) => <article key={notice.id} className={`card flex gap-3 p-4 ${notice.readAt ? "opacity-70" : "border-emerald-200"}`}><span className={`mt-0.5 rounded-xl p-2 ${notice.type === "expired" || notice.type === "security" ? "bg-red-50 text-red-700" : notice.type === "low_stock" || notice.type === "expiry" || notice.type === "overdue_debt" ? "bg-amber-50 text-amber-700" : "bg-forest-50 text-forest-700"}`}><Bell size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-800">{notice.title}</h2><span className={`badge ${notice.readAt ? "badge-gray" : "badge-green"}`}>{notice.readAt ? "Read" : "Unread"}</span><span className="badge badge-gray">{notice.type.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{notice.message}</p><p className="mt-2 text-[11px] text-slate-400">{dateTime(notice.createdAt)}</p></div>{canMark && !notice.readAt && <form action={markNotificationReadAction}><input type="hidden" name="id" value={notice.id} /><button aria-label="Mark as read" className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Read</button></form>}</article>) : <div className="card py-16 text-center"><Bell className="mx-auto text-slate-300" size={28} /><p className="mt-3 text-sm font-semibold text-slate-600">No notifications yet</p><p className="mt-1 text-xs text-slate-400">New operational and security alerts will appear here.</p></div>}</div>
  </>;
}

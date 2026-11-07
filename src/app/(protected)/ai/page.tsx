import { PageHeader } from "@/components/page-header";
import { AIChat } from "@/components/ai/ai-chat";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/i18n/messages";

export default async function AIWorkspacePage() {
  const user = await requireUser();
  const locale = await getLocale();
  return <>
    <PageHeader title="POULTRY CENTRE AI" description={locale === "sw" ? "Msaidizi wa biashara anayechambua taarifa halisi kulingana na ruhusa za akaunti yako." : "A business assistant that analyzes real records within your account's existing permissions."} />
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,.8fr)]">
      <AIChat pagePath="/ai" locale={locale} />
      <aside className="card h-fit p-4 sm:p-5"><h2 className="section-title">{locale === "sw" ? "Ulinzi wa taarifa" : "Business data protection"}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{locale === "sw" ? "AI hupokea muhtasari mdogo wa taarifa ambazo jukumu lako linaruhusu. Haipati database credentials, SQL access, passwords au API keys." : "AI receives only small summaries of information your role is allowed to view. It never receives database credentials, raw SQL access, passwords or API keys."}</p><div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600"><p><strong className="text-slate-800">{locale === "sw" ? "Inaruhusiwa" : "Allowed"}</strong><br />{locale === "sw" ? "Kuchambua mauzo, stoo, madeni na matumizi kulingana na ruhusa." : "Analyze sales, inventory, debts and expenses according to your permissions."}</p><p><strong className="text-slate-800">{locale === "sw" ? "Haifanyi" : "Not enabled"}</strong><br />{locale === "sw" ? "Kurekodi matumizi, kupokea stock, kubadilisha bei au kukusanya deni. Tumia workflow za kawaida za app." : "Record expenses, receive stock, change prices or collect debts. Use the app's normal workflows for these actions."}</p><p><strong className="text-slate-800">{locale === "sw" ? "Lugha" : "Language"}</strong><br />{locale === "sw" ? "Unaweza kuandika kwa Kiswahili au Kiingereza; AI itafuata lugha yako." : "Write in English or Kiswahili; the assistant follows your language."}</p></div><p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">{locale === "sw" ? `Akaunti: ${user.displayName} (${user.role.replaceAll("_", " ")}). Ruhusa hutathminiwa upya upande wa seva kwa kila ombi.` : `Account: ${user.displayName} (${user.role.replaceAll("_", " ")}). Permissions are re-evaluated on the server for every request.`}</p></aside>
    </div>
  </>;
}

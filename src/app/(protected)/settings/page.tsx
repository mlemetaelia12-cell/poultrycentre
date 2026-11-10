import { Settings2, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessSettings } from "@/db/schema";
import { updateBusinessSettingsAction } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/i18n/server";

export default async function SettingsPage() {
  const actor = await requireUser();
  const locale = await getLocale();
  const sw = locale === "sw";
  const [settings] = await getDb().select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
  const editable = actor.role === "owner" && actor.accessMode === "full";
  return <>
    <PageHeader title={sw ? "Mipangilio ya biashara" : "Business settings"} description={sw ? "Taarifa za biashara na usalama wa mfumo." : "Business details and system security."} />
    <section className="card p-4 sm:p-6"><div className="mb-5 flex items-center gap-2"><Settings2 size={19} className="text-forest-700" /><h2 className="section-title">{sw ? "Taarifa za biashara" : "Business profile"}</h2></div>
      <ActionForm action={updateBusinessSettingsAction} submitLabel={editable ? (sw ? "Hifadhi mipangilio" : "Save settings") : (sw ? "Kusoma tu" : "Read only")} className="grid gap-4 sm:grid-cols-2" >
        <fieldset disabled={!editable} className="contents"><div><label className="field-label">{sw ? "Jina la biashara *" : "Business name *"}</label><input name="businessName" required className="field" defaultValue={settings?.businessName ?? "POULTRY CENTRE"} /></div><div><label className="field-label">{sw ? "Simu ya biashara" : "Business phone"}</label><input name="phone" className="field" defaultValue={settings?.phone ?? ""} /></div><div className="sm:col-span-2"><label className="field-label">{sw ? "Anuani ya biashara" : "Business address"}</label><input name="address" className="field" defaultValue={settings?.address ?? ""} /></div><div><label className="field-label">{sw ? "TIN (kama inahitajika)" : "TIN (as applicable)"}</label><input name="tin" className="field" defaultValue={settings?.tin ?? ""} /></div><div><label className="field-label">{sw ? "Hali ya usajili wa VAT" : "VAT registration status"}</label><select name="vatRegistered" className="field" defaultValue={settings?.vatRegistered ? "yes" : "no"}><option value="no">{sw ? "Haijasajiliwa / haijawekwa" : "Not configured / not registered"}</option><option value="yes">{sw ? "Imesajiliwa — hakiki na TRA" : "Registered — verify with TRA"}</option></select></div><div><label className="field-label">{sw ? "Kiwango cha VAT (%) — rejea tu" : "VAT rate (%) — reference only"}</label><input name="vatRate" className="field" type="number" min="0" max="100" step="0.01" defaultValue={settings?.vatRate ?? ""} /></div></fieldset>
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 sm:col-span-2"><strong>{sw ? "Kodi na risiti za kodi:" : "Tax and fiscal receipts:"}</strong> {sw ? "Mfumo haukokotoi kodi moja kwa moja wala si EFD/VFD. Hakiki wajibu wa kodi na TRA au mhasibu." : "This application does not assume VAT registration or calculate tax automatically. Confirm actual obligations with TRA or a qualified accountant. This receipt is internal and is not an EFD/VFD fiscal receipt."}</div>
      </ActionForm>
    </section>
    <section className="card mt-5 p-4 sm:p-6"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="text-forest-700" size={19} /><h2 className="section-title">{sw ? "Usalama na kanuni za mfumo" : "Security and system rules"}</h2></div><div className="grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-2"><p><strong className="text-slate-800">{sw ? "Sarafu:" : "Currency:"}</strong> TZS · <strong className="text-slate-800">{sw ? "Saa:" : "Timezone:"}</strong> Africa/Dar_es_Salaam</p><p><strong className="text-slate-800">{sw ? "Lugha:" : "Languages:"}</strong> {sw ? "English na Kiswahili; badilisha juu ya ukurasa." : "English and Kiswahili; switch from the page header."}</p><p><strong className="text-slate-800">{sw ? "Simu ya mmiliki:" : "Owner mobile:"}</strong> {sw ? "dashboard ya kusoma tu; hairuhusiwi kuhariri." : "dashboard-only session; all server write actions reject this access mode."}</p><p><strong className="text-slate-800">{sw ? "Akaunti za watumiaji:" : "Staff accounts:"}</strong> {sw ? "mmiliki ndiye anayeongeza akaunti na kuweka wadhifa." : "owner-created accounts with role-based access; no public registration."}</p><p><strong className="text-slate-800">{sw ? "Taarifa:" : "Notifications:"}</strong> {sw ? "zinaonekana ndani ya mfumo." : "in-app dashboard alerts only."}</p><p><strong className="text-slate-800">{sw ? "Risiti za kodi:" : "Fiscal integration:"}</strong> {sw ? "EFD/VFD haijaunganishwa." : "EFD/VFD is not connected in V1."}</p></div>{!editable && <p className="mt-4 text-xs text-amber-700">{sw ? "Mmiliki pekee ndiye anayeweza kubadilisha mipangilio ya biashara na kodi." : "Only the owner can change business and tax settings."}</p>}</section>
  </>;
}

import { Settings2, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessSettings } from "@/db/schema";
import { updateBusinessSettingsAction } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const actor = await requireUser();
  const [settings] = await getDb().select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
  const editable = actor.role === "owner" && actor.accessMode === "full";
  return <>
    <PageHeader title="Business settings" description="Business identity, receipt details, currency, language defaults and tax configuration readiness." />
    <section className="card p-4 sm:p-6"><div className="mb-5 flex items-center gap-2"><Settings2 size={19} className="text-forest-700" /><h2 className="section-title">Business profile</h2></div>
      <ActionForm action={updateBusinessSettingsAction} submitLabel={editable ? "Save settings" : "Read only"} className="grid gap-4 sm:grid-cols-2" >
        <fieldset disabled={!editable} className="contents"><div><label className="field-label">Business name *</label><input name="businessName" required className="field" defaultValue={settings?.businessName ?? "POULTRY CENTRE"} /></div><div><label className="field-label">Business phone</label><input name="phone" className="field" defaultValue={settings?.phone ?? ""} /></div><div className="sm:col-span-2"><label className="field-label">Business address</label><input name="address" className="field" defaultValue={settings?.address ?? ""} /></div><div><label className="field-label">TIN (as applicable)</label><input name="tin" className="field" defaultValue={settings?.tin ?? ""} /></div><div><label className="field-label">VAT registration status</label><select name="vatRegistered" className="field" defaultValue={settings?.vatRegistered ? "yes" : "no"}><option value="no">Not configured / not registered</option><option value="yes">Registered — verify with TRA</option></select></div><div><label className="field-label">VAT rate (%) — reference only</label><input name="vatRate" className="field" type="number" min="0" max="100" step="0.01" defaultValue={settings?.vatRate ?? ""} /></div></fieldset>
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 sm:col-span-2"><strong>Tax and fiscal receipts:</strong> the business is recorded as registered, but this application does not assume VAT registration or calculate tax automatically. Confirm actual obligations, TIN/VAT status and applicable treatment with TRA or a qualified accountant. This receipt is internal and is not an EFD/VFD fiscal receipt.</div>
      </ActionForm>
    </section>
    <section className="card mt-5 p-4 sm:p-6"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="text-forest-700" size={19} /><h2 className="section-title">Security and system rules</h2></div><div className="grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-2"><p><strong className="text-slate-800">Currency:</strong> TZS · <strong className="text-slate-800">Timezone:</strong> Africa/Dar_es_Salaam</p><p><strong className="text-slate-800">Languages:</strong> English default and Kiswahili per-user browser preference.</p><p><strong className="text-slate-800">Owner mobile:</strong> dashboard-only session; all server write actions reject this access mode.</p><p><strong className="text-slate-800">Staff accounts:</strong> username/password, no public registration, role-bound access.</p><p><strong className="text-slate-800">Notifications:</strong> in-app dashboard alerts only; no WhatsApp, SMS or email API.</p><p><strong className="text-slate-800">Fiscal integration:</strong> EFD/VFD is not connected in V1.</p></div>{!editable && <p className="mt-4 text-xs text-amber-700">Only the owner can change business and tax settings.</p>}</section>
  </>;
}

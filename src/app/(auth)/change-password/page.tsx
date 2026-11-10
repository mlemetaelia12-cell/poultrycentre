import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { changePasswordAction } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";

export default async function ChangePasswordPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!user.forcePasswordChange) redirect("/dashboard");
  if (user.accessMode !== "full") redirect("/dashboard");
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10"><section className="card w-full max-w-lg p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Account security</p><h1 className="mt-2 text-2xl font-extrabold text-slate-900">Change your temporary password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your account was created with a temporary password. Set a private password before using the system.</p><ActionForm action={changePasswordAction} submitLabel="Change password" className="mt-6 space-y-4"><div><label className="field-label">Current password</label><input name="currentPassword" required type="password" autoComplete="current-password" className="field" /></div><div><label className="field-label">New password</label><input name="newPassword" required type="password" minLength={12} autoComplete="new-password" className="field" /><p className="field-help">Use at least 12 characters. Avoid passwords you use elsewhere.</p></div><div><label className="field-label">Confirm new password</label><input name="confirmPassword" required type="password" minLength={12} autoComplete="new-password" className="field" /></div></ActionForm></section></main>;
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/action-form";
import { loginAction } from "@/lib/actions";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_#e3f3e7,_transparent_50%),linear-gradient(135deg,#f8fbf8,#eef4ef)] px-4 py-12">
      <div className="w-full max-w-[430px]">
        <div className="mb-7 flex justify-center"><div className="rounded-2xl bg-forest-900 p-4 shadow-soft"><Logo /></div></div>
        <section className="rounded-[28px] border border-white bg-white p-7 shadow-[0_24px_80px_rgba(20,83,45,.12)] sm:p-9">
          <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.15em] text-forest-600">Secure business access</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Welcome back</h1><p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the account provided by your business owner. Public registration is disabled.</p></div>
          <LoginForm action={loginAction} />
          <div className="mt-6 rounded-xl bg-forest-50 px-4 py-3 text-xs leading-5 text-forest-800"><strong>Owner on mobile:</strong> sign-in opens a read-only dashboard. Use your desktop or laptop for management tasks.</div>
        </section>
        <p className="mt-6 text-center text-[11px] text-slate-400">POULTRY CENTRE · Built by Brell</p>
      </div>
    </main>
  );
}

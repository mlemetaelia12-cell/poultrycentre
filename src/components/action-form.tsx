"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/actions";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, submitLabel = "Save", className = "" }: { action: Action; children: ReactNode; submitLabel?: string; className?: string }) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      {(state.error || state.success) && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{state.error ?? state.success}</p>}
      <button type="submit" disabled={pending} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

export function LoginForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  return (
    <form action={formAction} className="space-y-4">
      <div><label htmlFor="username" className="field-label">Username</label><input id="username" name="username" autoComplete="username" required minLength={3} maxLength={40} className="field" /></div>
      <div><label htmlFor="password" className="field-label">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-forest-700 px-4 font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

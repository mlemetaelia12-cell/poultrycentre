"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Bot, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import type { Locale } from "@/i18n/messages";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; error?: boolean };

const copy = {
  en: {
    title: "POULTRY CENTRE AI", subtitle: "Business assistant · Read-only", intro: "I can help you understand authorized sales, stock, customer balances and expenses using the records in your business system.",
    placeholder: "Ask about sales, stock, customers or expenses…", send: "Send message", working: "Preparing your answer…", sales: "Reviewing today's sales", stock: "Checking inventory", debts: "Reviewing customer balances", expenses: "Checking recorded expenses", error: "I could not complete that request. Please try again.",
    suggested: ["Review today's sales", "Check low stock and expiry", "Review outstanding customer debts"], unavailable: "No business data is available for that question or your role does not allow access.",
  },
  sw: {
    title: "POULTRY CENTRE AI", subtitle: "Msaidizi wa biashara · Kusoma tu", intro: "Naweza kukusaidia kuelewa mauzo, stoo, madeni ya wateja na matumizi kwa kutumia taarifa ambazo ruhusa zako zinaruhusu.",
    placeholder: "Uliza kuhusu mauzo, stock, wateja au matumizi…", send: "Tuma ujumbe", working: "Ninaandaa jibu…", sales: "Ninachambua mauzo ya leo", stock: "Ninakagua stoo", debts: "Ninakagua madeni ya wateja", expenses: "Ninakagua matumizi yaliyorekodiwa", error: "Ombi halijakamilika. Tafadhali jaribu tena.",
    suggested: ["Pitia mauzo ya leo", "Angalia stock ndogo na expiry", "Pitia madeni ya wateja"], unavailable: "Hakuna taarifa za biashara zinazopatikana kwa swali hili au huna ruhusa ya kuziona.",
  },
} satisfies Record<Locale, Record<string, string | string[]>>;

function processingLabel(message: string, locale: Locale) {
  const value = message.toLowerCase();
  if (/sales|sale|mauzo|sold|mapato/.test(value)) return copy[locale].sales as string;
  if (/stock|inventory|stoo|expiry|expire|bidhaa|batch/.test(value)) return copy[locale].stock as string;
  if (/debt|deni|madeni|balance|owe/.test(value)) return copy[locale].debts as string;
  if (/expense|expenses|matumizi|gharama/.test(value)) return copy[locale].expenses as string;
  return copy[locale].working as string;
}

export function AIChat({ pagePath, locale, compact = false }: { pagePath: string; locale: Locale; compact?: boolean }) {
  const labels = copy[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, status]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const next = [...messages, userMessage].slice(-12);
    setMessages([...next, assistantMessage]);
    setDraft("");
    setPending(true);
    setStatus(processingLabel(content, locale));
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath,
          messages: next
            .filter(({ content: body }) => body.trim().length > 0)
            .map(({ role, content: body }) => ({ role, content: body })),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || labels.error as string);
      }
      if (!response.body) throw new Error(labels.error as string);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = "";
      const consumeLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") return;
        try {
          const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string | null } }> };
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            received += delta;
            setMessages((current) => current.map((item) => item.id === assistantMessage.id ? { ...item, content: received } : item));
          }
        } catch {
          // Ignore malformed provider events without exposing their payload to the user.
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer.trim());
      if (!received.trim()) setMessages((current) => current.map((item) => item.id === assistantMessage.id ? { ...item, content: labels.unavailable as string } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : labels.error as string;
      setMessages((current) => current.map((item) => item.id === assistantMessage.id ? { ...item, content: message, error: true } : item));
    } finally {
      setPending(false);
      setStatus("");
      textareaRef.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  return <section className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? "h-[min(620px,78dvh)] w-full" : "min-h-[640px]"}`}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><Bot size={19} /></span><div className="min-w-0"><p className="truncate text-xs font-extrabold tracking-wide text-slate-800">{labels.title as string}</p><p className="mt-0.5 text-[10px] text-slate-500">{labels.subtitle as string}</p></div></div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{locale === "sw" ? "Salama" : "Secure"}</span>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
      {!messages.length && <div className="mx-auto flex min-h-[300px] max-w-xl flex-col justify-center"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-forest-100 bg-forest-50 text-forest-700"><Bot size={22} /></div><h2 className="text-lg font-bold tracking-tight text-slate-800">{locale === "sw" ? "Karibu kwenye POULTRY CENTRE AI" : "How can I help with your business?"}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{labels.intro as string}</p><div className="mt-5 grid gap-2 sm:grid-cols-1">{(labels.suggested as string[]).map((suggestion) => <button type="button" key={suggestion} disabled={pending} onClick={() => void send(suggestion)} className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-forest-200 hover:bg-forest-50">{suggestion}</button>)}</div></div>}
      {messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-3 sm:max-w-[85%] ${message.role === "user" ? "bg-forest-800 text-white" : message.error ? "border border-amber-200 bg-amber-50 text-amber-900" : "border border-slate-100 bg-slate-50 text-slate-700"}`}>
        {message.role === "assistant" && <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-forest-700"><Bot size={12} /> POULTRY CENTRE AI</p>}
        {message.content ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p> : pending && message.role === "assistant" ? <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="animate-spin" size={14} />{status}</div> : null}
        {message.error && <p className="mt-2 flex items-center gap-1 text-[10px] text-amber-800"><CircleAlert size={12} />{locale === "sw" ? "Hakuna rekodi iliyobadilishwa." : "No business record was changed."}</p>}
      </div></div>)}
      <div ref={endRef} />
    </div>
    <form onSubmit={submit} className="border-t border-slate-100 bg-white p-3 sm:p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-forest-300 focus-within:ring-2 focus-within:ring-forest-100">
        <textarea ref={textareaRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 150)}px`; }} onKeyDown={handleKeyDown} rows={1} maxLength={3000} placeholder={labels.placeholder as string} aria-label={labels.placeholder as string} className="max-h-[150px] min-h-10 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0" disabled={pending} />
        <div className="flex items-center justify-between gap-3 px-1"><p className="text-[10px] text-slate-400">{locale === "sw" ? "Enter kutuma · Shift + Enter mstari mpya" : "Enter to send · Shift + Enter for a new line"}</p><button type="submit" disabled={pending || !draft.trim()} aria-label={labels.send as string} title={labels.send as string} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={17} /></button></div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><CheckCircle2 size={11} />{locale === "sw" ? "Msaidizi huyu husoma tu taarifa zinazoruhusiwa. Hakuna mabadiliko yanayofanyika." : "This assistant only reads data your role may access. It cannot change business records."}</p>
    </form>
  </section>;
}

"use client";

import { Bot, BookOpen, Briefcase, ClipboardCheck, Loader2, Plus, Search, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { AI, type ChatReply } from "@/lib/v5";

const AGENTS = [
  { id: "", name: "Auto", icon: Bot, hint: "Picks the right expert for you" },
  { id: "fraud", name: "Fraud investigator", icon: Search, hint: "Is this a scam? What do I do now?" },
  { id: "security", name: "Security assistant", icon: ShieldCheck, hint: "Explain any security topic simply" },
  { id: "threat", name: "Threat hunter", icon: Bot, hint: "CVEs, KEV, ATT&CK, detection ideas" },
  { id: "compliance", name: "Compliance advisor", icon: ClipboardCheck, hint: "ISO 27001, NIST, SOC 2, DPDP, CERT-In…" },
  { id: "coach", name: "Awareness coach", icon: BookOpen, hint: "Learn with short examples and quizzes" },
  { id: "career", name: "Career guide", icon: Briefcase, hint: "Paths and certifications into cyber jobs" },
];
const STARTERS: Record<string, string[]> = {
  "": ["Someone says I won a KBC lottery and must pay GST first. Is it a scam?", "What is CVE-2024-3400 and should we patch it?", "How do we meet CERT-In's 6-hour reporting rule?"],
  fraud: ["A caller says I'm under digital arrest by CBI. What should I do?", "I paid ₹5,000 to a fake refund desk 20 minutes ago — help"],
  threat: ["Explain T1566 and how to detect it", "Which ransomware-linked vulnerabilities should a bank patch first?"],
  compliance: ["Which ISO 27001 controls cover MFA and backups?", "What does India's DPDP Act require after a data breach?"],
  security: ["What is a passkey and should I use one?", "How do I secure my WhatsApp?"],
  coach: ["Teach me how to spot phishing links", "Quiz me on UPI safety"],
  career: ["How do I become a SOC analyst in 6 months?", "Which certification first: Security+ or CEH?"],
};

type Msg = { role: string; content: string; sources?: ChatReply["sources"]; agent_name?: string };

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <i key={i} className="text-slate-400">{p.slice(1, -1)}</i> : p);
}
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = []; let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={`l${k}`} className="my-1 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  lines.forEach((l, i) => { const m = l.match(/^\s*[-*•]\s+(.*)/); if (m) list.push(m[1]); else { flush(i); if (l.trim()) out.push(<p key={i} className="my-1">{inline(l)}</p>); } });
  flush(lines.length);
  return <>{out}</>;
}

export default function AiPage() {
  const { lang } = useI18n();
  const { user, ready } = useSession();
  const [agent, setAgent] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [conv, setConv] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof AI.conversations>>>([]);
  const [llm, setLlm] = useState<boolean | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const a = new URLSearchParams(window.location.search).get("agent"); if (a) setAgent(a); AI.agents().then((r) => setLlm(r.llm)).catch(() => {}); }, []);
  useEffect(() => { if (user) AI.conversations().then(setHistory).catch(() => {}); }, [user?.id, conv]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (m = text) => {
    if (!m.trim() || busy) return;
    setErr(""); setText(""); setMsgs((x) => [...x, { role: "user", content: m }]); setBusy(true);
    try { const r = await AI.chat(m, agent, conv, lang); setConv(r.conversation_id); setMsgs((x) => [...x, { role: "assistant", content: r.content, sources: r.sources, agent_name: r.agent_name }]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const openConv = async (id: string) => { const c = await AI.conversation(id); setConv(id); setMsgs(c.messages); };

  if (ready && !user) return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-12 text-center"><Bot size={44} className="mx-auto text-cyan-300" />
      <h1 className="text-2xl font-black text-white">ProblemHunt AI</h1><p className="text-slate-400">Six security experts in one chat — fraud, threats, compliance, learning and careers.</p>
      <Link href="/account/?next=/ai/" className="inline-block rounded-lg bg-cyan-400 px-6 py-2.5 font-bold text-black">Log in to chat</Link></div>
  );
  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2">
        <button onClick={() => { setConv(""); setMsgs([]); }} className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />New chat</button>
        <div className="hidden space-y-1 lg:block">{history.map((h) => (
          <div key={h.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-sm ${conv === h.id ? "bg-white/10 text-white" : "text-slate-400"}`}>
            <button className="flex-1 truncate text-left" onClick={() => openConv(h.id)}>{h.title}</button>
            <button className="hidden text-slate-500 group-hover:block" onClick={async () => { await AI.remove(h.id); if (conv === h.id) { setConv(""); setMsgs([]); } setHistory(history.filter((x) => x.id !== h.id)); }}><Trash2 size={13} /></button>
          </div>))}</div>
      </aside>
      <section className="flex min-h-[70vh] min-w-0 flex-col">
        <div className="flex gap-1 overflow-x-auto pb-2">{AGENTS.map((a) => (
          <button key={a.id} onClick={() => setAgent(a.id)} title={a.hint} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${agent === a.id ? "bg-cyan-400 font-semibold text-black" : "bg-white/5 text-slate-300"}`}><a.icon size={14} />{a.name}</button>))}</div>
        {llm === false && <p className="mb-2 rounded-lg bg-white/5 p-2 text-[12px] text-slate-400">Answers come from ProblemHunt&apos;s own knowledge base. For fuller AI answers, the admin can connect a free model (Ollama on the same computer, or a free Groq key) in Admin → Settings → AI.</p>}
        <div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-void-950/60 p-4">
          {msgs.length === 0 && <div className="py-8 text-center">
            <Bot size={40} className="mx-auto text-cyan-300" /><p className="mt-2 text-slate-300">{AGENTS.find((a) => a.id === agent)?.hint}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{(STARTERS[agent] || STARTERS[""]).map((s) => <button key={s} onClick={() => send(s)} className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-300 hover:border-cyan-400/40">{s}</button>)}</div>
          </div>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && <Bot size={22} className="mt-1 shrink-0 text-cyan-300" />}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${m.role === "user" ? "bg-cyan-400/15 text-white" : "bg-white/5 text-slate-100"}`}>
                {m.agent_name && <div className="mb-1 text-[11px] font-semibold text-cyan-300">{m.agent_name}</div>}
                <Rich text={m.content} />
                {!!m.sources?.length && <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2 text-[11px]">{m.sources.slice(0, 6).map((s, k) => (
                  <a key={k} href={s.url} target={s.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="rounded bg-white/5 px-2 py-0.5 text-slate-300 hover:text-cyan-300">[{k + 1}] {s.title.slice(0, 48)}</a>))}</div>}
              </div>
              {m.role === "user" && <UserRound size={22} className="mt-1 shrink-0 text-slate-400" />}
            </div>))}
          {busy && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Thinking…</div>}
          <div ref={end} />
        </div>
        {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
        <div className="mt-3 flex gap-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything, or paste a suspicious message, link or CVE…" maxLength={6000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-void-950 p-3 text-white outline-none focus:border-cyan-400/60" />
          <button onClick={() => send()} disabled={busy || !text.trim()} className="rounded-xl bg-cyan-400 px-5 font-bold text-black disabled:opacity-40"><Send size={18} /></button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">AI can make mistakes — sources are linked. Never share OTPs, PINs or passwords here. Personal numbers are masked before any AI model sees them.</p>
      </section>
    </div>
  );
}

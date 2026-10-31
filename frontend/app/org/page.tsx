"use client";

import { AlertTriangle, BookOpen, Building2, CheckCircle2, ClipboardCheck, Copy, FileText, Fish, KeyRound, LayoutDashboard, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ScoreRing from "@/components/site/ScoreRing";
import { useSession } from "@/lib/session";
import { W, type Control, type Dashboard, type Member, type OrgInfo } from "@/lib/v5";

const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60";
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "people", label: "People", icon: Users },
  { id: "phishing", label: "Phishing tests", icon: Fish }, { id: "passwords", label: "Passwords", icon: KeyRound },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck }, { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function OrgPage() {
  const { user, ready } = useSession();
  const [info, setInfo] = useState<OrgInfo | null>(null);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState("");
  const load = () => W.org().then(setInfo).catch((e) => setErr(e.message));
  useEffect(() => { if (user) load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && !user) return <Intro />;
  if (!info) return <p className="p-10 text-center text-slate-500">{err || "…"}</p>;
  if (!info.org) return <NoOrg onDone={setInfo} />;

  const org = info.org;
  if (!info.is_admin) return <MemberView info={info} reload={load} />;
  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[210px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-1 flex items-center gap-2 font-bold text-white"><Building2 size={16} className="text-cyan-300" />{org.name}</div>
        <div className="mb-3 text-[12px] text-slate-500">{org.members}/{org.seats} seats · {org.plan}</div>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}><Icon size={15} />{label}</button>
          ))}
          <Link href="/org/report/" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-cyan-300"><FileText size={15} />Board report</Link>
          <Link href="/courses/" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white"><BookOpen size={15} />My training</Link>
        </nav>
      </aside>
      <section className="min-w-0">
        {!info.admin_ready ? <MfaNeeded /> : <>
          {tab === "overview" && <Overview />}
          {tab === "people" && <People info={info} />}
          {tab === "phishing" && <Phishing />}
          {tab === "passwords" && <Passwords />}
          {tab === "compliance" && <Compliance />}
          {tab === "audit" && <Audit />}
          {tab === "settings" && <OrgSettings info={info} onSaved={setInfo} />}
        </>}
      </section>
    </div>
  );
}

function Intro() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-center">
      <Building2 size={44} className="mx-auto text-cyan-300" />
      <h1 className="text-3xl font-black text-white">ProblemHunt Workplace</h1>
      <p className="text-slate-300">Security awareness, safe phishing tests, password audit, compliance and a board-ready risk score — for schools, banks, offices and SMEs.</p>
      <Link href="/account/?next=/org/" className="inline-block rounded-lg bg-cyan-400 px-6 py-2.5 font-bold text-black">Log in to start</Link>
    </div>
  );
}

function NoOrg({ onDone }: { onDone: (o: OrgInfo) => void }) {
  const [f, setF] = useState({ name: "", domain: "", seats: 50, code: "" });
  const [err, setErr] = useState("");
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("join"); if (c) setF((x) => ({ ...x, code: c })); }, []);
  const go = async (fn: () => Promise<OrgInfo>) => { setErr(""); try { onDone(await fn()); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="text-center"><h1 className="text-3xl font-black text-white">ProblemHunt Workplace</h1>
        <p className="text-slate-400">Train your people, test them safely, and prove it with five scores your board understands.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel space-y-2 p-5">
          <h2 className="text-lg font-bold text-white">Create your organisation</h2>
          <input className={inp} placeholder="Organisation name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={inp} placeholder="Email domain (optional, e.g. school.edu.in)" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
          <label className="block text-[12px] text-slate-400">Seats<input type="number" className={inp} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} /></label>
          <button disabled={f.name.length < 2} onClick={() => go(() => W.createOrg({ name: f.name, domain: f.domain, seats: f.seats }))} className="w-full rounded-lg bg-cyan-400 py-2.5 font-bold text-black disabled:opacity-40">Create</button>
          <p className="text-[12px] text-slate-500">You become the owner. Admins must turn on 2-step verification.</p>
        </div>
        <div className="panel space-y-2 p-5">
          <h2 className="text-lg font-bold text-white">Join with an invite code</h2>
          <input className={inp + " font-mono uppercase"} placeholder="ORG-XXXXXX" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <button disabled={f.code.length < 4} onClick={() => go(() => W.join(f.code))} className="w-full rounded-lg bg-white/10 py-2.5 font-bold text-white disabled:opacity-40">Join</button>
          <p className="text-[12px] text-slate-500">By joining, you agree your organisation can assign training and send <b>simulated</b> phishing emails to help you learn. Your passwords are never shared with it.</p>
        </div>
      </div>
      {err && <p className="text-center text-sm text-rose-300">{err}</p>}
    </div>
  );
}

function MfaNeeded() {
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-amber-100"><ShieldCheck />Turn on 2-step verification to manage your organisation</h2>
      <p className="mt-1 text-sm text-slate-200">Admins can see staff results and send simulations, so their accounts need an authenticator-app code as well as their login.</p>
      <Link href="/account/#security" className="mt-3 inline-block rounded-lg bg-amber-300 px-4 py-2 font-bold text-black">Set up now</Link>
    </div>
  );
}

function MemberView({ info, reload }: { info: OrgInfo; reload: () => void }) {
  const done = Object.keys(info.progress).length;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Building2 className="text-cyan-300" />{info.org!.name}</h1>
      <div className="panel p-5">
        <h2 className="font-bold text-white">My training</h2>
        <p className="text-sm text-slate-400">{done} of {info.courses_total} courses done. Your organisation asks everyone to finish at least 3.</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(100 * done) / (info.courses_total || 6)}%` }} /></div>
        <Link href="/courses/" className="mt-3 inline-block rounded-lg bg-cyan-400 px-4 py-2 font-bold text-black">Continue training</Link>
      </div>
      <div className="panel p-5">
        <h2 className="font-bold text-white">Private password check {info.pw_checked && <CheckCircle2 size={16} className="inline text-emerald-300" />}</h2>
        <p className="text-sm text-slate-400">Your password is checked on this device. Only the result (leaked yes/no and strength) is shared with your organisation.</p>
        <PwSelfCheck onDone={reload} />
      </div>
      <div className="panel p-5 text-sm text-slate-300">
        <h2 className="font-bold text-white">Phishing tests</h2>
        Your organisation may send <b>simulated</b> phishing emails. If an email looks suspicious, use its <b>Report</b> link — reporting earns your team credit. Clicking only shows you a training page.
      </div>
      <button className="text-sm text-slate-500 underline" onClick={async () => { if (confirm("Leave this organisation?")) { await W.leave(); reload(); } }}>Leave organisation</button>
    </div>
  );
}

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/^(password|qwerty|123456|admin|welcome)/i.test(pw)) s = 0;
  return Math.min(4, s);
}

async function pwned(pw: string): Promise<boolean> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
  const text = await res.text();
  return text.split("\n").some((l) => l.split(":")[0] === hex.slice(5) && Number(l.split(":")[1]) > 0);
}

function PwSelfCheck({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input type="password" className={inp + " flex-1"} placeholder="Type your work password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
      <button className="rounded-lg bg-white/10 px-4 font-semibold text-white" onClick={async () => {
        setMsg("Checking…");
        try { const leaked = await pwned(pw); const st = strength(pw); await W.pwCheck(leaked, st); setPw("");
          setMsg(leaked ? "⚠ This password appears in known breaches. Change it now and turn on 2-step verification." : `✓ Not found in known breaches. Strength ${st}/4.`); onDone();
        } catch { setMsg("Couldn't check right now (needs internet)."); }
      }}>Check</button>
      {msg && <p className="w-full text-sm text-slate-200">{msg}</p>}
    </div>
  );
}

const SCORE_META: [keyof Dashboard["scores"], string, string][] = [
  ["risk_posture", "Risk posture", "Higher is better"], ["compliance", "Compliance", "% of controls in place"],
  ["maturity", "Security maturity", "Level 1–5"], ["awareness", "Awareness", "Training, quizzes, phishing tests"],
  ["exposure", "Threat exposure", "Lower is better"],
];

function Overview() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { W.dashboard().then(setD).catch((e) => setErr(e.message)); }, []);
  if (!d) return <p className="text-slate-500">{err || "Loading…"}</p>;
  const st = d.stats;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Executive overview</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {SCORE_META.map(([k, l, sub]) => (
          <div key={k} className="panel flex flex-col items-center p-3 text-center">
            {k === "maturity" ? <div className="grid h-[92px] place-items-center text-4xl font-black text-white">{d.scores.maturity}<span className="text-sm text-slate-500">/5</span></div>
              : <ScoreRing score={k === "exposure" ? 100 - d.scores.exposure : d.scores[k]} size={92} />}
            <div className="mt-1 text-sm font-semibold text-white">{l}{k === "exposure" && <span className="text-slate-400"> {d.scores.exposure}</span>}</div>
            <div className="text-[11px] text-slate-500">{sub}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel p-4">
          <h3 className="mb-2 font-semibold text-white">Top risks and fixes</h3>
          {d.risks.length === 0 && <p className="text-sm text-emerald-300">No urgent risks found.</p>}
          <ul className="space-y-2">{d.risks.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm"><AlertTriangle size={16} className={`mt-0.5 shrink-0 ${r.level === "high" ? "text-rose-400" : r.level === "medium" ? "text-amber-300" : "text-slate-400"}`} />
              <span><span className="text-slate-100">{r.text}</span> <span className="text-slate-400">{r.fix}</span></span></li>))}</ul>
        </div>
        <div className="panel p-4 text-sm">
          <h3 className="mb-2 font-semibold text-white">People</h3>
          <dl className="grid grid-cols-2 gap-y-1 text-slate-300">
            <dt>Members</dt><dd className="text-right font-mono">{String(st.members)}</dd>
            <dt>Finished 3+ courses</dt><dd className="text-right font-mono">{String(st.training_pct)}%</dd>
            <dt>Average quiz score</dt><dd className="text-right font-mono">{String(st.quiz_pct)}%</dd>
            <dt>Phishing click rate</dt><dd className="text-right font-mono">{String(st.click_pct)}%</dd>
            <dt>Phishing report rate</dt><dd className="text-right font-mono">{String(st.report_pct)}%</dd>
            <dt>Leaked passwords</dt><dd className="text-right font-mono">{String(st.pw_leaked_pct)}%</dd>
            <dt>Using 2-step login</dt><dd className="text-right font-mono">{String(st.member_mfa_pct)}%</dd>
          </dl>
        </div>
      </div>
      <div className="panel p-4">
        <h3 className="mb-2 font-semibold text-white">Known-exploited vulnerabilities in products you use</h3>
        {d.kev.length === 0 ? <p className="text-sm text-slate-500">None matched. Add your products in Settings (e.g. "Microsoft Windows", "Fortinet") — matched daily against CISA's KEV list.</p> :
          <table className="w-full text-sm"><tbody className="divide-y divide-white/5">{d.kev.map((k) => (
            <tr key={k.cve}><td className="py-1.5 font-mono"><Link href={`/intel/?cve=${k.cve}`} className="text-cyan-300">{k.cve}</Link></td><td>{k.vendor} {k.product}</td>
              <td className="text-slate-400">patch by {k.due_date}</td><td className="text-right">{k.epss != null ? `EPSS ${(k.epss * 100).toFixed(0)}%` : ""}</td></tr>))}</tbody></table>}
      </div>
    </div>
  );
}

function People({ info }: { info: OrgInfo }) {
  const [rows, setRows] = useState<Member[]>([]);
  const [code, setCode] = useState(info.org?.invite_code || "");
  const load = () => W.members().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const link = typeof window !== "undefined" ? `${location.origin}/org/?join=${code}` : "";
  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <div><div className="text-[12px] text-slate-400">Invite code</div><div className="font-mono text-2xl font-black text-white">{code}</div></div>
        <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(`Join ${info.org?.name} on ProblemHunt: open ${location.origin}/org/ and enter code ${code}`)}><Copy size={14} />Copy invite</button>
        <a className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-black" target="_blank" rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(`Join ${info.org?.name} on ProblemHunt for security training: ${link} (code ${code})`)}`}>Share on WhatsApp</a>
        <button className="text-sm text-slate-400 underline" onClick={async () => setCode((await W.rotateInvite()).invite_code)}>New code</button>
      </div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Person</th><th>Role</th><th>Dept</th><th>Courses</th><th>Quiz</th><th>Phishing</th><th>Password</th><th>2-step</th><th /></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((m) => (
          <tr key={m.user_id}><td className="p-2"><div className="text-white">{m.name || "—"}</div><div className="text-[11px] text-slate-500">{m.email || m.phone}</div></td>
            <td>{m.role === "owner" ? "owner" : <select className="rounded bg-void-950 text-sm" value={m.role} onChange={async (e) => { await W.updateMember(m.user_id, { role: e.target.value }); load(); }}><option value="member">member</option><option value="admin">admin</option></select>}</td>
            <td><input className="w-24 rounded bg-transparent text-sm" defaultValue={m.dept} placeholder="—" onBlur={(e) => e.target.value !== m.dept && W.updateMember(m.user_id, { dept: e.target.value })} /></td>
            <td>{m.courses_done}/6</td><td>{m.quiz_pct == null ? "—" : `${m.quiz_pct}%`}</td>
            <td>{m.sims ? <span>{m.clicked ? <span className="text-rose-300">clicked {m.clicked}</span> : "no clicks"}{m.reported ? <span className="text-emerald-300"> · reported {m.reported}</span> : ""}</span> : "—"}</td>
            <td>{!m.pw_checked ? <span className="text-slate-500">not checked</span> : m.pw_leaked ? <span className="text-rose-300">leaked</span> : <span className="text-emerald-300">ok ({m.pw_strength}/4)</span>}</td>
            <td>{m.mfa ? <CheckCircle2 size={15} className="text-emerald-300" /> : "—"}</td>
            <td className="text-right">{m.role !== "owner" && <button className="text-rose-300" onClick={async () => { if (confirm(`Remove ${m.name || m.email}?`)) { await W.removeMember(m.user_id); load(); } }}>Remove</button>}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function Phishing() {
  const [tpls, setTpls] = useState<Awaited<ReturnType<typeof W.templates>>>([]);
  const [camps, setCamps] = useState<Awaited<ReturnType<typeof W.campaigns>>>([]);
  const [sel, setSel] = useState("");
  const [name, setName] = useState("");
  const [out, setOut] = useState<Awaited<ReturnType<typeof W.sendCampaign>> | null>(null);
  const [err, setErr] = useState("");
  const load = () => W.campaigns().then(setCamps).catch(() => {});
  useEffect(() => { W.templates().then((t) => { setTpls(t); setSel(t[0]?.id || ""); }).catch(() => {}); load(); }, []);
  const t = tpls.find((x) => x.id === sel);
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold text-white">Safe phishing tests</h2>
        <p className="text-sm text-slate-400">Send a training email to your members. Clicks lead to a learning page, never a real login; reports earn credit. Only people who joined your organisation receive them.</p></div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-1">{tpls.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${sel === x.id ? "border-cyan-400/60 bg-cyan-400/10 text-white" : "border-white/10 text-slate-300"}`}>
            {x.name}<span className={`ml-2 text-[11px] ${x.difficulty === "hard" ? "text-rose-300" : x.difficulty === "medium" ? "text-amber-300" : "text-emerald-300"}`}>{x.difficulty}</span></button>))}</div>
        {t && <div className="panel p-4">
          <div className="text-[12px] text-slate-500">From: {t.from_name}</div>
          <div className="font-semibold text-white">{t.subject}</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-300">{t.body.replace("{link}", "[training link]")}</pre>
          <div className="mt-3 text-[12px] text-slate-400">Red flags taught afterwards: {t.flags.join(" · ")}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={inp + " max-w-xs"} placeholder="Campaign name (e.g. October baseline)" value={name} onChange={(e) => setName(e.target.value)} />
            <button disabled={name.length < 2} className="rounded-lg bg-rose-500 px-4 font-bold text-white disabled:opacity-40" onClick={async () => {
              setErr(""); try { setOut(await W.sendCampaign({ name, template_id: sel })); load(); } catch (e) { setErr((e as Error).message); } }}>Send to all members</button>
          </div>
          {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
          {out && <div className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-slate-200">Sent {out.sent} emails{out.skipped_no_email ? `; ${out.skipped_no_email} members have no email (mobile-only)` : ""}.
            {out.dev_previews && <div className="mt-1 text-[12px] text-amber-200">Developer mode (email not set up): links are also printed in the server window. First test link: <a className="underline" href={out.dev_previews[0]?.click}>open</a></div>}</div>}
        </div>}
      </div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Campaign</th><th>Template</th><th>Sent</th><th>Clicked</th><th>Reported</th><th>Date</th></tr></thead>
        <tbody className="divide-y divide-white/5">{camps.map((c) => (
          <tr key={c.id}><td className="p-2 text-white">{c.name}</td><td>{c.template_name}</td><td>{c.targets}</td>
            <td className="text-rose-300">{c.clicked || 0} ({c.targets ? Math.round((100 * (c.clicked || 0)) / c.targets) : 0}%)</td>
            <td className="text-emerald-300">{c.reported || 0}</td><td className="text-slate-500">{c.created_at.slice(0, 10)}</td></tr>))}
          {!camps.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No campaigns yet.</td></tr>}</tbody></table></div>
    </div>
  );
}

function Passwords() {
  const [rows, setRows] = useState<Member[]>([]);
  const [p, setP] = useState({ min: 12, mfa: true, rotate: 0, complexity: false, lockout: 10, breach: true });
  useEffect(() => { W.members().then(setRows).catch(() => {}); }, []);
  const checked = rows.filter((r) => r.pw_checked);
  const issues: string[] = [];
  if (p.min < 12) issues.push("Minimum length should be at least 12 (NIST SP 800-63B recommends allowing long passphrases, minimum 8; 12+ is a strong baseline).");
  if (!p.mfa) issues.push("Require 2-step verification — it stops most account takeovers.");
  if (p.rotate > 0 && p.rotate < 365) issues.push("Forced rotation every few months leads to weaker passwords; change only after a suspected compromise (NIST guidance).");
  if (p.complexity) issues.push("Composition rules (must contain a symbol…) are discouraged by NIST; prefer length and breach checks.");
  if (!p.breach) issues.push("Block passwords found in known breaches.");
  if (p.lockout === 0 || p.lockout > 100) issues.push("Limit failed login attempts (rate limiting or lockout).");
  const score = Math.max(0, 100 - issues.length * 18);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Password security center</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-4 text-center"><div className="text-3xl font-black text-white">{rows.length ? Math.round((100 * checked.length) / rows.length) : 0}%</div><div className="text-sm text-slate-400">staff checked their password</div></div>
        <div className="panel p-4 text-center"><div className="text-3xl font-black text-rose-300">{checked.filter((r) => r.pw_leaked).length}</div><div className="text-sm text-slate-400">use a leaked password</div></div>
        <div className="panel p-4 text-center"><div className="text-3xl font-black text-amber-300">{checked.filter((r) => r.pw_strength <= 1).length}</div><div className="text-sm text-slate-400">use a weak password</div></div>
      </div>
      <p className="text-[12px] text-slate-500">Privacy by design: each person checks on their own device (k-anonymity); ProblemHunt stores only leaked yes/no and a 0–4 strength.</p>
      <div className="panel space-y-2 p-4 text-sm">
        <h3 className="font-semibold text-white">Password policy checker <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[12px]">{score}/100</span></h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-slate-300">Minimum length<input type="number" className={inp} value={p.min} onChange={(e) => setP({ ...p, min: Number(e.target.value) })} /></label>
          <label className="text-slate-300">Force change every (days, 0 = never)<input type="number" className={inp} value={p.rotate} onChange={(e) => setP({ ...p, rotate: Number(e.target.value) })} /></label>
          <label className="text-slate-300">Lock after failed attempts (0 = never)<input type="number" className={inp} value={p.lockout} onChange={(e) => setP({ ...p, lockout: Number(e.target.value) })} /></label>
        </div>
        <div className="flex flex-wrap gap-4 text-slate-300">
          <label><input type="checkbox" checked={p.mfa} onChange={(e) => setP({ ...p, mfa: e.target.checked })} /> 2-step verification required</label>
          <label><input type="checkbox" checked={p.complexity} onChange={(e) => setP({ ...p, complexity: e.target.checked })} /> Symbol/number rules</label>
          <label><input type="checkbox" checked={p.breach} onChange={(e) => setP({ ...p, breach: e.target.checked })} /> Block breached passwords</label>
        </div>
        {issues.length ? <ul className="list-disc space-y-1 pl-5 text-amber-100">{issues.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="text-emerald-300">This policy follows current NIST guidance.</p>}
      </div>
      <Link href="/tools/" className="inline-block text-sm text-cyan-300">Password & passphrase generator →</Link>
    </div>
  );
}

function Compliance() {
  const [d, setD] = useState<Awaited<ReturnType<typeof W.compliance>> | null>(null);
  const [fw, setFw] = useState("");
  const load = () => W.compliance().then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <p className="text-slate-500">Loading…</p>;
  const ctrls: Control[] = fw ? d.controls.filter((c) => c.map[fw]) : d.controls;
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold text-white">Compliance center <span className="text-cyan-300">{d.coverage.pct}%</span></h2><p className="text-[12px] text-slate-500">{d.note}</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{d.coverage.frameworks.map((f) => (
        <button key={f.id} onClick={() => setFw(fw === f.id ? "" : f.id)} className={`panel p-3 text-left ${fw === f.id ? "border-cyan-400/60" : ""}`}>
          <div className="text-sm font-semibold text-white">{f.name}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${f.pct}%` }} /></div>
          <div className="mt-1 text-[11px] text-slate-400">{f.pct}% · {f.controls} controls</div></button>))}</div>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Control</th><th>Status</th><th>Owner</th><th>Mapped to</th></tr></thead>
        <tbody className="divide-y divide-white/5">{ctrls.map((c) => (
          <tr key={c.id} className="align-top"><td className="p-2"><span className="font-mono text-[11px] text-slate-500">{c.id}</span> <span className="text-white">{c.title}</span>
            {c.auto_note && <div className="text-[11px] text-emerald-300">{c.auto_note}</div>}</td>
            <td><select className="rounded bg-void-950 p-1 text-sm" value={c.status} onChange={async (e) => { await W.setControl(c.id, { status: e.target.value }); load(); }}>
              <option value="not_started">Not started</option><option value="partial">Partly</option><option value="done">Done</option><option value="na">Not applicable</option></select></td>
            <td><input className="w-28 rounded bg-transparent text-sm" defaultValue={c.owner} placeholder="assign" onBlur={(e) => e.target.value !== c.owner && W.setControl(c.id, { owner: e.target.value })} /></td>
            <td className="text-[11.5px] text-slate-400">{Object.entries(c.map).filter(([k]) => !fw || k === fw).map(([k, v]) => `${d.frameworks.find((f) => f.id === k)?.name}: ${v}`).join(" · ")}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function Audit() {
  const [d, setD] = useState<Awaited<ReturnType<typeof W.audit>> | null>(null);
  useEffect(() => { W.audit().then(setD).catch(() => {}); }, []);
  if (!d) return <p className="text-slate-500">Loading…</p>;
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white">Audit log</h2>
      <p className={`text-sm ${d.chain_ok ? "text-emerald-300" : "text-rose-300"}`}>{d.chain_ok ? "✓ Tamper check passed: every entry is linked by a SHA-256 hash chain." : "✗ The hash chain is broken — entries may have been altered."}</p>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">#</th><th>Time (UTC)</th><th>Who</th><th>Action</th><th>Target</th></tr></thead>
        <tbody className="divide-y divide-white/5">{d.rows.map((r) => (
          <tr key={r.seq}><td className="p-2 font-mono text-slate-500">{r.seq}</td><td className="text-slate-400">{r.ts.slice(0, 16).replace("T", " ")}</td><td>{r.actor}</td><td className="font-mono text-cyan-200">{r.action}</td><td className="text-slate-400">{r.target}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function OrgSettings({ info, onSaved }: { info: OrgInfo; onSaved: (o: OrgInfo) => void }) {
  const o = info.org!;
  const [f, setF] = useState({ name: o.name, domain: o.domain, seats: o.seats, require_mfa: !!o.require_mfa, stack: o.tech_stack.join(", ") });
  const [msg, setMsg] = useState("");
  return (
    <div className="panel max-w-2xl space-y-3 p-5">
      <h2 className="text-xl font-bold text-white">Organisation settings</h2>
      <label className="block text-sm text-slate-300">Name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-sm text-slate-300">Email domain<input className={inp} value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></label>
      <label className="block text-sm text-slate-300">Seats<input type="number" className={inp} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} /></label>
      <label className="block text-sm text-slate-300">Products and vendors you use (comma separated)<input className={inp} value={f.stack} placeholder="Microsoft Windows, Fortinet, Cisco, Apache, Tally" onChange={(e) => setF({ ...f, stack: e.target.value })} />
        <span className="text-[11px] text-slate-500">Matched daily against CISA's Known Exploited Vulnerabilities list.</span></label>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.require_mfa} onChange={(e) => setF({ ...f, require_mfa: e.target.checked })} />Require 2-step verification for admins (recommended)</label>
      <button className="rounded-lg bg-cyan-400 px-5 py-2 font-bold text-black" onClick={async () => {
        try { onSaved(await W.updateOrg({ name: f.name, domain: f.domain, seats: f.seats, require_mfa: f.require_mfa, tech_stack: f.stack.split(",").map((s) => s.trim()).filter(Boolean) })); setMsg("Saved ✓"); }
        catch (e) { setMsg((e as Error).message); } }}>Save</button> <span className="text-sm text-slate-300">{msg}</span>
    </div>
  );
}

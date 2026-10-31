"use client";

import { CheckCircle2, DollarSign, ExternalLink, FlaskConical, IndianRupee, Megaphone, MousePointerClick, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { A } from "@/lib/admin";
import { inp } from "./Crud";

const tip = { contentStyle: { background: "#060a13", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12 } };

export function Overview() {
  const [o, setO] = useState<Record<string, any> | null>(null);
  const [play, setPlay] = useState<Record<string, number>>({});
  useEffect(() => { A.overview().then(setO).catch(() => {}); A.playStats().then(setPlay).catch(() => {}); }, []);
  if (!o) return <p className="text-slate-500">Loading…</p>;
  const kpis = [
    ["Revenue (INR)", `₹${Number(o.revenue_inr).toLocaleString("en-IN")}`, IndianRupee, "text-emerald-300"],
    ["Revenue (USD)", `$${Number(o.revenue_usd).toFixed(2)}`, DollarSign, "text-emerald-300"],
    ["Users", o.users, Users, "text-cyan-300"],
    ["Premium users", o.premium_users, Users, "text-amber-300"],
    ["Checks (30 days)", o.checks_30d, CheckCircle2, "text-cyan-300"],
    ["Ad impressions", o.ad_impressions, Megaphone, "text-violet-300"],
    ["Ad clicks · CTR", `${o.ad_clicks} · ${o.ad_ctr}%`, MousePointerClick, "text-violet-300"],
    ["Affiliate clicks", o.aff_clicks, MousePointerClick, "text-emerald-300"],
    ["Reports to review", o.pending_reports, XCircle, "text-rose-300"],
    ["Content views", o.content_views, CheckCircle2, "text-cyan-300"],
    ["UPI orders to approve", o.pending_orders ?? 0, XCircle, "text-amber-300"],
    ["Accounts to approve", o.pending_users ?? 0, Users, "text-amber-300"],
    ["Codes redeemed", o.codes_redeemed ?? 0, CheckCircle2, "text-emerald-300"],
    ["SOS (30 days)", o.sos_30d ?? 0, XCircle, "text-rose-300"],
    ["Daily game players today", play.players_today ?? 0, Users, "text-orange-300"],
    ["Game players (7 days)", play.players_7d ?? 0, Users, "text-orange-300"],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map(([l, v, Icon, c]) => (
          <div key={l} className="panel p-3"><div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">{l}<Icon size={14} className={c} /></div>
            <div className={`mt-1 font-mono text-xl font-bold ${c}`}>{typeof v === "number" ? v.toLocaleString() : v}</div></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold text-white">Checks & signups — 30 days</h3>
          <div className="h-56"><ResponsiveContainer><AreaChart data={o.series}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} interval={4} /><YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} /><Tooltip {...tip} /><Legend />
            <Area dataKey="checks" stroke="#22d3ee" fill="#22d3ee33" /><Area dataKey="signups" stroke="#34d399" fill="#34d39933" /></AreaChart></ResponsiveContainer></div></div>
        <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold text-white">Earnings activity — 30 days</h3>
          <div className="h-56"><ResponsiveContainer><BarChart data={o.series}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} interval={4} /><YAxis tick={{ fill: "#64748b", fontSize: 10 }} /><Tooltip {...tip} /><Legend />
            <Bar dataKey="revenue_inr" name="Revenue ₹" fill="#34d399" /><Bar dataKey="ad_clicks" name="Ad clicks" fill="#a78bfa" /><Bar dataKey="aff_clicks" name="Affiliate clicks" fill="#fbbf24" /></BarChart></ResponsiveContainer></div></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold text-white">Top ads</h3>
          {o.top_ads.map((a: any) => <div key={a.id} className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-slate-200">{a.name} <span className="text-slate-500">{a.advertiser}</span></span><span className="font-mono text-slate-400">{a.impressions} views · {a.clicks} clicks</span></div>)}
          {!o.top_ads.length && <p className="text-sm text-slate-500">No ads yet.</p>}</div>
        <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold text-white">Top affiliate offers</h3>
          {o.top_affiliates.map((a: any) => <div key={a.id} className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-slate-200">{a.name}</span><span className="font-mono text-slate-400">{a.clicks} clicks</span></div>)}
          {!o.top_affiliates.length && <p className="text-sm text-slate-500">No affiliate offers yet.</p>}</div>
      </div>
    </div>
  );
}

export function Reports() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const load = () => A.reports(status).then(setRows).catch(() => {});
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white">Community scam reports</h2>
      <p className="text-sm text-slate-400">Approve real reports. Approved reports are shown publicly and warn everyone who checks the same number, UPI ID or link.</p>
      <div className="flex gap-2">{["pending", "approved", "rejected"].map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-sm ${status === s ? "bg-cyan-400 text-black" : "bg-white/5 text-slate-300"}`}>{s}</button>)}</div>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-slate-500">Nothing here.</p>}
        {rows.map((r) => (
          <div key={r.id} className="panel flex flex-wrap items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm text-rose-200">{r.kind.toUpperCase()} · {r.value}</div>
              <p className="text-sm text-slate-300">{r.description || "—"}</p>
              <p className="text-[11px] text-slate-500">{r.city || "—"} · ₹{r.amount_lost} · {r.created_at}</p>
            </div>
            {status !== "approved" && <button onClick={async () => { await A.reportStatus(r.id, "approved"); load(); }} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-bold text-black">Approve</button>}
            {status !== "rejected" && <button onClick={async () => { await A.reportStatus(r.id, "rejected"); load(); }} className="btn-ghost !py-1.5">Reject</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsersPanel() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const load = () => A.users(q).then(setRows).catch(() => {});
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white">Users</h2>
      <input className={inp + " max-w-sm"} placeholder="Search email, mobile or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="panel overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Email / mobile</th><th>Role</th><th>Premium</th><th>Checks</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((u) => (
          <tr key={u.id}><td className="p-2 text-slate-200">{u.email}<div className="font-mono text-[12px] text-slate-400">{u.phone}</div>{u.status === "pending" && <span className="text-[11px] text-amber-300">waiting for approval</span>}</td><td>{u.role}</td>
            <td>{u.premium ? <span className="text-amber-300">until {new Date(u.premium_until * 1000).toLocaleDateString()}</span> : "—"}</td>
            <td>{u.scans_total}</td><td className="text-slate-500">{(u.created_at || "").slice(0, 10)}</td>
            <td className="space-x-2 whitespace-nowrap p-2 text-right">
              <button className="text-amber-300" onClick={async () => { await A.userUpdate(u.id, { add_premium_days: 30 }); load(); }}>+30d premium</button>
              <button className="text-cyan-300" onClick={async () => { await A.userUpdate(u.id, { role: u.role === "admin" ? "user" : "admin" }); load(); }}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button>
              {u.status === "pending" && <button className="text-emerald-300" onClick={async () => { await A.approveUser(u.id); load(); }}>Approve</button>}
              <button className="text-rose-300" onClick={async () => { await A.userUpdate(u.id, { disabled: !u.disabled }); load(); }}>{u.disabled ? "Enable" : "Disable"}</button>
              <button className="text-rose-400" onClick={async () => { if (confirm(`Permanently delete ${u.email || u.phone}?`)) { try { await A.deleteUser(u.id); load(); } catch (e) { alert((e as Error).message); } } }}>Delete</button>
            </td></tr>))}</tbody></table></div>
    </div>
  );
}

export function PaymentsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { A.payments().then(setRows).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white">Payments</h2>
      <div className="panel overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">Date</th><th>User</th><th>Plan</th><th>Gateway</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((p) => (
          <tr key={p.id}><td className="p-2 text-slate-400">{p.created_at.slice(0, 16).replace("T", " ")}</td><td>{p.email}</td><td>{p.plan_id}</td><td>{p.provider}</td>
            <td className="font-mono">{p.currency === "INR" ? "₹" : "$"}{p.amount}</td>
            <td className={p.status === "paid" ? "text-emerald-300" : "text-slate-500"}>{p.status}</td></tr>))}
          {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No payments yet.</td></tr>}</tbody></table></div>
    </div>
  );
}

export function ProvidersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const load = () => A.providers().then((r) => { setRows(r); setKeys(Object.fromEntries(r.map((p: any) => [p.name, p.api_key || ""]))); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async (p: any, enabled: boolean) => { await A.saveProvider(p.name, { enabled, api_key: keys[p.name] }); setMsg({ ...msg, [p.name]: "Saved ✓" }); load(); };
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold text-white">Data providers</h2>
        <p className="text-sm text-slate-400">ProblemHunt combines many sources. Free feeds work with no key. For live lookups, create a free account at each provider, paste the API key, turn it on, and click Test.</p></div>
      {["feed", "lookup"].map((type) => (
        <div key={type} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{type === "feed" ? "Free threat feeds (auto-download every 30 min)" : "Live lookup APIs (called when a user checks something)"}</h3>
          {rows.filter((p) => p.type === type).map((p) => (
            <div key={p.name} className="panel flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2 font-semibold text-white">{p.label}
                  <a href={p.site} target="_blank" rel="noopener noreferrer" className="text-cyan-300"><ExternalLink size={13} /></a></div>
                <div className="text-[12px] text-slate-500">{p.free}{p.checks ? ` · checks: ${p.checks.join(", ")}` : ""}{p.note ? ` · ${p.note}` : ""}</div>
              </div>
              {p.needs_key && <input className={inp + " w-64"} placeholder="API key" value={keys[p.name] || ""} onChange={(e) => setKeys({ ...keys, [p.name]: e.target.value })} />}
              <button onClick={() => save(p, !p.enabled)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${p.enabled ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-300"}`}>{p.enabled ? "On" : "Off"}</button>
              {p.needs_key && <button className="btn-ghost" onClick={() => save(p, p.enabled)}>Save key</button>}
              {p.needs_key && <button className="btn-ghost" onClick={async () => { setMsg({ ...msg, [p.name]: "Testing…" }); try { const r = await A.testProvider(p.name); setMsg({ ...msg, [p.name]: `${r.ok ? "✓" : "✗"} ${r.status}: ${r.detail}` }); } catch (e) { setMsg({ ...msg, [p.name]: (e as Error).message }); } }}><FlaskConical size={14} />Test</button>}
              {msg[p.name] && <span className="w-full text-[12px] text-slate-300">{msg[p.name]}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function NotifyTest() {
  const [to, setTo] = useState("");
  const [r, setR] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
      <label className="block flex-1 text-[13px] text-slate-300"><span className="mb-1 block">Send a test (save settings first)</span>
        <input className={inp} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Your mobile or email" /></label>
      <button type="button" className="btn-ghost" onClick={async () => { setR("Sending…"); try { const x = await A.notifyTest(to); setR(`${x.ok ? "✓ Sent" : "✗"} via ${x.channel}: ${x.detail}`); } catch (e) { setR((e as Error).message); } }}>Send test</button>
      {r && <span className="w-full text-[12px] text-slate-300">{r}</span>}
    </div>
  );
}

export function SettingsPanel() {
  const [s, setS] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState("");
  const [slots, setSlots] = useState("");
  const [feeds, setFeeds] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [intelMsg, setIntelMsg] = useState("");
  useEffect(() => { A.settings().then((r) => { setS(r); setSlots(JSON.stringify(r.adsense_slots || {}, null, 0)); setFeeds(JSON.stringify(r.intel_feeds || [], null, 1)); }).catch(() => {}); }, []);
  if (!s) return <p className="text-slate-500">Loading…</p>;
  const F = ({ k, label, help, type = "text" }: { k: string; label: string; help?: string; type?: string }) => (
    <div key={k} className="contents">
    <label className="block text-[13px] text-slate-300"><span className="mb-1 block">{label}</span>
      {type === "bool" ? <button type="button" onClick={() => setS({ ...s, [k]: !s[k] })} className={`rounded-full px-3 py-1.5 text-sm ${s[k] ? "bg-emerald-400 text-black" : "bg-white/10"}`}>{s[k] ? "Yes" : "No"}</button>
        : <input type={type} className={inp} value={s[k] ?? ""} onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />}
      {help && <span className="mt-0.5 block text-[11px] text-slate-500">{help}</span>}</label></div>
  );
  const save = async () => {
    let parsed = {};
    try { parsed = slots.trim() ? JSON.parse(slots) : {}; } catch { setSaved("AdSense slots must be valid JSON"); return; }
    let fl: unknown = [];
    try { fl = feeds.trim() ? JSON.parse(feeds) : []; if (!Array.isArray(fl)) throw new Error(); } catch { setSaved("Intel feeds must be a JSON list"); return; }
    try { const r = await A.saveSettings({ ...s, adsense_slots: parsed, intel_feeds: fl }); setS(r); setSaved("Saved ✓"); } catch (e) { setSaved((e as Error).message); }
  };
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">Settings</h2>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">General</h3>
        {F({ k: "site_name", label: "Site name" })}{F({ k: "tagline", label: "Tagline" })}
        {F({ k: "site_url", label: "Public site URL", help: "e.g. https://problemhunt.com — used for payment return links" })}
        {F({ k: "support_email", label: "Support email" })}
        {F({ k: "free_daily_limit", label: "Free checks per day", type: "number", help: "Logged-out users are limited per device/IP" })}
        {F({ k: "community_auto_publish", label: "Auto-publish community reports", type: "bool", help: "Off = you approve each report first (recommended)" })}
        {F({ k: "require_approval", label: "Require admin approval for new accounts", type: "bool", help: "On = new sign-ups wait in Admin → Approvals" })}
        {F({ k: "emergency_number", label: "Emergency number (SOS page)", help: "India: 112" })}
        {F({ k: "cyber_helpline", label: "Cyber-crime helpline", help: "India: 1930" })}
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Login codes &amp; SOS alerts — Email (SMTP)</h3>
        <p className="text-[12px] text-slate-400 sm:col-span-2">Used to send 6-digit login codes and SOS alerts by email. Gmail: smtp.gmail.com, port 587, your Gmail address and a Google <b>App Password</b>. Brevo, Zoho, SES also work. Until this is set, codes are printed in the server window (developer mode).</p>
        {F({ k: "smtp_host", label: "SMTP host" })}{F({ k: "smtp_port", label: "Port", type: "number", help: "587 (TLS) or 465 (SSL)" })}
        {F({ k: "smtp_user", label: "Username" })}{F({ k: "smtp_password", label: "Password / app password", type: "password" })}
        {F({ k: "smtp_from", label: "From address", help: "e.g. ProblemHunt <alerts@problemhunt.com>" })}
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Login codes &amp; SOS alerts — SMS</h3>
        <label className="block text-[13px] text-slate-300"><span className="mb-1 block">SMS provider</span>
          <select className={inp} value={s.sms_provider || ""} onChange={(e) => setS({ ...s, sms_provider: e.target.value })}>
            <option value="">Off (developer mode)</option><option value="twilio">Twilio</option><option value="webhook">Any SMS gateway URL (MSG91, Fast2SMS, Textlocal…)</option></select></label>
        {F({ k: "default_country_code", label: "Default country code", help: "+91 — added to 10-digit numbers" })}
        {s.sms_provider === "twilio" && <>{F({ k: "twilio_sid", label: "Twilio Account SID" })}{F({ k: "twilio_token", label: "Twilio Auth Token", type: "password" })}{F({ k: "twilio_from", label: "Twilio phone number (+1…)" })}</>}
        {s.sms_provider === "webhook" && <label className="block text-[13px] text-slate-300 sm:col-span-2"><span className="mb-1 block">Gateway URL</span>
          <input type="password" className={inp + " font-mono"} value={s.sms_webhook_url ?? ""} onChange={(e) => setS({ ...s, sms_webhook_url: e.target.value })} placeholder="https://provider.example/send?key=KEY&to={phone_digits}&msg={message}" />
          <span className="mt-0.5 block text-[11px] text-slate-500">Placeholders: {"{phone}"} (+91…), {"{phone_digits}"} (91…), {"{message}"}. Must start with https://. India needs a DLT-approved template with your provider.</span></label>}
        <NotifyTest />
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Manual UPI payments (no gateway needed)</h3>
        {F({ k: "manual_payment_upi", label: "Your UPI ID", help: "e.g. yourname@okhdfcbank — shows a QR on the Premium page. Leave empty to hide." })}
        {F({ k: "manual_payment_note", label: "Note shown to customers", help: "e.g. Approved within 2 hours, 9am–9pm" })}
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">AI assistants (free, open-source models)</h3>
        <p className="text-[12px] text-slate-400 sm:col-span-2">Any OpenAI-compatible endpoint. Free options: <b>Ollama</b> on this computer (base URL http://localhost:11434/v1, model e.g. llama3.1 or qwen2.5, no key) or a free <b>Groq</b> key (https://api.groq.com/openai/v1). Leave empty for rules-only answers from ProblemHunt&apos;s knowledge base. Phone numbers, emails, Aadhaar and card numbers are masked before text is sent to the model.</p>
        {F({ k: "llm_base_url", label: "Base URL" })}{F({ k: "llm_model", label: "Model name" })}
        {F({ k: "llm_api_key", label: "API key (if needed)", type: "password" })}{F({ k: "ai_free_daily", label: "Free AI messages per user per day", type: "number" })}
        <div className="flex items-center gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={async () => { setAiMsg("Testing… (save first)"); try { const r = await A.aiTest(); setAiMsg(`${r.ok ? "✓" : "✗"} ${r.detail}`); } catch (e) { setAiMsg((e as Error).message); } }}>Test AI connection</button><span className="text-[12px] text-slate-300">{aiMsg}</span></div>
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Threat intelligence feeds</h3>
        <p className="text-[12px] text-slate-400 sm:col-span-2">CISA KEV, FIRST EPSS and NIST NVD download every 6 hours automatically. Add any government CERT or vendor RSS/Atom feed below (e.g. CERT-In, your sector ISAC).</p>
        {F({ k: "intel_enabled", label: "Automatic downloads", type: "bool" })}{F({ k: "nvd_api_key", label: "NVD API key (optional, raises limits)", type: "password" })}
        <label className="block text-[13px] text-slate-300 sm:col-span-2"><span className="mb-1 block">RSS / Atom feeds (JSON list of name, url, region)</span>
          <textarea rows={6} className={inp + " font-mono text-[12px]"} value={feeds} onChange={(e) => setFeeds(e.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={async () => { setIntelMsg("Downloading…"); try { setIntelMsg(JSON.stringify(await A.intelRefresh())); } catch (e) { setIntelMsg((e as Error).message); } }}>Refresh now</button>
          <button type="button" className="btn-ghost" onClick={async () => { setIntelMsg("Loading full MITRE ATT&CK (~40 MB)…"); try { const r = await A.attackFull(); setIntelMsg(`Loaded ${r.loaded} techniques`); } catch (e) { setIntelMsg((e as Error).message); } }}>Load full MITRE ATT&amp;CK</button>
          <span className="text-[12px] text-slate-300">{intelMsg}</span></div>
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Google AdSense</h3>
        {F({ k: "adsense_client", label: "Publisher ID", help: "ca-pub-XXXXXXXXXXXXXXXX — fills ad slots that have no direct sponsor" })}
        {F({ k: "show_ads_to_premium", label: "Show ads to Premium users", type: "bool" })}
        <label className="block text-[13px] text-slate-300 sm:col-span-2"><span className="mb-1 block">Slot IDs per placement (JSON, optional)</span>
          <input className={inp + " font-mono"} value={slots} onChange={(e) => setSlots(e.target.value)} placeholder='{"home_top":"1234567890","result":"..."}' /></label>
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Razorpay (India · UPI, cards, wallets)</h3>
        {F({ k: "razorpay_key_id", label: "Key ID", help: "Dashboard → Account & Settings → API Keys" })}{F({ k: "razorpay_key_secret", label: "Key Secret", type: "password" })}
      </section>
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-white sm:col-span-2">Stripe (international cards)</h3>
        {F({ k: "stripe_secret_key", label: "Secret key (sk_live_… or sk_test_…)", type: "password" })}
        {F({ k: "stripe_webhook_secret", label: "Webhook signing secret (whsec_…)", type: "password", help: `Webhook URL: ${origin}/api/pay/stripe/webhook · event: checkout.session.completed` })}
      </section>
      <div className="flex items-center gap-3"><button onClick={save} className="rounded-lg bg-cyan-400 px-6 py-2.5 font-bold text-black">Save settings</button><span className="text-sm text-slate-300">{saved}</span></div>
    </div>
  );
}

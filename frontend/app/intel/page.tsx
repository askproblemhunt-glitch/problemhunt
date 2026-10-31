"use client";

import { AlertOctagon, ExternalLink, Globe2, Radar, Search, ShieldAlert, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import GovtLinks from "@/components/site/GovtLinks";
import ShareImageButton from "@/components/site/ShareCard";
import { I, type Advisory, type Cve, type FraudItem, type Technique } from "@/lib/v5";

const TABS = [["fraud", "Fraud center"], ["cves", "Exploited vulnerabilities"], ["advisories", "Advisories"], ["attack", "MITRE ATT&CK"]] as const;
const inp = "rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60";

export default function IntelPage() {
  const [tab, setTab] = useState<string>("fraud");
  const [cve, setCve] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("cve")) { setTab("cves"); setCve(p.get("cve")); }
    if (p.get("tab")) setTab(p.get("tab")!);
  }, []);
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header><h1 className="flex items-center gap-2 text-3xl font-black text-white"><Radar className="text-cyan-300" />Threat &amp; Fraud Intelligence</h1>
        <p className="text-slate-400">Live, public sources only: CISA KEV, FIRST EPSS, NIST NVD, government CERT advisories, MITRE ATT&amp;CK and ProblemHunt community reports.</p></header>
      <Summary />
      <div className="flex gap-1 overflow-x-auto">{TABS.map(([id, l]) => (
        <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${tab === id ? "bg-white text-black" : "bg-white/5 text-slate-300"}`}>{l}</button>))}</div>
      {tab === "fraud" && <Frauds />}
      {tab === "cves" && <Cves open={cve} />}
      {tab === "advisories" && <Advisories />}
      {tab === "attack" && <Attack />}
    </div>
  );
}

function Summary() {
  const [s, setS] = useState<Awaited<ReturnType<typeof I.summary>> | null>(null);
  useEffect(() => { I.summary().then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const tiles = [["Exploited CVEs (KEV)", s.kev_total], ["Added in 30 days", s.kev_30d], ["Used by ransomware", s.ransomware], ["Critical CVEs, 7 days", s.critical_7d], ["Advisories, 7 days", s.advisories_7d]] as const;
  const fresh = s.runs.find((r) => r.source === "cisa_kev")?.last_ok;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{tiles.map(([l, v]) => (
        <div key={l} className="panel p-3"><div className="font-mono text-2xl font-bold text-white">{v}</div><div className="text-[11.5px] text-slate-400">{l}</div></div>))}</div>
      <p className="mt-1 text-[11.5px] text-slate-500">{fresh ? `KEV updated ${fresh.slice(0, 16).replace("T", " ")} UTC · refreshed every 6 hours` : "Feeds download automatically every 6 hours once the server has internet access."}</p>
    </div>
  );
}

function Gauge({ v, label }: { v: number; label: string }) {
  const c = v >= 75 ? "bg-rose-500" : v >= 50 ? "bg-amber-400" : "bg-emerald-400";
  return <div className="text-[11px] text-slate-400">{label} <span className="font-mono text-white">{v}</span><div className="mt-0.5 h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div></div>;
}

function Frauds() {
  const [rows, setRows] = useState<FraudItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { I.frauds().then((r) => setRows(r.items)).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Ranked by risk × impact. Risk rises automatically when ProblemHunt users report or check more of a fraud type this week.</p>
      {rows.map((f) => (
        <div key={f.id} className="panel p-4">
          <button className="flex w-full flex-wrap items-center gap-4 text-left" onClick={() => setOpen(open === f.id ? null : f.id)}>
            <div className="min-w-[220px] flex-1"><div className="font-bold text-white">{f.title}</div>
              <div className="text-[12px] text-slate-400">{f.channels.join(" · ")} {f.week_count ? `· ${f.week_count} this week` : ""}</div></div>
            <Gauge v={f.risk} label="Risk" /><Gauge v={f.impact} label="Impact" />
            <div className="hidden text-[11px] text-slate-400 sm:block"><Globe2 size={12} className="inline" /> {f.countries.join(", ")}</div>
          </button>
          {open === f.id && (
            <div className="mt-3 grid gap-3 border-t border-white/5 pt-3 text-sm md:grid-cols-2">
              <div><h4 className="font-semibold text-white">How it works</h4><p className="text-slate-300">{f.how}</p>
                <h4 className="mt-2 font-semibold text-white">Red flags</h4><ul className="list-disc pl-5 text-slate-300">{f.flags.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h4 className="font-semibold text-white">Prevention</h4><ul className="list-disc pl-5 text-slate-300">{f.stop.map((x) => <li key={x}>{x}</li>)}</ul>
                <h4 className="mt-2 font-semibold text-white">If it happened to you</h4><ul className="list-disc pl-5 text-slate-300">{f.victim.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-slate-500">Official advisories:</span>{f.advisories.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-cyan-300">{a.name}<ExternalLink size={11} /></a>)}
                <span className="ml-2 text-slate-500">ATT&amp;CK:</span>{f.attack.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="rounded bg-white/5 px-2 py-0.5 font-mono text-slate-300">{a.id}</a>)}
              </div>
              <div className="md:col-span-2"><ShareImageButton label="Share awareness card" spec={{ badge: "⚠ SCAM ALERT", color: "#f43f5e", title: f.title, lines: f.flags.slice(0, 3).concat(f.stop.slice(0, 1)) }} /></div>
            </div>)}
        </div>))}
      <GovtLinks />
    </div>
  );
}

function Cves({ open }: { open: string | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("date");
  const [rw, setRw] = useState(false);
  const [rows, setRows] = useState<Cve[]>([]);
  const [sel, setSel] = useState<string | null>(open);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof I.cve>> | null>(null);
  useEffect(() => { const h = setTimeout(() => I.cves(q, sort, rw).then(setRows).catch(() => {}), 250); return () => clearTimeout(h); }, [q, sort, rw]);
  useEffect(() => { if (sel) I.cve(sel).then(setDetail).catch(() => setDetail(null)); }, [sel]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" /><input className={inp + " pl-8"} placeholder="CVE, vendor or product" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={inp} value={sort} onChange={(e) => setSort(e.target.value)}><option value="date">Newest</option><option value="epss">Most likely exploited (EPSS)</option><option value="cvss">Highest CVSS</option></select>
        <label className="text-sm text-slate-300"><input type="checkbox" checked={rw} onChange={(e) => setRw(e.target.checked)} /> Used by ransomware</label>
      </div>
      {detail && <div className="panel border-cyan-400/40 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-mono text-lg font-bold text-white">{detail.cve}</h3>
          <div className="flex gap-2"><a href={detail.links.nvd} target="_blank" rel="noopener noreferrer" className="text-cyan-300">NVD ↗</a><a href={detail.links.cve_org} target="_blank" rel="noopener noreferrer" className="text-cyan-300">CVE.org ↗</a></div></div>
        <div className="text-white">{detail.vendor} {detail.product} — {detail.name}</div>
        <p className="mt-1 text-slate-300">{detail.description}</p>
        {detail.required_action && <p className="mt-1 text-amber-200">Action: {detail.required_action} (CISA due date {detail.due_date})</p>}
        {detail.advisories.length > 0 && <ul className="mt-2 list-disc pl-5">{detail.advisories.map((a) => <li key={a.link}><a href={a.link} target="_blank" rel="noopener noreferrer" className="text-cyan-300">{a.source}: {a.title}</a></li>)}</ul>}
      </div>}
      <div className="panel overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-[11px] uppercase text-slate-500"><tr><th className="p-2">CVE</th><th>Product</th><th>Added</th><th>Due</th><th>EPSS</th><th>Ransomware</th></tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map((c) => (
          <tr key={c.cve} onClick={() => setSel(c.cve)} className="cursor-pointer hover:bg-white/5"><td className="p-2 font-mono text-cyan-300">{c.cve}</td>
            <td><div className="text-white">{c.vendor} {c.product}</div><div className="line-clamp-1 text-[11.5px] text-slate-500">{c.name}</div></td>
            <td className="text-slate-400">{c.date_added || c.published}</td><td className="text-slate-400">{c.due_date}</td>
            <td className="font-mono">{c.epss != null ? `${(c.epss * 100).toFixed(1)}%` : "—"}</td>
            <td>{c.ransomware === "Known" ? <span className="inline-flex items-center gap-1 text-rose-300"><AlertOctagon size={13} />Known</span> : "—"}</td></tr>))}
          {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No data yet — the CISA KEV feed downloads automatically when the server is online (admin can press "Refresh now").</td></tr>}</tbody></table></div>
    </div>
  );
}

function Advisories() {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const [d, setD] = useState<{ items: Advisory[]; sources: string[] }>({ items: [], sources: [] });
  useEffect(() => { const h = setTimeout(() => I.advisories(q, src).then(setD).catch(() => {}), 250); return () => clearTimeout(h); }, [q, src]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><input className={inp} placeholder="Search advisories" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp} value={src} onChange={(e) => setSrc(e.target.value)}><option value="">All sources</option>{d.sources.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="space-y-2">{d.items.map((a) => (
        <a key={a.id} href={a.link} target="_blank" rel="noopener noreferrer" className="panel block p-3 transition hover:border-cyan-400/40">
          <div className="text-[11.5px] text-slate-500">{a.source} · {a.region} · {(a.published || "").slice(0, 10)}</div>
          <div className="font-semibold text-white">{a.title} <ExternalLink size={12} className="inline text-slate-500" /></div>
          {a.summary && <p className="line-clamp-2 text-[13px] text-slate-400">{a.summary}</p>}
        </a>))}
        {!d.items.length && <p className="panel p-6 text-center text-sm text-slate-500">No advisories yet. Government and vendor feeds (CISA, NCSC UK, CERT-EU and more — admins can add CERT-In or any RSS) download every 6 hours.</p>}</div>
    </div>
  );
}

function Attack() {
  const [q, setQ] = useState("");
  const [tactic, setTactic] = useState("");
  const [d, setD] = useState<{ items: Technique[]; tactics: string[] }>({ items: [], tactics: [] });
  useEffect(() => { const h = setTimeout(() => I.attack(q, tactic).then(setD).catch(() => {}), 200); return () => clearTimeout(h); }, [q, tactic]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><input className={inp} placeholder="Technique id or name (e.g. T1566, phishing)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp} value={tactic} onChange={(e) => setTactic(e.target.value)}><option value="">All tactics</option>{d.tactics.map((t) => <option key={t}>{t}</option>)}</select></div>
      <div className="grid gap-2 sm:grid-cols-2">{d.items.map((t) => (
        <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer" className="panel p-3 transition hover:border-cyan-400/40">
          <div className="flex items-center gap-2"><Swords size={14} className="text-violet-300" /><span className="font-mono text-cyan-300">{t.id}</span><span className="font-semibold text-white">{t.name}</span></div>
          <div className="text-[11.5px] text-slate-500">{t.tactic}</div><p className="text-[13px] text-slate-400">{t.description}</p></a>))}</div>
      <p className="text-[12px] text-slate-500">MITRE ATT&amp;CK® is a registered trademark of The MITRE Corporation. Core techniques are built in; an admin can load the full catalogue. <Link href="/ai/?agent=threat" className="text-cyan-300">Ask the Threat hunter →</Link></p>
      <p className="flex items-center gap-1 text-[12px] text-slate-500"><ShieldAlert size={12} />Defensive use only.</p>
    </div>
  );
}

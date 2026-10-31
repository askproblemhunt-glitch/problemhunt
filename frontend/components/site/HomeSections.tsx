"use client";

import { AlertTriangle, Eye, KeyRound, Loader2, Phone, PlayCircle, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, asset, type Affiliate, type Content, type Report } from "@/lib/product";
import type { ThreatEvent } from "@/lib/types";
import { timeAgo } from "../ui";
import AffiliateCards from "./AffiliateCards";

export function StatsStrip() {
  const { t } = useI18n();
  const [s, setS] = useState<Awaited<ReturnType<typeof P.stats>> | null>(null);
  useEffect(() => {
    const go = () => P.stats().then(setS).catch(() => {});
    go(); const id = setInterval(go, 15000); return () => clearInterval(id);
  }, []);
  const items = [
    [t("stat_checks"), s?.checks_today], [t("stat_dangers"), s?.dangers_today],
    [t("stat_reports"), s?.reports_total], [t("stat_iocs"), s?.intel_iocs],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="panel p-3 text-center">
          <div className="font-mono text-2xl font-bold tabular-nums text-cyan-300">{v == null ? "—" : Number(v).toLocaleString()}</div>
          <div className="text-[11.5px] text-slate-400">{k}</div>
        </div>
      ))}
    </div>
  );
}

export function LiveAlerts() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<ThreatEvent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    const go = () => { P.stats().then((s) => setAlerts(s.latest_alerts)).catch(() => {}); P.recentReports().then(setReports).catch(() => {}); };
    go(); const id = setInterval(go, 10000); return () => clearInterval(id);
  }, []);
  const rows = [
    ...reports.slice(0, 6).map((r) => ({ id: r.id, title: `${r.kind.toUpperCase()}: ${r.value}`, sub: r.description || `${r.times_reported}× reported`, ts: r.created_at, tag: "community" })),
    ...alerts.map((a) => ({ id: a.id, title: a.title, sub: a.sample, ts: a.ts, tag: a.source })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10);
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Radio size={18} className="animate-pulse text-rose-400" />{t("live_alerts")}</h2>
          <p className="text-[13px] text-slate-400">{t("live_alerts_sub")}</p>
        </div>
        <Link href="/threats/" className="text-sm text-cyan-300">{t("nav_live")} →</Link>
      </div>
      <div className="panel divide-y divide-white/5">
        {rows.length === 0 && <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" />…</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
            <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${r.tag === "community" ? "text-amber-300" : "text-rose-400"}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-slate-100">{r.title}</div>
              <div className="truncate font-mono text-[11px] text-slate-500">{r.sub}</div>
            </div>
            <div className="shrink-0 text-right text-[10.5px] text-slate-500">
              <div className={`rounded px-1.5 py-0.5 font-semibold uppercase ${r.tag === "community" ? "bg-amber-400/10 text-amber-300" : r.tag === "scan" ? "bg-cyan-400/10 text-cyan-300" : "bg-rose-500/10 text-rose-300"}`}>{r.tag === "intel" ? "live feed" : r.tag}</div>
              <div className="mt-0.5">{timeAgo(r.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ContentCards({ items }: { items: Content[] }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <Link key={c.id} href={`/learn/?id=${c.id}`} className="panel group overflow-hidden transition hover:border-cyan-400/40">
          {c.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset(c.image_url)} alt="" className="h-36 w-full object-cover" loading="lazy" />
          ) : c.kind === "video" ? (
            <div className="grid h-36 place-items-center bg-gradient-to-br from-cyan-500/20 to-violet-500/20"><PlayCircle size={44} className="text-white/80" /></div>
          ) : null}
          <div className="p-4">
            <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-cyan-300">
              {c.kind === "video" ? t("videos") : c.kind === "tip" ? t("tips") : t("articles")}
              {c.premium_only ? <span className="text-amber-300">★ Premium</span> : null}
            </div>
            <h3 className="font-semibold leading-snug text-white group-hover:text-cyan-200">{c.title}</h3>
            <p className="mt-1 line-clamp-2 text-[13px] text-slate-400">{c.summary}</p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><Eye size={12} />{c.views} {t("views")}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function HelpPanel() {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.07] p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-rose-100"><AlertTriangle size={20} className="text-rose-400" />{t("help_title")}</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-black/20 p-3 text-[14px] text-slate-100">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500 text-xs font-bold text-white">{i}</span>{t(`help_${i}`)}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="tel:1930" className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 font-bold text-white"><Phone size={16} />1930</a>
        <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="btn-ghost !py-2">cybercrime.gov.in ↗</a>
      </div>
    </section>
  );
}

async function sha1Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Have I Been Pwned "Pwned Passwords" k-anonymity: only the first 5 hash chars leave the device. */
export function PasswordCheck() {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [state, setState] = useState<{ n: number } | "busy" | "err" | null>(null);
  const go = async () => {
    if (!pw) return;
    setState("busy");
    try {
      const h = await sha1Hex(pw);
      const r = await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
      const text = await r.text();
      const line = text.split("\n").find((l) => l.startsWith(h.slice(5)));
      setState({ n: line ? parseInt(line.split(":")[1], 10) : 0 });
    } catch { setState("err"); }
  };
  return (
    <div className="panel p-4">
      <h3 className="flex items-center gap-2 font-semibold text-white"><KeyRound size={17} className="text-violet-300" />{t("pw_title")}</h3>
      <p className="mt-1 text-[12.5px] text-slate-400">{t("pw_sub")}</p>
      <div className="mt-3 flex gap-2">
        <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setState(null); }} autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-white outline-none focus:border-violet-400/50" />
        <button onClick={go} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">{state === "busy" ? "…" : t("pw_btn")}</button>
      </div>
      {state && typeof state === "object" && (
        <p className={`mt-2 text-sm font-semibold ${state.n ? "text-rose-300" : "text-emerald-300"}`}>
          {state.n ? t("pw_leaked", { n: state.n.toLocaleString() }) : t("pw_safe")}
        </p>
      )}
    </div>
  );
}

export function AffiliateSection() {
  const { lang } = useI18n();
  const [items, setItems] = useState<Affiliate[]>([]);
  useEffect(() => { P.affiliates(lang).then((r) => setItems(r.slice(0, 6))).catch(() => {}); }, [lang]);
  return <AffiliateCards items={items} />;
}

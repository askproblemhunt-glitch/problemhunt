"use client";

import { ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useDefenseGrid } from "@/lib/useDefenseGrid";
import type { Rule, ThreatEvent } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";
import { CategoryChart, TimelineChart } from "./Charts";
import Header from "./Header";
import ImmunityGauge from "./ImmunityGauge";
import { EnginePanel, NodesPanel } from "./NodesPanel";
import RulesPanel from "./RulesPanel";
import Scanner from "./Scanner";
import StatCards from "./StatCards";
import ThreatFeed from "./ThreatFeed";
import ThreatRadar from "./ThreatRadar";

type Toast = { id: string; title: string; body: string; color: string; icon: "threat" | "rule" };

export default function CommandCenter() {
  const grid = useDefenseGrid();
  const { snapshot: snap } = grid;
  const lockdown = !!snap?.stats.lockdown;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, force] = useState(0);

  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 5000); return () => clearInterval(t); }, []); // refresh "time ago"

  const push = (t: Toast) => {
    setToasts((ts) => [t, ...ts].slice(0, 3));
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 5200);
  };

  useEffect(() => {
    const t: ThreatEvent | null = grid.lastThreat;
    if (t && t.severity === "critical" && t.action === "neutralized")
      push({ id: t.id, title: "Threat neutralized", body: `${t.title} · ${t.node}`, color: SEV_COLOR.critical, icon: "threat" });
  }, [grid.lastThreat]);

  useEffect(() => {
    const r: Rule | null = grid.newRule;
    if (r) push({ id: r.id, title: "AI agent learned a new rule", body: `“${r.pattern}” → ${snap?.categories[r.category] ?? r.category}`, color: "#a78bfa", icon: "rule" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.newRule]);

  const toggleLockdown = async (v: boolean) => {
    try { await grid.setLockdown(v); } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className={lockdown ? "lockdown" : ""}>
      <Header conn={grid.conn} lockdown={lockdown} onLockdown={toggleLockdown} />

      {lockdown && (
        <div className="border-b border-rose-500/40 bg-rose-500/10">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <ShieldAlert className="animate-alarm text-rose-400" size={18} />
            <p className="text-[13px] text-rose-100">
              <b className="uppercase tracking-wider">Emergency lockdown active.</b> Every node now quarantines anything even slightly suspicious —
              links, QR payments and unknown callers. Freeze cards via your bank app and don't approve any payment request.
            </p>
            <button onClick={() => toggleLockdown(false)} className="ml-auto rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20">Release</button>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="lg:col-span-3"><ImmunityGauge immunity={snap?.immunity} lockdown={lockdown} /></div>
        <div className="flex flex-col gap-4 lg:col-span-9">
          <StatCards snap={snap} ruleCount={grid.rules.length} />
          <TimelineChart stats={snap?.stats} />
        </div>

        <div className="lg:col-span-6"><ThreatRadar blips={grid.radar} /></div>
        <div className="lg:col-span-6"><ThreatFeed threats={grid.threats} /></div>

        <div className="lg:col-span-7"><Scanner nodeName={grid.me?.name} /></div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <NodesPanel nodes={snap?.nodes ?? []} meId={grid.me?.id} />
          <EnginePanel engine={snap?.engine} />
        </div>

        <div className="lg:col-span-8"><RulesPanel rules={grid.rules} labels={snap?.categories} freshId={grid.newRule?.id} /></div>
        <div className="lg:col-span-4"><CategoryChart stats={snap?.stats} labels={snap?.categories} /></div>
      </main>

      <footer className="mx-auto max-w-[1600px] px-6 pb-4 text-center text-[11px] text-slate-600">
        ProblemHunt v{snap?.version ?? "1.0.0"} · {snap?.engine.simulation ? "Demo drills ON (labelled “sim drill”). " : "Real data mode: live OpenPhish/URLhaus intel, your scans and your real devices. "}Malicious URLs are shown defanged and are never opened. “Blocklisted” = your scanner will now block it; ProblemHunt cannot block traffic in other apps.
      </footer>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto animate-slidein rounded-xl border bg-void-900/95 p-3 shadow-2xl backdrop-blur" style={{ borderColor: `${t.color}66` }}>
            <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: t.color }}>
              {t.icon === "rule" ? <Sparkles size={14} /> : <ShieldAlert size={14} />}{t.title}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-slate-300">{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

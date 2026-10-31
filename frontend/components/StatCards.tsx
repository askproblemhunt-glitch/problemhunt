import { BrainCircuit, Radar, ScanSearch, ShieldCheck } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { fmtNum } from "./ui";

export default function StatCards({ snap, ruleCount }: { snap: Snapshot | null; ruleCount: number }) {
  const s = snap?.stats;
  const e = snap?.engine;
  const cards = [
    { label: "Threats neutralized", value: fmtNum(s?.neutralized), sub: `${fmtNum(s?.flagged)} flagged for review`, icon: ShieldCheck, tone: "text-emerald-300", glow: "from-emerald-400/20" },
    { label: "Signals scanned", value: fmtNum(s?.scanned), sub: `${snap?.immunity.neutralize_rate ?? 100}% auto-neutralize rate`, icon: ScanSearch, tone: "text-cyan-300", glow: "from-cyan-400/20" },
    { label: "AI-learned rules", value: fmtNum(e?.learned_rules ?? ruleCount), sub: `${fmtNum(e?.total_rules)} active signatures`, icon: BrainCircuit, tone: "text-violet-300", glow: "from-violet-400/20" },
    { label: "Live intel IOCs", value: fmtNum(e?.intel_iocs), sub: e?.intel_sources.length ? e.intel_sources.join(" · ") : "OpenPhish · URLhaus (syncing)", icon: Radar, tone: "text-amber-300", glow: "from-amber-400/20" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon, tone, glow }) => (
        <div key={label} className="panel relative overflow-hidden p-4">
          <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${glow} to-transparent blur-xl`} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
            <Icon size={16} className={tone} />
          </div>
          <div className={`mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl ${tone}`}>{value}</div>
          <div className="mt-1 truncate text-[11px] text-slate-500">{sub}</div>
        </div>
      ))}
    </div>
  );
}

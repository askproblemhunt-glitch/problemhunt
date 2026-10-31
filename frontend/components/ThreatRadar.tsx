"use client";

import { Globe2, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { RadarBlip } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";
import { Panel, SevBadge, Tag, fmtNum, timeAgo } from "./ui";

const TREND_TONE = { emerging: "rose", spreading: "amber", contained: "mint" } as const;

export default function ThreatRadar({ blips }: { blips: RadarBlip[] }) {
  const [hover, setHover] = useState<RadarBlip | null>(null);
  const shown = blips.slice(0, 18);
  return (
    <Panel
      title="Global Live Threat Radar"
      icon={<Globe2 size={14} />}
      right={<span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />SWEEPING</span>}
      className="h-full"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto aspect-square w-full max-w-[300px]">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <defs>
              <radialGradient id="rg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity=".16" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity=".55" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#rg)" stroke="#22d3ee33" />
            {[24, 48, 72].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#22d3ee22" strokeDasharray="2 3" />)}
            <line x1="2" y1="100" x2="198" y2="100" stroke="#22d3ee1f" />
            <line x1="100" y1="2" x2="100" y2="198" stroke="#22d3ee1f" />
            <g className="origin-center animate-sweep" style={{ transformOrigin: "100px 100px" }}>
              <path d="M100 100 L198 100 A98 98 0 0 0 169.3 30.7 Z" fill="url(#sweep)" opacity=".5" />
              <line x1="100" y1="100" x2="198" y2="100" stroke="#67e8f9" strokeWidth="1.2" />
            </g>
            {shown.map((b, i) => {
              const a = ((b.bearing - 90) * Math.PI) / 180;
              const x = 100 + Math.cos(a) * b.distance * 94;
              const y = 100 + Math.sin(a) * b.distance * 94;
              const c = SEV_COLOR[b.severity];
              const fresh = i < 3;
              return (
                <g key={b.id} onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                  {fresh && <circle cx={x} cy={y} r="3" fill={c} className="animate-ping2" style={{ transformOrigin: `${x}px ${y}px` }} />}
                  <circle cx={x} cy={y} r={b.severity === "critical" ? 3.6 : 2.6} fill={c} opacity={1 - i * 0.04} />
                </g>
              );
            })}
            <circle cx="100" cy="100" r="3" fill="#22d3ee" />
          </svg>
          {hover && (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md border border-white/10 bg-void-950/90 p-2 text-[11px] backdrop-blur">
              <div className="font-semibold text-slate-100">{hover.title}</div>
              <div className="text-slate-400">{hover.region} · {fmtNum(hover.reports)} reports</div>
            </div>
          )}
        </div>

        <ol className="feed-scroll max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
          {blips.length === 0 && (
            <li className="rounded-md border border-dashed border-white/10 p-4 text-center text-[12px] text-slate-500">
              Building real campaign map from live phishing feeds… first campaigns appear within a minute.
            </li>
          )}
          {blips.slice(0, 14).map((b) => (
            <li key={b.id} className="animate-slidein rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium leading-snug text-slate-100">{b.title}</span>
                <SevBadge severity={b.severity} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                <span>{b.region}</span>
                <Tag tone={TREND_TONE[b.trend]}><TrendingUp size={9} />{b.trend}</Tag>
                {b.source === "intel" ? <Tag tone="cyan">live feed</Tag> : <Tag>sim</Tag>}
                <span className="font-mono">{fmtNum(b.reports)} {b.source === "intel" ? "live URLs" : "rpts"}</span>
                <span className="ml-auto font-mono">{timeAgo(b.ts)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

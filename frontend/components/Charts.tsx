"use client";

import { BarChart3, PieChart } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Stats } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";
import { Panel } from "./ui";

const tooltipStyle = {
  contentStyle: { background: "#060a13", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
  cursor: { fill: "rgba(34,211,238,.05)" },
};

export function TimelineChart({ stats }: { stats?: Stats }) {
  return (
    <Panel title="Threat Velocity · last 30 min" icon={<BarChart3 size={14} />}
      right={<div className="flex gap-3 text-[10px] text-slate-400">{(["critical", "high", "medium", "low"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: SEV_COLOR[s] }} />{s}</span>))}</div>}>
      <div className="h-56">
        <ResponsiveContainer>
          <AreaChart data={(stats?.timeline ?? []).map((d) => ({ ...d, t: d.ts ? new Date(d.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : d.t }))} margin={{ left: -20, right: 6, top: 6 }}>
            <defs>
              {(Object.keys(SEV_COLOR) as (keyof typeof SEV_COLOR)[]).map((k) => (
                <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEV_COLOR[k]} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={SEV_COLOR[k]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            {(["low", "medium", "high", "critical"] as const).map((k) => (
              <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={SEV_COLOR[k]} fill={`url(#g-${k})`} strokeWidth={1.5} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const CAT_COLORS = ["#22d3ee", "#a78bfa", "#f43f5e", "#fb923c", "#fbbf24", "#34d399", "#38bdf8", "#f472b6", "#94a3b8"];

export function CategoryChart({ stats, labels }: { stats?: Stats; labels?: Record<string, string> }) {
  const data = Object.entries(stats?.by_category ?? {})
    .map(([k, v]) => ({ name: labels?.[k] ?? k, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
  return (
    <Panel title="Attack Mix" icon={<PieChart size={14} />}>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={118} tick={{ fill: "#94a3b8", fontSize: 10.5 }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="v" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

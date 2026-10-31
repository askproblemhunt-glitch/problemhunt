"use client";

import { Activity } from "lucide-react";
import { Line, LineChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, YAxis } from "recharts";
import type { Immunity } from "@/lib/types";
import { Panel } from "./ui";

const LABELS: Record<string, [string, number]> = {
  interception: ["Interception", 30],
  coverage: ["Rule coverage", 20],
  mesh: ["Device mesh", 15],
  ai_brain: ["AI brain", 15],
  posture: ["Posture", 20],
};

function scoreColor(s: number) {
  return s >= 85 ? "#34d399" : s >= 70 ? "#22d3ee" : s >= 55 ? "#fbbf24" : "#f43f5e";
}

export default function ImmunityGauge({ immunity, lockdown }: { immunity?: Immunity; lockdown: boolean }) {
  const score = immunity?.score ?? 0;
  const color = scoreColor(score);
  return (
    <Panel title="Digital Immunity Score" icon={<Activity size={14} />} className="h-full">
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <ResponsiveContainer>
          <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ v: score }]} startAngle={225} endAngle={-45}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="v" cornerRadius={20} fill={color} background={{ fill: "rgba(255,255,255,0.06)" }} isAnimationActive />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-bold tabular-nums" style={{ color, textShadow: `0 0 24px ${color}66` }}>
            {score}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-400">Trust meter · {immunity?.grade ?? "–"}</span>
          {lockdown && <span className="mt-2 animate-alarm text-[10px] font-bold uppercase tracking-widest text-rose-400">Lockdown boost</span>}
        </div>
      </div>

      <div className="mt-2 h-10">
        <ResponsiveContainer>
          <LineChart data={immunity?.history ?? []}>
            <YAxis hide domain={[0, 100]} />
            <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 space-y-1.5">
        {Object.entries(LABELS).map(([k, [label, max]]) => {
          const v = immunity?.components[k] ?? 0;
          return (
            <li key={k} className="flex items-center gap-2 text-[11px]">
              <span className="w-24 shrink-0 text-slate-400">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <span className="block h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700" style={{ width: `${(v / max) * 100}%` }} />
              </span>
              <span className="w-10 text-right font-mono tabular-nums text-slate-300">{v}/{max}</span>
            </li>
          );
        })}
        {!!immunity?.penalty && (
          <li className="flex justify-between text-[11px] text-rose-300">
            <span>Unresolved exposure</span>
            <span className="font-mono">−{immunity.penalty}</span>
          </li>
        )}
      </ul>
    </Panel>
  );
}

import type { ReactNode } from "react";
import type { Severity } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";

export function Panel({
  title, icon, right, children, className = "", bodyClass = "",
}: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          <span className="text-neon-cyan">{icon}</span>
          {title}
        </h2>
        {right}
      </header>
      <div className={`flex-1 p-4 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function SevBadge({ severity }: { severity: Severity }) {
  const c = SEV_COLOR[severity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c, background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {severity}
    </span>
  );
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "cyan" | "mint" | "rose" | "amber" | "violet" }) {
  const tones: Record<string, string> = {
    slate: "text-slate-300 bg-white/5 ring-white/10",
    cyan: "text-cyan-300 bg-cyan-400/10 ring-cyan-400/30",
    mint: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/30",
    rose: "text-rose-300 bg-rose-500/10 ring-rose-500/30",
    amber: "text-amber-300 bg-amber-400/10 ring-amber-400/30",
    violet: "text-violet-300 bg-violet-400/10 ring-violet-400/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function timeAgo(iso: string | number): string {
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtNum(n: number | undefined): string {
  return (n ?? 0).toLocaleString();
}

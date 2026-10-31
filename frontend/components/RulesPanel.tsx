import { Bot, Database, Sparkles } from "lucide-react";
import type { Rule } from "@/lib/types";
import { Panel, SevBadge, Tag, timeAgo } from "./ui";

const ORIGIN: Record<Rule["origin"], { label: string; tone: "violet" | "cyan" | "amber" | "slate" }> = {
  "agent-llm": { label: "LLM agent", tone: "violet" },
  "agent-miner": { label: "pattern miner", tone: "cyan" },
  "intel-feed": { label: "intel feed", tone: "amber" },
  seed: { label: "seed", tone: "slate" },
};

export default function RulesPanel({ rules, labels, freshId }: { rules: Rule[]; labels?: Record<string, string>; freshId?: string }) {
  return (
    <Panel title="Self-Learned Defense Rules" icon={<Bot size={14} />}
      right={<span className="flex items-center gap-1 font-mono text-[10px] text-violet-300"><Sparkles size={11} />{rules.length} learned without human input</span>}
      bodyClass="p-0">
      {rules.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">The agent is studying live traffic. New rules appear here automatically.</p>
      ) : (
        <div className="feed-scroll max-h-[300px] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-[11.5px]">
            <thead className="sticky top-0 bg-void-900/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur">
              <tr>
                <th className="px-4 py-2 font-medium">Signature</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Targets</th>
                <th className="px-2 py-2 font-medium">Severity</th>
                <th className="px-2 py-2 font-medium">Learned by</th>
                <th className="px-2 py-2 text-right font-medium">Hits</th>
                <th className="px-4 py-2 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.slice(0, 120).map((r) => (
                <tr key={r.id} className={r.id === freshId ? "animate-slidein bg-violet-400/5" : ""} title={r.note}>
                  <td className="max-w-[280px] truncate px-4 py-2 font-mono text-slate-100">{r.pattern}</td>
                  <td className="px-2 py-2 text-slate-400"><span className="inline-flex items-center gap-1">{r.kind === "domain" && <Database size={10} />}{r.kind}</span></td>
                  <td className="px-2 py-2 text-slate-300">{labels?.[r.category] ?? r.category}</td>
                  <td className="px-2 py-2"><SevBadge severity={r.severity} /></td>
                  <td className="px-2 py-2"><Tag tone={ORIGIN[r.origin].tone}>{ORIGIN[r.origin].label}</Tag></td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-300">{r.hits}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-500">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

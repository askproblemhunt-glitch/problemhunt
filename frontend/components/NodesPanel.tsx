import { BrainCircuit, Cpu, Globe, Laptop, Network, Smartphone } from "lucide-react";
import type { EngineInfo, NodeInfo } from "@/lib/types";
import { Panel, Tag, fmtNum } from "./ui";

const ICON = { laptop: Laptop, mobile: Smartphone, browser: Globe };

export function NodesPanel({ nodes, meId }: { nodes: NodeInfo[]; meId?: string }) {
  const live = nodes.filter((n) => n.live).length;
  return (
    <Panel title="Defense Mesh Nodes" icon={<Network size={14} />}
      right={<span className="font-mono text-[10px] text-slate-400">{live} live{nodes.length - live ? ` · ${nodes.length - live} virtual` : ""}</span>}>
      <ul className="feed-scroll max-h-[230px] space-y-1.5 overflow-y-auto pr-1">
        {nodes.map((n) => {
          const Icon = ICON[n.kind] ?? Globe;
          const me = n.id === meId;
          return (
            <li key={n.id} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${me ? "bg-cyan-400/10 ring-1 ring-cyan-400/30" : "bg-white/[0.02]"}`}>
              <span className="relative">
                <Icon size={16} className={n.live ? "text-emerald-300" : "text-slate-400"} />
                <span className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ${n.live ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-slate-100">{n.name}{me && " · you"}</div>
                <div className="truncate text-[10px] text-slate-500">{n.platform}</div>
              </div>
              {n.live ? <Tag tone="mint">live</Tag> : <Tag>virtual</Tag>}
              <span className="w-10 text-right font-mono text-[11px] tabular-nums text-slate-300" title="Threats intercepted">{fmtNum(n.intercepted)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Open this dashboard on any phone or laptop (or install it as an app) and it joins the mesh instantly.
      </p>
    </Panel>
  );
}

export function EnginePanel({ engine }: { engine?: EngineInfo }) {
  const rows: [string, string][] = [
    ["Brain", engine?.llm ? engine.provider : "Offline statistical miner"],
    ["LangChain", engine?.langchain ? `v${engine.langchain}` : "not installed"],
    ["Samples ingested", fmtNum(engine?.agent.ingested)],
    ["Rules self-learned", fmtNum(engine?.agent.rules_learned)],
    ["LLM calls", fmtNum(engine?.agent.llm_calls)],
    ["Simulation drills", engine?.simulation ? "on (auto-pilot)" : "off"],
    ["Cloud mirror", engine?.supabase ? "Supabase" : "local SQLite"],
  ];
  return (
    <Panel title="AI Agent Core" icon={<BrainCircuit size={14} />}
      right={engine?.llm ? (engine.llm_healthy ? <Tag tone="violet">LLM online</Tag> : <Tag tone="amber">LLM unreachable · fallback</Tag>) : <Tag tone="cyan">offline mode</Tag>}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate text-right font-mono text-slate-200" title={v}>{v}</dd>
          </div>
        ))}
      </dl>
      {!engine?.llm && (
        <p className="mt-3 flex gap-2 rounded-md bg-white/[0.03] p-2 text-[10.5px] leading-relaxed text-slate-400">
          <Cpu size={14} className="mt-0.5 shrink-0 text-cyan-300" />
          Add a free GROQ_API_KEY (or run Ollama) to give the agent an LLM brain. Everything still works offline.
        </p>
      )}
    </Panel>
  );
}

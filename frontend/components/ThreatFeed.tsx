"use client";

import { Globe, Mail, MessageCircle, MessageSquare, Mic, QrCode, Send, ShieldAlert, ShieldX, Siren } from "lucide-react";
import type { ThreatEvent } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";
import { Panel, SevBadge, Tag, timeAgo } from "./ui";

const VECTOR_ICON: Record<string, typeof Globe> = {
  SMS: MessageSquare, WhatsApp: MessageCircle, Email: Mail, Web: Globe, QR: QrCode, Voice: Mic, Telegram: Send,
};

export default function ThreatFeed({ threats }: { threats: ThreatEvent[] }) {
  return (
    <Panel
      title="Live Interceptions · real data"
      icon={<Siren size={14} />}
      right={<span className="font-mono text-[10px] text-slate-500">{threats.length} recent</span>}
      className="h-full"
      bodyClass="p-0"
    >
      <ol className="feed-scroll max-h-[372px] divide-y divide-white/5 overflow-y-auto">
        {threats.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Waiting for the live threat-intel feed (OpenPhish · URLhaus)… Scan something below to test it.</li>}
        {threats.map((t) => {
          const Icon = VECTOR_ICON[t.vector] ?? Globe;
          const neutral = t.action === "neutralized";
          return (
            <li key={t.id} className="animate-slidein px-4 py-2.5 transition hover:bg-white/[0.02]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${SEV_COLOR[t.severity]}14`, color: SEV_COLOR[t.severity] }}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-slate-100">{t.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                    <SevBadge severity={t.severity} />
                    {t.source === "intel" ? <Tag tone="mint"><ShieldX size={9} />blocklisted</Tag> : neutral ? <Tag tone="mint"><ShieldX size={9} />neutralized</Tag> : <Tag tone="amber"><ShieldAlert size={9} />flagged</Tag>}
                    {t.source === "simulation" ? <Tag>sim drill</Tag> : t.source === "intel" ? <Tag tone="amber">live intel</Tag> : <Tag tone="cyan">your scan</Tag>}
                    <span className="truncate">{t.vector} → {t.node}</span>
                  </div>
                  {t.sample && <p className="mt-1 line-clamp-1 font-mono text-[10.5px] text-slate-500">{t.sample}</p>}
                  {t.verify_url && (
                    <a href={t.verify_url} target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-block text-[10.5px] text-cyan-300 underline-offset-2 hover:underline"
                      title="Opens VirusTotal's public report for this domain (safe — it does not open the phishing site)">
                      Verify independently on VirusTotal ↗
                    </a>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold tabular-nums" style={{ color: SEV_COLOR[t.severity] }}>{t.risk_score}</div>
                  <div className="font-mono text-[10px] text-slate-500">{timeAgo(t.ts)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

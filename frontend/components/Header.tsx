"use client";

import { Bell, BellRing, Download, Lock, Unlock } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conn } from "@/lib/useDefenseGrid";
import { AlertState, currentAlertState, enableAlerts } from "@/lib/pwa";

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const CONN_UI: Record<Conn, [string, string]> = {
  live: ["LIVE", "bg-emerald-400"],
  connecting: ["LINKING", "bg-amber-400"],
  reconnecting: ["RE-LINKING", "bg-amber-400"],
  polling: ["POLLING", "bg-sky-400"],
};

export default function Header({ conn, lockdown, onLockdown }: { conn: Conn; lockdown: boolean; onLockdown: (v: boolean) => void }) {
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const [alerts, setAlerts] = useState<AlertState>("default");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => setInstall(null));
    currentAlertState().then(setAlerts);
    const t = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour12: false })), 1000);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); clearInterval(t); };
  }, []);

  const [label, dot] = CONN_UI[conn];
  const alertsOn = alerts === "push" || alerts === "local";

  return (
    <header className="border-b border-white/5 bg-void-950/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-white">Live Threat Map</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Autonomous defense grid</div>
        </div>

        <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-300 sm:flex">
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${dot}`} />{label}
          <span className="text-slate-600">|</span>{clock}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {install && (
            <button className="btn-ghost" onClick={async () => { await install.prompt(); setInstall(null); }}>
              <Download size={14} />Install app
            </button>
          )}
          {alerts !== "unsupported" && (
            <button
              className={`btn-ghost ${alertsOn ? "!text-emerald-300 !ring-emerald-400/30" : ""}`}
              onClick={async () => setAlerts(await enableAlerts())}
              title={alerts === "denied" ? "Notifications are blocked in your browser settings" : "Get alerts even when this tab is closed"}
            >
              {alertsOn ? <BellRing size={14} /> : <Bell size={14} />}
              {alerts === "push" ? "Push alerts on" : alerts === "local" ? "Alerts on" : alerts === "denied" ? "Alerts blocked" : "Enable alerts"}
            </button>
          )}
          <button
            onClick={() => onLockdown(!lockdown)}
            className={`group relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider transition ${
              lockdown
                ? "bg-rose-500 text-white shadow-[0_0_30px_-4px_#f43f5e]"
                : "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/20"
            }`}
          >
            {lockdown ? <Lock size={15} /> : <Unlock size={15} />}
            {lockdown ? "Lockdown active" : "Global lockdown (admin)"}
          </button>
        </div>
      </div>
    </header>
  );
}

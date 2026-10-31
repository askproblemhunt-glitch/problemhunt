"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { api, wsUrl } from "./api";
import { detectDevice, localNotify } from "./pwa";
import type { LiveStatus, NodeInfo, RadarBlip, Rule, Snapshot, ThreatEvent } from "./types";

export type Conn = "connecting" | "live" | "reconnecting" | "polling";

interface GridState {
  conn: Conn;
  snapshot: Snapshot | null;
  threats: ThreatEvent[];
  radar: RadarBlip[];
  rules: Rule[];
  me: NodeInfo | null;
  lastThreat: ThreatEvent | null;
  newRule: Rule | null;
}

type Msg =
  | { type: "conn"; conn: Conn }
  | { type: "hello"; data: Snapshot }
  | { type: "stats"; data: LiveStatus }
  | { type: "threat"; data: ThreatEvent }
  | { type: "radar"; data: RadarBlip }
  | { type: "rule"; data: Rule }
  | { type: "lockdown"; data: { engaged: boolean; since: number | null } }
  | { type: "nodes"; data: NodeInfo[] }
  | { type: "registered"; data: NodeInfo }
  | { type: "rules_changed"; data: { deleted: string } };

const initial: GridState = {
  conn: "connecting", snapshot: null, threats: [], radar: [], rules: [], me: null, lastThreat: null, newRule: null,
};

function reducer(s: GridState, m: Msg): GridState {
  switch (m.type) {
    case "conn":
      return { ...s, conn: m.conn };
    case "hello":
      return { ...s, snapshot: m.data, threats: m.data.threats, radar: m.data.radar, rules: m.data.rules };
    case "stats":
      return s.snapshot ? { ...s, snapshot: { ...s.snapshot, ...m.data } } : s;
    case "threat":
      return { ...s, threats: [m.data, ...s.threats].slice(0, 80), lastThreat: m.data };
    case "radar":
      return { ...s, radar: [m.data, ...s.radar.filter((b) => b.title !== m.data.title)].slice(0, 40) };
    case "rule":
      return { ...s, rules: [m.data, ...s.rules].slice(0, 200), newRule: m.data };
    case "rules_changed":
      return { ...s, rules: s.rules.filter((r) => r.id !== m.data.deleted) };
    case "lockdown":
      return s.snapshot
        ? { ...s, snapshot: { ...s.snapshot, stats: { ...s.snapshot.stats, lockdown: m.data.engaged, lockdown_since: m.data.since } } }
        : s;
    case "nodes":
      return s.snapshot ? { ...s, snapshot: { ...s.snapshot, nodes: m.data } } : s;
    case "registered":
      return { ...s, me: m.data };
    default:
      return s;
  }
}

/** Real-time link to the defense grid: WebSocket with backoff, REST polling fallback. */
export function useDefenseGrid() {
  const [state, dispatch] = useReducer(reducer, initial);
  const wsRef = useRef<WebSocket | null>(null);
  const retry = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    dispatch({ type: "conn", conn: "polling" });
    const tick = () => api.snapshot().then((d) => dispatch({ type: "hello", data: d })).catch(() => {});
    tick();
    pollTimer.current = setInterval(tick, 5000);
  }, []);

  useEffect(() => {
    let closed = false;
    let ping: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (closed) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        retry.current = 0;
        if (pollTimer.current) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
        dispatch({ type: "conn", conn: "live" });
        ws.send(JSON.stringify({ type: "register", node: detectDevice() }));
        ping = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: "ping" })), 20000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as Msg;
          dispatch(msg);
          if (msg.type === "threat" && msg.data.action === "neutralized" && msg.data.severity === "critical" && document.hidden) {
            localNotify("🛡️ Threat neutralized", `${msg.data.title} — blocked on ${msg.data.node}`, msg.data.id);
          }
        } catch {}
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (closed) return;
        retry.current += 1;
        dispatch({ type: "conn", conn: "reconnecting" });
        if (retry.current >= 3) startPolling();
        reconnectTimer = setTimeout(connect, Math.min(15000, 800 * 2 ** retry.current));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(reconnectTimer);
      if (pollTimer.current) clearInterval(pollTimer.current);
      wsRef.current?.close();
    };
  }, [startPolling]);

  const setLockdown = useCallback(async (engaged: boolean) => {
    const r = await api.lockdown(engaged);
    dispatch({ type: "lockdown", data: { engaged: r.engaged, since: Date.now() / 1000 } });
  }, []);

  return { ...state, setLockdown };
}

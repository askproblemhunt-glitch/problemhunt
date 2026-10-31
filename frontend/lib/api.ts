import type { ScanResult, Snapshot } from "./types";

/** Same-origin by default (dashboard served by FastAPI). Override for split hosting. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function wsUrl(): string {
  if (API_BASE) return API_BASE.replace(/^http/, "ws") + "/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

const TOKEN_KEY = "ph_admin_token";

function adminHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) h["X-Admin-Token"] = t;
    const s = localStorage.getItem("ph_session");
    if (s) h["Authorization"] = `Bearer ${s}`;
  } catch {}
  return h;
}

export async function request<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...adminHeaders(), ...(init.headers || {}) },
  });
  if (res.status === 401 && retryAuth && path.startsWith("/api/lockdown")) {
    const token = window.prompt("This ProblemHunt server is protected. Enter the admin token:");
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {}
      return request<T>(path, init, false);
    }
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const d = (await res.json()).detail;
      detail = Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg || "Invalid input").join(", ").replace("Value error, ", "") : d ?? detail;
    } catch {}
    const err = new Error(typeof detail === "string" ? detail : "Request failed") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  snapshot: () => request<Snapshot>("/api/snapshot"),
  scan: (content: string, kind: string, node_id?: string) =>
    request<ScanResult>("/api/scan", { method: "POST", body: JSON.stringify({ content, kind, node_id }) }),
  lockdown: (engaged: boolean) =>
    request<{ engaged: boolean }>("/api/lockdown", { method: "POST", body: JSON.stringify({ engaged }) }),
  pushKey: () => request<{ enabled: boolean; publicKey: string | null }>("/api/push/public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON) =>
    request("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  pushTest: () => request<{ delivered: number }>("/api/push/test", { method: "POST" }),
};

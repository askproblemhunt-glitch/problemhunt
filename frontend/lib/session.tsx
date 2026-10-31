"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { request } from "./api";

export interface User {
  id: string; email: string; phone: string; status: string; name: string; role: "user" | "admin"; lang: string;
  premium: boolean; premium_until: number; plan_id: string; family_code: string; scans_total: number;
  city?: string; points?: number; streak?: number; last_play_day?: string; mfa?: boolean;
}
interface Usage { used: number; limit: number | null }

const Ctx = createContext<{
  user: User | null; usage: Usage | null; ready: boolean;
  login: (email: string, password: string, mfa?: string) => Promise<void>;
  signup: (email: string, password: string, name: string, lang: string) => Promise<void>;
  logout: () => void; refresh: () => Promise<void>; setUser: (u: User) => void;
}>(null as never);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (!localStorage.getItem("ph_session")) { setUser(null); return; }
      const r = await request<{ user: User; usage: Usage }>("/api/me");
      setUser(r.user); setUsage(r.usage);
    } catch (e) {
      if ((e as { status?: number }).status === 401) { try { localStorage.removeItem("ph_session"); } catch {} }
      setUser(null);
    } finally { setReady(true); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = (token: string, u: User) => {
    try { localStorage.setItem("ph_session", token); } catch {}
    setUser(u);
  };
  const login = async (email: string, password: string, mfa?: string) => {
    const r = await request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, mfa_code: mfa || undefined }) });
    save(r.token, r.user); refresh();
  };
  const signup = async (email: string, password: string, name: string, lang: string) => {
    const r = await request<{ token: string; user: User }>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name, lang }) });
    save(r.token, r.user); refresh();
  };
  const logout = () => { try { localStorage.removeItem("ph_session"); } catch {} setUser(null); setUsage(null); };

  return <Ctx.Provider value={{ user, usage, ready, login, signup, logout, refresh, setUser }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

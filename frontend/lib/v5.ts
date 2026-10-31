import { request } from "./api";

const j = (b: unknown) => JSON.stringify(b);
const post = <T,>(p: string, b?: unknown) => request<T>(p, { method: "POST", body: b === undefined ? undefined : j(b) });
const patch = <T,>(p: string, b: unknown) => request<T>(p, { method: "PATCH", body: j(b) });

export type Scores = { risk_posture: number; compliance: number; maturity: number; awareness: number; exposure: number };
export type OrgInfo = {
  org: null | { id: string; name: string; domain: string; plan: string; seats: number; require_mfa: number; members: number; invite_code?: string; tech_stack: string[] };
  role?: string; is_admin?: boolean; admin_ready?: boolean; mfa_enabled: boolean; pw_checked?: boolean;
  progress: Record<string, { score: number; total: number }>; courses_total?: number;
};
export type Member = { user_id: string; name: string; email: string; phone: string; role: string; dept: string; mfa: boolean; courses_done: number;
  quiz_pct: number | null; sims: number; clicked: number; reported: number; pw_checked: boolean; pw_leaked: boolean; pw_strength: number };
export type Control = { id: string; title: string; weight: number; map: Record<string, string>; status: string; owner: string; note: string; auto_note: string };
export type Dashboard = { scores: Scores; stats: Record<string, number | boolean>; coverage: { pct: number; frameworks: { id: string; name: string; pct: number; controls: number }[] };
  kev: { cve: string; vendor: string; product: string; name: string; due_date: string; epss: number | null }[]; risks: { level: string; text: string; fix: string }[];
  trend: (Scores & { day: string })[]; campaigns: { id: string; name: string; created_at: string; targets: number; clicked: number; reported: number }[] };
export type Course = { id: string; title: string; title_hi: string; minutes: number; level: string; lessons: number; questions: number; done: boolean; score: number | null; total: number | null };
export type CourseFull = { id: string; title: string; title_hi: string; minutes: number; level: string; lessons: { title: string; body: string }[]; quiz: { q: string; options: string[] }[] };
export type Cve = { cve: string; vendor: string; product: string; name: string; description: string; date_added: string; due_date: string; required_action: string;
  ransomware: string; cvss: number | null; severity: string; epss: number | null; percentile: number | null; kev: number; published: string };
export type Advisory = { id: string; source: string; region: string; title: string; link: string; published: string; summary: string; cves: string };
export type Technique = { id: string; name: string; tactic: string; description: string; url: string };
export type FraudItem = { id: string; title: string; how: string; flags: string[]; stop: string[]; victim: string[]; week_count: number; trend: string;
  risk: number; impact: number; score: number; channels: string[]; countries: string[]; attack: { id: string; name: string; url: string }[]; advisories: { name: string; url: string }[] };
export type ChatReply = { agent: string; agent_name: string; content: string; sources: { title: string; url: string; kind: string }[]; mode: string; conversation_id: string };

export const W = {
  org: () => request<OrgInfo>("/api/org"),
  createOrg: (b: { name: string; domain?: string; seats?: number }) => post<OrgInfo>("/api/org", b),
  join: (code: string) => post<OrgInfo>("/api/org/join", { code }),
  leave: () => post("/api/org/leave"),
  updateOrg: (b: Record<string, unknown>) => patch<OrgInfo>("/api/org", b),
  rotateInvite: () => post<{ invite_code: string }>("/api/org/invite/rotate"),
  members: () => request<Member[]>("/api/org/members"),
  updateMember: (uid: string, b: Record<string, unknown>) => patch(`/api/org/members/${uid}`, b),
  removeMember: (uid: string) => request(`/api/org/members/${uid}`, { method: "DELETE" }),
  audit: () => request<{ rows: { seq: number; ts: string; actor: string; action: string; target: string; detail: string }[]; chain_ok: boolean }>("/api/org/audit"),
  dashboard: () => request<Dashboard>("/api/org/dashboard"),
  report: () => request<Record<string, any>>("/api/org/report"),
  compliance: () => request<{ frameworks: { id: string; name: string }[]; controls: Control[]; coverage: Dashboard["coverage"]; note: string }>("/api/org/compliance"),
  setControl: (id: string, b: Record<string, unknown>) => patch(`/api/org/compliance/${id}`, b),
  templates: () => request<{ id: string; name: string; difficulty: string; subject: string; from_name: string; body: string; flags: string[] }[]>("/api/org/phishing/templates"),
  campaigns: () => request<{ id: string; name: string; template_name: string; created_at: string; targets: number; clicked: number; reported: number }[]>("/api/org/phishing/campaigns"),
  sendCampaign: (b: { name: string; template_id: string; user_ids?: string[] }) => post<{ id: string; sent: number; skipped_no_email: number; dev_previews?: { user_id: string; click: string; report: string }[] }>("/api/org/phishing/campaigns", b),
  pwCheck: (leaked: boolean, strength: number) => post("/api/org/password-check", { leaked, strength }),
  simTemplate: (id: string) => request<{ name: string; subject: string; from_name: string; flags: string[] }>(`/api/sim/template/${id}`),
  courses: () => request<Course[]>("/api/courses"),
  course: (id: string) => request<CourseFull>(`/api/courses/${id}`),
  submit: (id: string, answers: number[]) => post<{ score: number; total: number; passed: boolean; points?: number; results: { correct: boolean; answer: number; why: string }[] }>(`/api/courses/${id}/submit`, { answers }),
  mfa: () => request<{ enabled: boolean }>("/api/me/mfa"),
  mfaSetup: () => post<{ secret: string; otpauth: string }>("/api/me/mfa/setup"),
  mfaEnable: (code: string) => post("/api/me/mfa/enable", { code }),
  mfaDisable: (code: string) => post("/api/me/mfa/disable", { code }),
};

export const I = {
  summary: () => request<{ kev_total: number; kev_30d: number; ransomware: number; critical_7d: number; advisories_7d: number; techniques: number;
    latest_kev: Cve[]; latest_advisories: Advisory[]; runs: { source: string; last_ok: string; last_try: string; count: number; error: string }[] }>("/api/intel/summary"),
  cves: (q: string, sort: string, ransomware: boolean) => request<Cve[]>(`/api/intel/cves?q=${encodeURIComponent(q)}&sort=${sort}&ransomware=${ransomware}`),
  cve: (id: string) => request<Cve & { advisories: Advisory[]; links: Record<string, string> }>(`/api/intel/cves/${id}`),
  advisories: (q: string, source: string) => request<{ items: Advisory[]; sources: string[] }>(`/api/intel/advisories?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`),
  attack: (q: string, tactic: string) => request<{ items: Technique[]; tactics: string[] }>(`/api/intel/attack?q=${encodeURIComponent(q)}&tactic=${encodeURIComponent(tactic)}`),
  frauds: () => request<{ items: FraudItem[] }>("/api/fraud-center"),
};

export const AI = {
  agents: () => request<{ agents: { id: string; name: string }[]; llm: boolean; model: string }>("/api/ai/agents"),
  chat: (message: string, agent: string, conversation_id: string, lang: string) => post<ChatReply>("/api/ai/chat", { message, agent, conversation_id, lang }),
  conversations: () => request<{ id: string; agent: string; title: string; updated_at: string }[]>("/api/ai/conversations"),
  conversation: (id: string) => request<{ conversation: { id: string; agent: string }; messages: { role: string; content: string; sources: ChatReply["sources"]; agent: string }[] }>(`/api/ai/conversations/${id}`),
  remove: (id: string) => request(`/api/ai/conversations/${id}`, { method: "DELETE" }),
};

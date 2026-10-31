import { API_BASE, request } from "./api";

export type Verdict = "safe" | "suspicious" | "malicious";
export interface ProviderResult { provider: string; label: string; status: string; detail: string; cached?: boolean }
export interface Affiliate { id: string; name: string; category: string; description: string; logo_url: string; badge: string; price_note: string; go_url: string }
export interface CheckResult {
  id: string; kind: string; verdict: Verdict; risk_score: number; severity: "low" | "medium" | "high" | "critical";
  category: string; category_label: string; indicators: string[]; explanation: string; providers: ProviderResult[];
  community: { approved: number; pending: number }; affiliates: Affiliate[];
  usage: { used: number; limit: number | null; premium: boolean }; engine: string; elapsed_ms: number; checked_value: string;
}
export interface Content {
  id: string; kind: "article" | "video" | "tip" | "alert"; title: string; summary: string; body?: string; video_url: string;
  image_url: string; lang: string; category: string; pinned: number; premium_only: number; views: number; created_at: string; locked?: boolean;
}
export interface Ad {
  id?: string; kind: "banner" | "text" | "video" | "adsense"; title?: string; body?: string; image_url?: string; video_url?: string;
  cta?: string; advertiser?: string; click_url?: string; adsense_client?: string; adsense_slot?: string;
}
export interface Plan { id: string; name: string; price_inr: number; price_usd: number; days: number; features: string[]; highlight: number; family: number; active: number; sort: number }
export interface PublicConfig {
  site_name: string; tagline: string; free_daily_limit: number; support_email: string; adsense_client: string;
  adsense_slots: Record<string, string>; payments: { razorpay: boolean; razorpay_key_id: string; stripe: boolean };
  languages: string[]; providers: string[]; feeds: string[];
  login: { email_code: boolean; sms_code: boolean; email_ready: boolean; sms_ready: boolean };
  manual_payment: boolean; manual_payment_upi: string; emergency_number: string; cyber_helpline: string; require_approval: boolean;
}
export interface Report { id: string; kind: string; value: string; description: string; amount_lost: number; city: string; created_at: string; times_reported: number }

export interface FraudGuideItem { id: string; category: string; title: string; how: string; flags: string[]; stop: string[]; victim: string[]; week_count: number; trend: string }
export interface Program { id: string; title: string; organizer: string; description: string; date_at: string; location: string; online_url: string; image_url: string; category: string; audience: string; registrations: number; past?: boolean }
export interface Contact { id: string; name: string; phone: string; email: string }
export interface Order { id: string; order_code: string; plan_id: string; amount: number; currency: string; method: string; payer_ref: string; status: string; created_at: string }

export const asset = (u?: string) => (!u ? "" : u.startsWith("/uploads/") ? API_BASE + u : u);
export const apiUrl = (p: string) => API_BASE + p;

export const P = {
  config: () => request<PublicConfig>("/api/public/config"),
  stats: () => request<{ checks_today: number; dangers_today: number; reports_total: number; people_protected: number; intel_iocs: number;
    blocked_total: number; latest_alerts: import("./types").ThreatEvent[]; checks_series: { day: string; value: number }[] }>("/api/public/stats"),
  check: (content: string, kind = "auto") => request<CheckResult>("/api/check", { method: "POST", body: JSON.stringify({ content, kind }) }),
  content: (lang: string, kind = "", q = "") => request<Content[]>(`/api/content?lang=${lang}&kind=${kind}&q=${encodeURIComponent(q)}`),
  contentOne: (id: string) => request<Content>(`/api/content/${id}`),
  ad: (placement: string, lang: string) => request<{ ad: Ad | null }>(`/api/ads?placement=${placement}&lang=${lang}`),
  affiliates: (lang: string) => request<Affiliate[]>(`/api/affiliates?lang=${lang}`),
  plans: () => request<Plan[]>("/api/plans"),
  report: (body: Record<string, unknown>) => request<{ ok: boolean; status: string }>("/api/reports", { method: "POST", body: JSON.stringify(body) }),
  recentReports: () => request<Report[]>("/api/reports/recent?limit=20"),
  rzpOrder: (plan_id: string) => request<{ order_id: string; key_id: string; amount: number; currency: string; name: string; description: string; email: string }>(
    "/api/pay/razorpay/order", { method: "POST", body: JSON.stringify({ plan_id }) }),
  rzpVerify: (b: Record<string, string>) => request<{ ok: boolean }>("/api/pay/razorpay/verify", { method: "POST", body: JSON.stringify(b) }),
  stripeCheckout: (plan_id: string) => request<{ url: string }>("/api/pay/stripe/checkout", { method: "POST", body: JSON.stringify({ plan_id }) }),
  stripeConfirm: (session_id: string) => request<{ ok: boolean }>(`/api/pay/stripe/confirm?session_id=${encodeURIComponent(session_id)}`),
  family: () => request<{ code: string; members: { id: string; name: string; email: string; me: boolean }[] }>("/api/family"),
  familyCreate: () => request<{ code: string }>("/api/family/create", { method: "POST" }),
  familyJoin: (code: string) => request<{ ok: boolean }>("/api/family/join", { method: "POST", body: JSON.stringify({ code }) }),
  familyLeave: () => request<{ ok: boolean }>("/api/family/leave", { method: "POST" }),
  pushLink: (endpoint: string) => request("/api/push/link", { method: "POST", body: JSON.stringify({ endpoint }) }),
  updateMe: (b: Record<string, unknown>) => request("/api/me", { method: "PATCH", body: JSON.stringify(b) }),
  otpRequest: (identifier: string, lang: string) => request<{ sent: boolean; channel: string; target: string; dev_code?: string; note?: string }>(
    "/api/auth/otp/request", { method: "POST", body: JSON.stringify({ identifier, lang }) }),
  otpVerify: (identifier: string, code: string, name: string, lang: string, mfa?: string) => request<{ token: string; user: import("./session").User }>(
    "/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ identifier, code, name, lang, mfa_code: mfa || undefined }) }),
  linkPhone: (phone: string, code: string) => request("/api/me/phone", { method: "POST", body: JSON.stringify({ phone, code }) }),
  redeem: (code: string) => request<{ ok: boolean; days: number }>("/api/redeem", { method: "POST", body: JSON.stringify({ code }) }),
  order: (plan_id: string, method = "upi", payer_ref = "") => request<{ order: Order; upi_id: string; instructions: string; upi_link: string }>(
    "/api/orders", { method: "POST", body: JSON.stringify({ plan_id, method, payer_ref }) }),
  myOrders: () => request<Order[]>("/api/orders/mine"),
  orderRef: (id: string, payer_ref: string) => request(`/api/orders/${id}/ref`, { method: "POST", body: JSON.stringify({ payer_ref }) }),
  programs: (lang: string) => request<Program[]>(`/api/programs?lang=${lang}`),
  registerProgram: (id: string, b: Record<string, string>) => request(`/api/programs/${id}/register`, { method: "POST", body: JSON.stringify(b) }),
  contacts: () => request<Contact[]>("/api/contacts"),
  addContact: (b: Record<string, string>) => request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(b) }),
  delContact: (id: string) => request(`/api/contacts/${id}`, { method: "DELETE" }),
  sos: (b: Record<string, unknown>) => request<{ ok: boolean; id: string; notified: number; contacts: number; channels: string[]; share_text: string;
    maps: string; emergency_number: string; cyber_helpline: string; contact_phones: string[] }>("/api/sos", { method: "POST", body: JSON.stringify(b) }),
  sosResolve: (id: string) => request(`/api/sos/${id}/resolve`, { method: "POST" }),
  sosFamily: () => request<{ id: string; kind: string; message: string; maps: string; created_at: string; name?: string; phone?: string; status: string }[]>("/api/sos/family"),
  guide: () => request<{ items: FraudGuideItem[] }>("/api/fraud-guide"),
  playToday: (lang: string) => request<PlayToday>(`/api/play/today?lang=${lang}`),
  playAnswer: (id: string, choice: "scam" | "safe", lang: string) =>
    request<PlayResult>("/api/play/answer", { method: "POST", body: JSON.stringify({ id, choice, lang }) }),
  leaderboard: (city = "") => request<Leaderboard>(`/api/play/leaderboard?city=${encodeURIComponent(city)}`),
  setCity: (city: string) => request<{ city: string }>("/api/me/city", { method: "POST", body: JSON.stringify({ city }) }),
  checkup: () => request<Checkup>("/api/checkup"),
  setCheckup: (item: string, done: boolean) => request<Checkup & { new_badges: string[] }>("/api/checkup", { method: "POST", body: JSON.stringify({ item, done }) }),
  scamMap: (days = 30) => request<ScamMap>(`/api/scam-map?days=${days}`),
};

export type PlayStats = { points: number; streak: number; best_streak: number; played_today: boolean; badges: string[]; city: string };
export type PlayItem = { id: string; channel: string; text: string };
export type PlayAnswered = { choice: string; correct: boolean; answer: string; why: string };
export type PlayToday = { day: string; items: PlayItem[]; answered: Record<string, PlayAnswered>; stats: PlayStats | null; players_today: number };
export type PlayResult = { correct: boolean; answer: string; why: string; points: number; new_badges: string[]; stats?: PlayStats; already?: boolean };
export type Leaderboard = { week_start: string; board: { rank: number; name: string; city: string; points: number; me: boolean }[]; me: { rank: number; points: number } | null; cities: string[] };
export type Checkup = { score: number; items: { id: string; weight: number; auto: boolean; done: boolean }[] };
export type ScamMap = { days: number; total: number; kinds: { kind: string; n: number }[];
  cities: { city: string; reports: number; lost: number; lat: number | null; lon: number | null; top_kind: string }[] };

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(s);
  });
}

export function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  const v = url.match(/vimeo\.com\/(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  return null;
}

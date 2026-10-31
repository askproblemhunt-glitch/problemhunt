export type Severity = "low" | "medium" | "high" | "critical";
export type Action = "allowed" | "flagged" | "neutralized";

export interface ThreatEvent {
  id: string;
  ts: string;
  title: string;
  category: string;
  category_label: string;
  severity: Severity;
  vector: string;
  region: string;
  node: string;
  action: Action;
  risk_score: number;
  indicators: string[];
  source: "simulation" | "scan" | "intel";
  sample: string;
  verify_url?: string;
}

export interface RadarBlip {
  id: string;
  ts: string;
  title: string;
  category: string;
  severity: Severity;
  region: string;
  bearing: number;
  distance: number;
  trend: "emerging" | "spreading" | "contained";
  reports: number;
  source: "simulation" | "intel";
}

export interface Rule {
  id: string;
  kind: "keyword" | "domain" | "regex";
  pattern: string;
  category: string;
  severity: Severity;
  weight: number;
  origin: "seed" | "agent-llm" | "agent-miner" | "intel-feed";
  hits: number;
  created_at: string;
  note: string;
}

export interface NodeInfo {
  id: string;
  name: string;
  kind: "browser" | "mobile" | "laptop";
  platform: string;
  live: boolean;
  status: string;
  intercepted: number;
  uptime_s: number;
  last_seen_s: number;
}

export interface Immunity {
  score: number;
  grade: string;
  components: Record<string, number>;
  penalty: number;
  neutralize_rate: number;
  window_threats: number;
  history: { t: string; score: number }[];
}

export interface Stats {
  uptime_s: number;
  scanned: number;
  neutralized: number;
  flagged: number;
  allowed: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_vector: Record<string, number>;
  timeline: ({ t: string; ts?: number } & Record<Severity, number>)[];
  lockdown: boolean;
  lockdown_since: number | null;
}

export interface EngineInfo {
  provider: string;
  llm: boolean;
  llm_healthy?: boolean;
  langchain: string | null;
  total_rules: number;
  learned_rules: number;
  intel_iocs: number;
  intel_sources: string[];
  intel_last_refresh: number | null;
  agent: { ingested?: number; llm_calls?: number; rules_learned?: number; llm_errors?: number };
  simulation: boolean;
  intel_streamed?: number;
  intel_backlog?: number;
  supabase: boolean;
}

export interface LiveStatus {
  stats: Stats;
  immunity: Immunity;
  nodes: NodeInfo[];
  engine: EngineInfo;
  push: { enabled: boolean; subscribers: number; sent: number };
}

export interface Snapshot extends LiveStatus {
  version: string;
  threats: ThreatEvent[];
  radar: RadarBlip[];
  rules: Rule[];
  categories: Record<string, string>;
}

export interface ScanResult {
  id: string;
  ts: string;
  verdict: "safe" | "suspicious" | "malicious";
  category: string;
  category_label: string;
  severity: Severity;
  risk_score: number;
  confidence: number;
  indicators: string[];
  matched_rules: string[];
  action: Action;
  explanation: string;
  engine: string;
  elapsed_ms: number;
}

export const SEV_COLOR: Record<Severity, string> = {
  low: "#38bdf8",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f43f5e",
};

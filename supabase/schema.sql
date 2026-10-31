-- Run in Supabase -> SQL Editor. Mirrors learned rules and real interceptions.
create table if not exists public.rules (
  id text primary key,
  kind text not null,
  pattern text not null,
  category text not null,
  severity text not null,
  weight int not null,
  origin text not null,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  note text default ''
);
create table if not exists public.threats (
  id text primary key,
  ts timestamptz not null,
  title text, category text, category_label text, severity text, vector text,
  region text, node text, action text, risk_score int,
  indicators jsonb, source text, sample text
);
create index if not exists threats_ts_idx on public.threats (ts desc);
-- The backend uses the service-role key server-side only. Lock tables down for anon users:
alter table public.rules enable row level security;
alter table public.threats enable row level security;

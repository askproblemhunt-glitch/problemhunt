"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, type ScamMap as Map } from "@/lib/product";
import { useSession } from "@/lib/session";

// Simple equirectangular projection over India's bounding box.
const BOX = { lat0: 6, lat1: 37, lon0: 68, lon1: 98 };
const W = 320, H = 340;
const px = (lon: number) => ((lon - BOX.lon0) / (BOX.lon1 - BOX.lon0)) * W;
const py = (lat: number) => H - ((lat - BOX.lat0) / (BOX.lat1 - BOX.lat0)) * H;

export default function ScamMap() {
  const { t } = useI18n();
  const { user } = useSession();
  const [m, setM] = useState<Map | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => { P.scamMap(30).then(setM).catch(() => {}); }, []);
  if (!m) return null;
  const max = Math.max(1, ...m.cities.map((c) => c.reports));
  const mine = user?.city?.toLowerCase();
  const near = m.cities.find((c) => c.city.toLowerCase() === mine);

  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><MapPin size={18} className="text-rose-400" />{t("map_title")}</h2>
          <p className="text-[13px] text-slate-400">{t("map_sub")} · {m.total} {t("reports_30d")}</p></div>
        <Link href="/report/" className="text-sm text-cyan-300">{t("report_title")} →</Link>
      </div>
      {near && <p className="mb-3 rounded-lg bg-rose-500/10 p-2 text-sm text-rose-100">📍 {near.city}: {near.reports} {t("reports_30d")} — {t("top_trick")}: {t(`kind_${near.top_kind}`)}</p>}
      {m.cities.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">{t("map_empty")}</p> : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label={t("map_title")}>
            {Array.from({ length: 7 }, (_, i) => <line key={"h" + i} x1="0" x2={W} y1={(i * H) / 6} y2={(i * H) / 6} stroke="rgba(255,255,255,.04)" />)}
            {Array.from({ length: 7 }, (_, i) => <line key={"v" + i} y1="0" y2={H} x1={(i * W) / 6} x2={(i * W) / 6} stroke="rgba(255,255,255,.04)" />)}
            {m.cities.filter((c) => c.lat !== null).map((c) => {
              const r = 5 + 18 * Math.sqrt(c.reports / max);
              return (
                <g key={c.city} onMouseEnter={() => setHover(c.city)} onMouseLeave={() => setHover(null)}>
                  <circle cx={px(c.lon!)} cy={py(c.lat!)} r={r} fill="#f43f5e" fillOpacity={hover === c.city ? 0.75 : 0.4} stroke="#fb7185" />
                  {(r > 10 || hover === c.city) && <text x={px(c.lon!)} y={py(c.lat!) - r - 3} textAnchor="middle" fontSize="10" fill="#e2e8f0">{c.city} {c.reports}</text>}
                </g>
              );
            })}
          </svg>
          <ol className="space-y-1.5 text-sm">
            {m.cities.slice(0, 8).map((c, i) => (
              <li key={c.city} className="flex items-center gap-2">
                <span className="w-5 text-right font-mono text-slate-500">{i + 1}</span>
                <span className="w-28 truncate text-slate-200">{c.city}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-rose-500" style={{ width: `${(c.reports / max) * 100}%` }} /></span>
                <span className="w-8 text-right font-mono text-slate-300">{c.reports}</span>
                <span className="hidden w-24 truncate text-[12px] text-slate-500 sm:block">{t(`kind_${c.top_kind}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

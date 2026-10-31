"use client";

import { ExternalLink, ShieldPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { apiUrl, asset, type Affiliate } from "@/lib/product";

export default function AffiliateCards({ items, title, compact }: { items: Affiliate[]; title?: string; compact?: boolean }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
        <ShieldPlus size={14} className="text-emerald-300" />{title || t("recommended")}
      </div>
      <div className={`grid gap-2 sm:grid-cols-2 ${compact ? "" : "lg:grid-cols-3"}`}>
        {items.map((a) => (
          <a key={a.id} href={apiUrl(a.go_url)} target="_blank" rel="noopener sponsored"
            className="panel group flex items-center gap-3 p-3 transition hover:border-emerald-400/40">
            {a.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset(a.logo_url)} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" loading="lazy" />
            ) : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><ShieldPlus size={18} /></span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{a.name}</span>
                {a.badge && <span className="shrink-0 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">{a.badge}</span>}
              </div>
              <p className="line-clamp-2 text-[12px] text-slate-400">{a.description}</p>
              {a.price_note && <p className="text-[11px] text-slate-500">{a.price_note}</p>}
            </div>
            <ExternalLink size={14} className="shrink-0 text-slate-500 group-hover:text-emerald-300" />
          </a>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-slate-600">{t("sponsored")} · affiliate links</p>
    </div>
  );
}

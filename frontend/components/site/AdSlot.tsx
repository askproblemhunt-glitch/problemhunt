"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, apiUrl, asset, loadScript, youtubeEmbed, type Ad } from "@/lib/product";
import { useSession } from "@/lib/session";

declare global { interface Window { adsbygoogle?: unknown[] } }

/** Admin-managed ad slot: own sponsor banners / text / video ads, or Google AdSense fallback. */
export default function AdSlot({ placement, className = "" }: { placement: string; className?: string }) {
  const { lang, t } = useI18n();
  const { user, ready } = useSession();
  const [ad, setAd] = useState<Ad | null>(null);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ready) return;
    P.ad(placement, lang).then((r) => setAd(r.ad)).catch(() => setAd(null));
  }, [placement, lang, ready, user?.premium]);

  useEffect(() => {
    if (ad?.kind !== "adsense" || !ad.adsense_client) return;
    loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ad.adsense_client}`)
      .then(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} })
      .catch(() => {});
  }, [ad]);

  if (!ad) return null;
  const label = <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-slate-300">{t("sponsored")}</span>;

  if (ad.kind === "adsense") {
    return (
      <div className={`panel relative overflow-hidden p-2 ${className}`}>
        {label}
        <ins ref={insRef} className="adsbygoogle block" style={{ display: "block", minHeight: 90 }}
          data-ad-client={ad.adsense_client} data-ad-slot={ad.adsense_slot || undefined} data-ad-format="auto" data-full-width-responsive="true" />
      </div>
    );
  }
  const href = ad.click_url ? apiUrl(ad.click_url) : undefined;
  const embed = ad.video_url ? youtubeEmbed(ad.video_url) : null;
  return (
    <div className={`panel relative overflow-hidden ${className}`}>
      {label}
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        {ad.kind === "video" && ad.video_url ? (
          embed ? <iframe src={embed} title={ad.title} className="aspect-video w-full rounded-lg sm:w-72" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                : <video src={asset(ad.video_url)} controls muted playsInline className="aspect-video w-full rounded-lg sm:w-72" />
        ) : ad.image_url ? (
          <a href={href} target="_blank" rel="noopener sponsored" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(ad.image_url)} alt={ad.title || "Sponsored"} className="max-h-40 w-full rounded-lg object-cover sm:w-64" loading="lazy" />
          </a>
        ) : null}
        <div className="min-w-0 flex-1">
          {ad.advertiser && <div className="text-[11px] uppercase tracking-wider text-slate-500">{ad.advertiser}</div>}
          {ad.title && <div className="text-[15px] font-semibold text-white">{ad.title}</div>}
          {ad.body && <p className="mt-0.5 text-[13px] text-slate-300">{ad.body}</p>}
          {href && (
            <a href={href} target="_blank" rel="noopener sponsored"
              className="mt-2 inline-flex rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
              {ad.cta || "Learn more"} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

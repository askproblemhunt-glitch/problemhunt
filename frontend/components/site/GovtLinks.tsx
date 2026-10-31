"use client";

import { ExternalLink, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** One-tap official reporting channels (India). */
export default function GovtLinks({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const items = [
    { href: "tel:1930", label: t("gov_1930"), sub: t("gov_1930_sub"), tel: true },
    { href: "https://cybercrime.gov.in", label: "cybercrime.gov.in", sub: t("gov_ncrp_sub") },
    { href: "https://sancharsaathi.gov.in/sfc/", label: t("gov_chakshu"), sub: t("gov_chakshu_sub") },
    { href: "https://sancharsaathi.gov.in/", label: t("gov_kym"), sub: t("gov_kym_sub") },
  ];
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">{t("gov_title")}</h3>
      <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {items.map((i) => (
          <a key={i.href} href={i.href} target={i.tel ? undefined : "_blank"} rel="noopener noreferrer"
            className={`rounded-xl border p-3 transition hover:border-cyan-400/40 ${i.tel ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-center gap-1.5 font-semibold text-white">{i.tel ? <Phone size={14} className="text-rose-300" /> : <ExternalLink size={13} className="text-cyan-300" />}{i.label}</div>
            <div className="mt-0.5 text-[12px] text-slate-400">{i.sub}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

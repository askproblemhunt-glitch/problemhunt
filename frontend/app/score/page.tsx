"use client";

import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ScoreRing from "@/components/site/ScoreRing";
import ShareImageButton from "@/components/site/ShareCard";
import { useI18n } from "@/lib/i18n";
import { P, type Checkup } from "@/lib/product";
import { useSession } from "@/lib/session";

const LINKS: Record<string, string> = {
  sanchar_kym: "https://sancharsaathi.gov.in/", password_check: "/tools/",
  google_2fa: "https://myaccount.google.com/signinoptions/two-step-verification",
  phone_linked: "/account/", contacts: "/sos/", family: "/account/",
};

export default function ScorePage() {
  const { t } = useI18n();
  const { user, ready } = useSession();
  const [ck, setCk] = useState<Checkup | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => { if (user) P.checkup().then(setCk).catch(() => {}); }, [user?.id]);

  if (ready && !user) return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-12 text-center">
      <ShieldCheck size={48} className="mx-auto text-cyan-300" />
      <h1 className="text-2xl font-black text-white">{t("score_title")}</h1>
      <p className="text-slate-400">{t("score_sub")}</p>
      <Link href="/account/?next=/score/" className="inline-block rounded-lg bg-cyan-400 px-6 py-2.5 font-bold text-black">{t("nav_login")}</Link>
    </div>
  );
  if (!ck) return <p className="p-10 text-center text-slate-500">…</p>;

  const toggle = async (id: string, done: boolean) => {
    const r = await P.setCheckup(id, done);
    setCk(r);
    if (r.new_badges?.length) { setToast("🛡️ " + t("new_badge")); setTimeout(() => setToast(""), 2500); }
  };
  const level = ck.score >= 80 ? t("score_high") : ck.score >= 50 ? t("score_mid") : t("score_low");

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="panel flex flex-col items-center gap-4 p-5 sm:flex-row">
        <ScoreRing score={ck.score} />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-black text-white">{t("score_title")}</h1>
          <p className="text-lg font-semibold text-slate-200">{level}</p>
          <p className="mt-1 text-sm text-slate-400">{t("score_sub")}</p>
          <ShareImageButton className="mt-3" label={t("share_image")} spec={{
            badge: `🛡️ ${ck.score}/100`, color: ck.score >= 80 ? "#34d399" : "#fbbf24", title: t("score_card_title"),
            lines: [t("score_card_line")], footer: "Check yours free on ProblemHunt · Helpline 1930",
          }} />
          {toast && <p className="mt-2 text-sm text-amber-200">{toast}</p>}
        </div>
      </header>

      <ul className="space-y-2">
        {ck.items.map((i) => {
          const link = LINKS[i.id];
          return (
            <li key={i.id} className={`panel flex items-start gap-3 p-4 ${i.done ? "border-emerald-400/30" : ""}`}>
              <button disabled={i.auto} onClick={() => toggle(i.id, !i.done)} aria-label={t(`ck_${i.id}`)}
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${i.done ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/20 text-transparent"} ${i.auto ? "cursor-default" : ""}`}>
                <Check size={18} /></button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-white">{t(`ck_${i.id}`)}<span className="text-[11px] font-normal text-slate-500">+{i.weight}</span></div>
                <p className="text-[13px] text-slate-400">{t(`ck_${i.id}_how`)}</p>
                {link && !i.done && (link.startsWith("http")
                  ? <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-cyan-300">{t("open")} <ExternalLink size={12} /></a>
                  : <Link href={link} className="mt-1 inline-block text-[13px] text-cyan-300">{t("open")} →</Link>)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

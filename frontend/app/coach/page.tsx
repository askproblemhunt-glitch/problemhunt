"use client";

import { AlertOctagon, CheckCircle2, MessageCircle, Phone, RotateCcw, ShieldAlert, Smartphone, Users, Wallet } from "lucide-react";
import { useState } from "react";
import GovtLinks from "@/components/site/GovtLinks";
import ShareImageButton from "@/components/site/ShareCard";
import { useI18n } from "@/lib/i18n";

const SITUATIONS = [
  { id: "call", icon: Phone }, { id: "message", icon: MessageCircle }, { id: "payment", icon: Wallet },
  { id: "online", icon: Users }, { id: "app", icon: Smartphone },
];
const QUESTIONS: { id: string; w: number }[] = [
  { id: "q_official", w: 2 }, { id: "q_urgent", w: 2 }, { id: "q_otp", w: 3 }, { id: "q_money", w: 3 },
  { id: "q_secret", w: 3 }, { id: "q_app", w: 3 }, { id: "q_prize", w: 2 }, { id: "q_unknown", w: 1 },
];

export default function CoachPage() {
  const { t } = useI18n();
  const [sit, setSit] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [yes, setYes] = useState<string[]>([]);
  const finished = sit && step >= QUESTIONS.length;
  const score = QUESTIONS.filter((q) => yes.includes(q.id)).reduce((a, q) => a + q.w, 0);
  const level = score >= 5 ? "high" : score >= 2 ? "mid" : "low";
  const reset = () => { setSit(null); setStep(0); setYes([]); };
  const ans = (v: boolean) => { if (v) setYes([...yes, QUESTIONS[step].id]); setStep(step + 1); };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <header className="text-center">
        <h1 className="text-3xl font-black text-white">🧭 {t("coach_title")}</h1>
        <p className="mt-1 text-slate-400">{t("coach_sub")}</p>
      </header>

      {!sit && (
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="font-semibold text-white sm:col-span-2">{t("coach_what")}</p>
          {SITUATIONS.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => setSit(id)} className="panel flex items-center gap-3 p-4 text-left transition hover:border-cyan-400/50">
              <Icon className="text-cyan-300" /><span className="font-semibold text-white">{t(`coach_s_${id}`)}</span>
            </button>
          ))}
        </div>
      )}

      {sit && !finished && (
        <div className="panel p-5">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></div>
          <p className="text-[12px] text-slate-500">{step + 1}/{QUESTIONS.length}</p>
          <h2 className="mt-1 text-xl font-bold text-white">{t(`coach_${QUESTIONS[step].id}`)}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => ans(true)} className="rounded-xl bg-rose-600 py-3 text-lg font-black text-white">{t("yes")}</button>
            <button onClick={() => ans(false)} className="rounded-xl bg-white/10 py-3 text-lg font-black text-white">{t("no")}</button>
          </div>
          {score >= 5 && <p className="mt-3 rounded-lg bg-rose-500/15 p-2 text-sm font-semibold text-rose-200">⚠ {t("coach_stop_now")}</p>}
        </div>
      )}

      {finished && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-5 ring-2 ${level === "high" ? "bg-rose-500/10 ring-rose-500/40" : level === "mid" ? "bg-amber-400/10 ring-amber-400/40" : "bg-emerald-400/10 ring-emerald-400/40"}`}>
            <div className="flex items-center gap-3">
              {level === "high" ? <AlertOctagon size={40} className="text-rose-400" /> : level === "mid" ? <ShieldAlert size={40} className="text-amber-300" /> : <CheckCircle2 size={40} className="text-emerald-300" />}
              <h2 className="text-2xl font-black text-white">{t(`coach_r_${level}`)}</h2>
            </div>
            <ul className="mt-3 space-y-1.5 text-[15px] text-slate-100">
              {(level === "low" ? ["coach_a_verify", "coach_a_never"] : ["coach_a_stop", "coach_a_never", "coach_a_verify", "coach_a_lost"]).map((k) => <li key={k}>• {t(k)}</li>)}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {level !== "low" && <ShareImageButton label={t("share_image")} spec={{
                badge: "⚠ SCAM ALERT", color: "#f43f5e", title: t(`coach_s_${sit}`) + " — " + t(`coach_r_${level}`),
                lines: QUESTIONS.filter((q) => yes.includes(q.id)).map((q) => t(`coach_${q.id}`)).slice(0, 4),
              }} />}
              <button onClick={reset} className="btn-ghost"><RotateCcw size={15} />{t("coach_again")}</button>
            </div>
          </div>
          <GovtLinks compact />
        </div>
      )}
    </div>
  );
}

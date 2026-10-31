"use client";

import { Award, CheckCircle2, Flame, Mail, MessageCircle, Phone, Share2, ShieldAlert, Smartphone, Trophy, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, type Leaderboard, type PlayAnswered, type PlayStats, type PlayToday } from "@/lib/product";
import { useSession } from "@/lib/session";

const CH: Record<string, { icon: typeof Phone; label: string }> = {
  sms: { icon: Smartphone, label: "SMS" }, whatsapp: { icon: MessageCircle, label: "WhatsApp" }, call: { icon: Phone, label: "Call" },
  email: { icon: Mail, label: "Email" }, upi: { icon: Wallet, label: "UPI" },
};
const BADGE_ICON: Record<string, string> = {
  first_play: "🎯", sharp_eye: "🦅", streak_3: "🔥", streak_7: "⚡", streak_30: "👑", points_100: "💯", points_500: "🏆",
  safety_80: "🛡️", reporter: "📣", guardian: "👨‍👩‍👧",
};
const LS = "ph_play_local";

type Local = { day: string; answered: Record<string, PlayAnswered>; streak: number; last: string };
const readLocal = (): Local | null => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };

export default function PlayPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [data, setData] = useState<PlayToday | null>(null);
  const [answered, setAnswered] = useState<Record<string, PlayAnswered>>({});
  const [stats, setStats] = useState<PlayStats | null>(null);
  const [localStreak, setLocalStreak] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    P.playToday(lang).then((d) => {
      setData(d);
      if (d.stats) { setAnswered(d.answered); setStats(d.stats); setCity(d.stats.city); }
      else {
        const l = readLocal();
        if (l?.day === d.day) setAnswered(l.answered);
        setLocalStreak(l ? (l.last === d.day || isYesterday(l.last, d.day) ? l.streak : 0) : 0);
      }
    }).catch(() => {});
  }, [lang, user?.id]);
  useEffect(() => { P.leaderboard(city).then(setBoard).catch(() => {}); }, [city, stats?.points]);

  const answer = async (id: string, choice: "scam" | "safe") => {
    if (answered[id] || !data) return;
    const r = await P.playAnswer(id, choice, lang);
    const next = { ...answered, [id]: { choice, correct: r.correct, answer: r.answer, why: r.why } };
    setAnswered(next);
    if (r.stats) setStats(r.stats);
    if (r.new_badges?.length) setToast(`${t("new_badge")}: ${r.new_badges.map((b) => BADGE_ICON[b] || "🏅").join(" ")}`);
    else if (r.points) setToast(`+${r.points} ${t("points")}`);
    setTimeout(() => setToast(null), 2600);
    if (!user) {
      const l = readLocal();
      const first = !l || l.day !== data.day;
      const streak = first ? (l && isYesterday(l.last, data.day) ? l.streak + 1 : 1) : l!.streak;
      try { localStorage.setItem(LS, JSON.stringify({ day: data.day, answered: next, streak, last: data.day })); } catch { /* private mode */ }
      setLocalStreak(streak);
    }
  };

  const items = data?.items || [];
  const done = items.length > 0 && items.every((i) => answered[i.id]);
  const score = items.filter((i) => answered[i.id]?.correct).length;
  const streak = stats ? stats.streak : localStreak;
  const shareText = () => {
    const row = items.map((i) => (answered[i.id]?.correct ? "🟩" : "🟥")).join("");
    return `ProblemHunt 🎯 Scam or Safe? ${data?.day}\n${row} ${score}/${items.length}  🔥${streak}\n${t("play_share_cta")} ${location.origin}/play/`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="text-center">
        <h1 className="text-3xl font-black text-white">🎯 {t("play_title")}</h1>
        <p className="mt-1 text-slate-400">{t("play_sub")}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-3 py-1 font-bold text-orange-300"><Flame size={15} />{streak} {t("day_streak")}</span>
          {stats && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-3 py-1 font-bold text-cyan-200"><Trophy size={15} />{stats.points} {t("points")}</span>}
          {data && <span className="rounded-full bg-white/5 px-3 py-1 text-slate-400">{data.players_today} {t("players_today")}</span>}
        </div>
        {!user && <p className="mt-2 text-[13px] text-amber-200"><Link href="/account/?next=/play/" className="underline">{t("nav_login")}</Link> — {t("play_login")}</p>}
      </header>

      {items.map((it, n) => {
        const a = answered[it.id];
        const C = CH[it.channel] || CH.sms;
        return (
          <div key={it.id} className={`panel overflow-hidden ${a ? (a.correct ? "ring-2 ring-emerald-400/40" : "ring-2 ring-rose-500/40") : ""}`}>
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-[12px] text-slate-400">
              <span className="font-bold text-slate-200">{n + 1}/{items.length}</span><C.icon size={14} />{C.label}
            </div>
            <p className="whitespace-pre-wrap px-4 py-4 text-[15.5px] leading-relaxed text-white">{it.text}</p>
            {!a ? (
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <button onClick={() => answer(it.id, "scam")} className="rounded-xl bg-rose-600 py-3 text-lg font-black text-white hover:brightness-110"><ShieldAlert className="mr-1 inline" size={20} />{t("btn_scam")}</button>
                <button onClick={() => answer(it.id, "safe")} className="rounded-xl bg-emerald-500 py-3 text-lg font-black text-black hover:brightness-110"><CheckCircle2 className="mr-1 inline" size={20} />{t("btn_safe")}</button>
              </div>
            ) : (
              <div className={`px-4 pb-4 ${a.correct ? "text-emerald-200" : "text-rose-200"}`}>
                <div className="flex items-center gap-2 text-lg font-black">{a.correct ? <CheckCircle2 /> : <XCircle />}
                  {a.correct ? t("play_right") : t("play_wrong")} — {a.answer === "scam" ? t("btn_scam") : t("btn_safe")}</div>
                <p className="mt-1 text-[14px] text-slate-200">{a.why}</p>
              </div>
            )}
          </div>
        );
      })}

      {done && (
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-center">
          <div className="text-4xl font-black text-white">{score}/{items.length}</div>
          <p className="mt-1 text-slate-200">{score === items.length ? t("play_perfect") : t("play_done")}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(typeof window !== "undefined" ? shareText() : "")}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 font-bold text-black"><Share2 size={16} />{t("play_challenge_friends")}</a>
            <Link href="/guide/" className="btn-ghost">{t("guide_title")}</Link>
          </div>
          <p className="mt-2 text-[12px] text-slate-400">{t("play_tomorrow")}</p>
        </div>
      )}

      {stats && (
        <section className="panel p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-white"><Award size={18} className="text-amber-300" />{t("badges")}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.keys(BADGE_ICON).map((b) => (
              <span key={b} title={t(`badge_${b}`)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] ${stats.badges.includes(b) ? "bg-amber-400/20 text-amber-100" : "bg-white/5 text-slate-500 grayscale"}`}>
                {BADGE_ICON[b]} {t(`badge_${b}`)}</span>
            ))}
          </div>
        </section>
      )}

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-white"><Trophy size={18} className="text-cyan-300" />{t("leaderboard")}</h2>
          <div className="flex gap-1">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-white/10 bg-void-950 px-2 py-1 text-sm text-white">
              <option value="">{t("all_india")}</option>
              {(board?.cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {user && !stats?.city && <CityPrompt onSave={(c) => { P.setCity(c).then(() => setStats((s) => (s ? { ...s, city: c } : s))); }} />}
        <ol className="divide-y divide-white/5">
          {(board?.board || []).map((r) => (
            <li key={r.rank} className={`flex items-center gap-3 py-2 ${r.me ? "text-cyan-200" : "text-slate-200"}`}>
              <span className="w-7 text-center font-mono font-bold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
              <span className="flex-1 truncate">{r.name}{r.me && ` (${t("you")})`} <span className="text-[12px] text-slate-500">{r.city}</span></span>
              <span className="font-mono">{r.points}</span>
            </li>
          ))}
          {!board?.board.length && <li className="py-4 text-center text-slate-500">{t("lb_empty")}</li>}
        </ol>
      </section>
    </div>
  );
}

function isYesterday(prev: string, today: string) {
  const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10) === prev;
}

function CityPrompt({ onSave }: { onSave: (c: string) => void }) {
  const { t } = useI18n();
  const [c, setC] = useState("");
  return (
    <div className="mb-3 flex gap-2 rounded-lg bg-white/5 p-2 text-sm">
      <input value={c} onChange={(e) => setC(e.target.value)} placeholder={t("your_city")} className="flex-1 rounded-md border border-white/10 bg-void-950 px-2 py-1 text-white" />
      <button disabled={c.trim().length < 2} onClick={() => onSave(c.trim())} className="rounded-md bg-cyan-400 px-3 font-bold text-black disabled:opacity-40">{t("join_city")}</button>
    </div>
  );
}

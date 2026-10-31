"use client";

import { Bot, Building2, CalendarDays, Compass, Radar, Crown, Flame, KeyRound, Megaphone, ShieldCheck, Siren, Target, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdSlot from "@/components/site/AdSlot";
import CheckBox from "@/components/site/CheckBox";
import ScamMap from "@/components/site/ScamMap";
import { AffiliateSection, ContentCards, HelpPanel, LiveAlerts, PasswordCheck, StatsStrip } from "@/components/site/HomeSections";
import { useI18n } from "@/lib/i18n";
import { P, type Content, type FraudGuideItem, type Program } from "@/lib/product";
import { useSession } from "@/lib/session";

export default function Home() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [content, setContent] = useState<Content[]>([]);
  const [guide, setGuide] = useState<FraudGuideItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  useEffect(() => { P.content(lang).then((c) => setContent(c.slice(0, 6))).catch(() => {}); P.programs(lang).then((p) => setPrograms(p.filter((x) => !x.past).slice(0, 3))).catch(() => {}); }, [lang]);
  useEffect(() => { P.guide().then((g) => setGuide(g.items.slice(0, 4))).catch(() => {}); }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-10">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">{t("hero_title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] text-slate-300 sm:text-lg">{t("hero_sub")}</p>
      </section>
      <div className="mx-auto max-w-3xl"><CheckBox /></div>
      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/play/" className="relative overflow-hidden rounded-2xl border border-orange-400/40 bg-gradient-to-br from-orange-500/20 to-rose-500/10 p-5 transition hover:border-orange-300">
          <div className="flex items-center gap-2 text-lg font-black text-white"><Target className="text-orange-300" />{t("play_title")}</div>
          <p className="mt-1 text-sm text-slate-200">{t("play_teaser")}</p>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-sm font-bold text-orange-200"><Flame size={14} />{user?.streak || 0} {t("day_streak")}
            {user && user.last_play_day !== new Date(Date.now() + 19800000).toISOString().slice(0, 10) && <span className="ml-2 text-amber-200">· {t("play_now")}</span>}</div>
        </Link>
        <Link href="/coach/" className="panel p-5 transition hover:border-cyan-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><Compass className="text-cyan-300" />{t("coach_title")}</div>
          <p className="mt-1 text-sm text-slate-400">{t("coach_teaser")}</p>
        </Link>
        <Link href="/score/" className="panel p-5 transition hover:border-emerald-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><ShieldCheck className="text-emerald-300" />{t("score_title")}</div>
          <p className="mt-1 text-sm text-slate-400">{t("score_teaser")}</p>
        </Link>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/ai/" className="panel p-5 transition hover:border-cyan-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><Bot className="text-cyan-300" />{t("nav_ai")}</div>
          <p className="mt-1 text-sm text-slate-400">Fraud investigator, threat hunter, compliance advisor, coach and career guide — one chat.</p>
        </Link>
        <Link href="/intel/" className="panel p-5 transition hover:border-rose-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><Radar className="text-rose-300" />{t("nav_intel")}</div>
          <p className="mt-1 text-sm text-slate-400">Fraud center with risk scores, exploited vulnerabilities (CISA KEV), government advisories, MITRE ATT&amp;CK.</p>
        </Link>
        <Link href="/org/" className="panel p-5 transition hover:border-emerald-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><Building2 className="text-emerald-300" />{t("nav_org")}</div>
          <p className="mt-1 text-sm text-slate-400">For schools, offices and banks: training, safe phishing tests, compliance and a board report.</p>
        </Link>
      </section>
      <StatsStrip />
      <AdSlot placement="home_top" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <LiveAlerts />
        <div className="space-y-4">
          <HelpPanel />
        </div>
      </div>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Flame size={18} className="text-rose-400" />{t("trending")} · {t("guide_title")}</h2><p className="text-[13px] text-slate-400">{t("guide_sub")}</p></div>
          <Link href="/guide/" className="text-sm text-cyan-300">{t("read_more")} →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {guide.map((g) => (
            <Link key={g.id} href="/guide/" className="panel p-4 transition hover:border-rose-400/40">
              <div className="text-[11px] font-semibold text-rose-300">{g.week_count} {t("this_week")}</div>
              <div className="mt-1 font-semibold leading-snug text-white">{g.title}</div>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-400">{g.flags[0]}</p>
            </Link>
          ))}
        </div>
      </section>
      <ScamMap />
      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/sos/" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 transition hover:border-rose-400">
          <div className="flex items-center gap-2 text-lg font-bold text-rose-100"><Siren className="text-rose-400" />{t("sos_title")}</div>
          <p className="mt-1 text-sm text-slate-200">{t("sos_sub")}</p>
        </Link>
        <Link href="/awareness/" className="panel p-5 transition hover:border-cyan-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><Megaphone className="text-cyan-300" />{t("programs_title")}</div>
          {programs.length ? programs.map((p) => <p key={p.id} className="mt-1 truncate text-sm text-slate-300"><CalendarDays size={12} className="mr-1 inline" />{p.title}</p>)
            : <p className="mt-1 text-sm text-slate-400">{t("programs_sub")}</p>}
        </Link>
        <Link href="/tools/" className="panel p-5 transition hover:border-violet-400/40">
          <div className="flex items-center gap-2 text-lg font-bold text-white"><KeyRound className="text-violet-300" />{t("nav_tools")}</div>
          <p className="mt-1 text-sm text-slate-400">{t("pw_strength")} · {t("pw_gen")} · {t("pw_title")}</p>
        </Link>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div><h2 className="text-lg font-bold text-white">{t("learn_title")}</h2><p className="text-[13px] text-slate-400">{t("learn_sub")}</p></div>
          <Link href="/learn/" className="text-sm text-cyan-300">{t("read_more")} →</Link>
        </div>
        <ContentCards items={content} />
      </section>
      <AdSlot placement="home_inline" />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <div><h2 className="mb-3 text-lg font-bold text-white">{t("tools_title")}</h2><PasswordCheck /></div>
        <div className="space-y-3">
          {!user?.premium && (
            <Link href="/premium/" className="block rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-rose-500/10 p-5 transition hover:border-amber-300/60">
              <div className="flex items-center gap-2 text-lg font-bold text-amber-200"><Crown size={20} />{t("premium_title")}</div>
              <p className="mt-1 text-sm text-slate-200">{t("premium_sub")}</p>
              <span className="mt-3 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black">{t("upgrade")}</span>
            </Link>
          )}
          <Link href="/report/" className="panel flex items-center gap-3 p-4 hover:border-cyan-400/40">
            <Users size={22} className="text-cyan-300" /><div><div className="font-semibold text-white">{t("report_title")}</div><p className="text-[13px] text-slate-400">{t("report_sub")}</p></div>
          </Link>
        </div>
      </section>
      <AffiliateSection />
    </div>
  );
}

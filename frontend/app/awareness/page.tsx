"use client";

import { Building2, CalendarDays, CheckCircle2, MapPin, Megaphone, Users, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatsStrip } from "@/components/site/HomeSections";
import { useI18n } from "@/lib/i18n";
import { P, asset, type Program, type PublicConfig } from "@/lib/product";

const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400/50";

export default function AwarenessPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Program[]>([]);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [reg, setReg] = useState<Program | null>(null);
  const [f, setF] = useState({ name: "", contact: "", city: "" });
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { P.programs(lang).then(setRows).catch(() => {}); P.config().then(setCfg).catch(() => {}); }, [lang, done]);
  const submit = async () => {
    if (!reg) return;
    setErr("");
    try { await P.registerProgram(reg.id, f); setDone(reg.id); setReg(null); setF({ name: "", contact: "", city: "" }); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div><h1 className="flex items-center gap-2 text-3xl font-extrabold text-white"><Megaphone className="text-cyan-300" />{t("programs_title")}</h1>
        <p className="text-slate-400">{t("programs_sub")}</p></div>
      {done && <div className="rounded-xl bg-emerald-400/15 p-3 text-emerald-100"><CheckCircle2 size={16} className="mr-1 inline" />{t("registered")}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 && <p className="text-slate-500">—</p>}
        {rows.map((p) => (
          <div key={p.id} className={`panel overflow-hidden ${p.past ? "opacity-60" : ""}`}>
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset(p.image_url)} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="space-y-2 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">{p.category} · {p.audience}</div>
              <h2 className="text-lg font-bold text-white">{p.title}</h2>
              {p.organizer && <p className="flex items-center gap-1.5 text-sm text-slate-300"><Building2 size={14} />{t("organizer")}: {p.organizer}</p>}
              {p.date_at && <p className="flex items-center gap-1.5 text-sm text-slate-300"><CalendarDays size={14} />{new Date(p.date_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>}
              {p.location && <p className="flex items-center gap-1.5 text-sm text-slate-300"><MapPin size={14} />{p.location}</p>}
              {p.online_url && <a href={p.online_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-cyan-300 underline"><Video size={14} />Online link</a>}
              {p.description && <p className="whitespace-pre-line text-[13.5px] text-slate-300">{p.description}</p>}
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 text-[12px] text-slate-500"><Users size={13} />{p.registrations}</span>
                {!p.past && <button onClick={() => setReg(p)} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black">{t("register")}</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.06] p-5">
        <h2 className="text-lg font-bold text-white">Government, schools, banks &amp; NGOs — partner with ProblemHunt</h2>
        <p className="mt-1 text-sm text-slate-300">Run citizen awareness drives, distribute free Premium codes, and get live, local fraud trends from the community.</p>
        <div className="mt-3"><StatsStrip /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {cfg?.support_email && <a href={`mailto:${cfg.support_email}?subject=Awareness%20program%20partnership`} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black">Contact us</a>}
          <Link href="/guide/" className="btn-ghost">{t("guide_title")}</Link><Link href="/trust/" className="btn-ghost">{t("trust")}</Link>
        </div>
      </section>
      {reg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={() => setReg(null)}>
          <div className="panel w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2"><h3 className="font-bold text-white">{reg.title}</h3><button onClick={() => setReg(null)}><X /></button></div>
            <input className={inp} placeholder={t("name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className={inp} placeholder={t("contact")} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
            <input className={inp} placeholder={t("city")} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            {err && <p className="text-sm text-rose-300">{err}</p>}
            <button onClick={submit} disabled={f.name.length < 2 || f.contact.length < 5} className="w-full rounded-xl bg-cyan-400 py-3 font-bold text-black disabled:opacity-40">{t("register")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

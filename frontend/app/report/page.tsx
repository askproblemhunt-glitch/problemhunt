"use client";

import { CheckCircle2, Flag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AdSlot from "@/components/site/AdSlot";
import GovtLinks from "@/components/site/GovtLinks";
import ScamMap from "@/components/site/ScamMap";
import { useI18n } from "@/lib/i18n";
import { P, type Report } from "@/lib/product";
import { timeAgo } from "@/components/ui";

const KINDS = ["phone", "upi", "url", "email", "social", "app", "other"];

function ReportInner() {
  const { t, lang } = useI18n();
  const sp = useSearchParams();
  const [f, setF] = useState({ kind: sp.get("kind") && KINDS.includes(sp.get("kind")!) ? sp.get("kind")! : "phone", value: sp.get("value") || "", description: "", amount_lost: "", city: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<Report[]>([]);
  useEffect(() => { P.recentReports().then(setRecent).catch(() => {}); }, [done]);
  const submit = async () => {
    setErr("");
    try {
      await P.report({ ...f, amount_lost: Number(f.amount_lost) || 0, lang });
      setDone(true);
    } catch (e) { setErr((e as Error).message); }
  };
  const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400/50";
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div><h1 className="flex items-center gap-2 text-3xl font-extrabold text-white"><Flag className="text-rose-400" />{t("report_title")}</h1>
          <p className="mt-1 text-slate-400">{t("report_sub")}</p></div>
        {done ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-emerald-100"><CheckCircle2 className="mb-2" />{t("r_thanks")}</div>
        ) : (
          <div className="panel space-y-3 p-4">
            <label className="block text-sm text-slate-300">{t("r_kind")}
              <div className="mt-1 flex flex-wrap gap-1.5">{KINDS.map((k) => (
                <button key={k} onClick={() => setF({ ...f, kind: k })} className={`rounded-full px-3 py-1 text-sm ${f.kind === k ? "bg-rose-500 text-white" : "bg-white/5 text-slate-300"}`}>{k.toUpperCase()}</button>))}
              </div></label>
            <label className="block text-sm text-slate-300">{t("r_value")}<input className={inp} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
            <label className="block text-sm text-slate-300">{t("r_desc")}<textarea rows={4} className={inp} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-slate-300">{t("r_amount")}<input inputMode="decimal" className={inp} value={f.amount_lost} onChange={(e) => setF({ ...f, amount_lost: e.target.value })} /></label>
              <label className="block text-sm text-slate-300">{t("r_city")}<input className={inp} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
            </div>
            {err && <p className="text-sm text-rose-300">{err}</p>}
            <button onClick={submit} disabled={f.value.length < 3} className="w-full rounded-xl bg-rose-500 py-3 font-bold text-white disabled:opacity-40">{t("r_submit")}</button>
            <p className="text-[11.5px] text-slate-500">Reports are reviewed before they are shown publicly. Please report only real incidents.</p>
          </div>
        )}
        <GovtLinks compact />
        <AdSlot placement="report" />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-bold text-white">{t("recent_reports")}</h2>
        <div className="panel divide-y divide-white/5">
          {recent.length === 0 && <p className="p-4 text-sm text-slate-500">—</p>}
          {recent.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm text-rose-200">{r.value}</span>
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{r.kind}</span>
              </div>
              {r.description && <p className="mt-1 line-clamp-2 text-[13px] text-slate-300">{r.description}</p>}
              <div className="mt-1 text-[11px] text-slate-500">{r.times_reported} {t("times")} · {r.city || "—"} · {timeAgo(r.created_at)}{r.amount_lost ? ` · ₹${r.amount_lost.toLocaleString()}` : ""}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2"><ScamMap /></div>
    </div>
  );
}

export default function ReportPage() {
  return <Suspense fallback={null}><ReportInner /></Suspense>;
}

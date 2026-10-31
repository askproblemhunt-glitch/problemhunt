"use client";

import { AlertTriangle, ChevronDown, Flame, LifeBuoy, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdSlot from "@/components/site/AdSlot";
import { useI18n } from "@/lib/i18n";
import { P, type FraudGuideItem } from "@/lib/product";

function GuideCard({ g, open, onToggle }: { g: FraudGuideItem; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const Sec = ({ icon: Icon, title, items, color }: { icon: typeof Flame; title: string; items: string[]; color: string }) => (
    <div><h4 className={`mb-1 flex items-center gap-1.5 text-[13px] font-bold ${color}`}><Icon size={14} />{title}</h4>
      <ul className="space-y-1">{items.map((x) => <li key={x} className="flex gap-2 text-[13.5px] text-slate-200"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />{x}</li>)}</ul></div>
  );
  return (
    <div className="panel overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">{g.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-slate-400">
            {g.week_count > 0 && <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-300"><Flame size={11} />{t("trending")}</span>}
            <span>{g.week_count} {t("this_week")}</span>
          </div>
        </div>
        <ChevronDown className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-white/5 p-4 md:grid-cols-2">
          <div className="md:col-span-2"><h4 className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-cyan-300"><Workflow size={14} />{t("how_it_works")}</h4><p className="text-[14px] text-slate-200">{g.how}</p></div>
          <Sec icon={AlertTriangle} title={t("red_flags")} items={g.flags} color="text-amber-300" />
          <Sec icon={ShieldCheck} title={t("how_to_stop")} items={g.stop} color="text-emerald-300" />
          <div className="md:col-span-2"><Sec icon={LifeBuoy} title={t("if_victim")} items={g.victim} color="text-rose-300" /></div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Link href="/" className="btn-ghost">{t("check_btn")}</Link><Link href="/report/" className="btn-ghost">{t("report_this")}</Link>
            <a href="tel:1930" className="btn-ghost">📞 1930</a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<FraudGuideItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { P.guide().then((r) => { setItems(r.items); setOpen(r.items[0]?.id ?? null); }).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div><h1 className="text-3xl font-extrabold text-white">{t("guide_title")}</h1><p className="text-slate-400">{t("guide_sub")}</p></div>
      <AdSlot placement="learn" />
      <div className="space-y-2">{items.map((g) => <GuideCard key={g.id} g={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} />)}</div>
    </div>
  );
}

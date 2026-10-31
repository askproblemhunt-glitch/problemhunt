"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AdSlot from "@/components/site/AdSlot";
import { ContentCards } from "@/components/site/HomeSections";
import { useI18n } from "@/lib/i18n";
import { P, asset, youtubeEmbed, type Content } from "@/lib/product";

function Body({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15.5px] leading-relaxed text-slate-200">
      {text.split(/\n{2,}|\n(?=\d+\.)/).map((para, i) => (
        <p key={i}>{para.split(/(https?:\/\/[^\s)]+)/g).map((part, j) =>
          /^https?:\/\//.test(part) ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">{part}</a> : part)}</p>
      ))}
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const { t } = useI18n();
  const [c, setC] = useState<Content | null>(null);
  useEffect(() => { P.contentOne(id).then(setC).catch(() => setC(null)); }, [id]);
  if (!c) return <div className="p-10 text-center text-slate-500">…</div>;
  const embed = c.video_url ? youtubeEmbed(c.video_url) : null;
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Link href="/learn/" className="inline-flex items-center gap-1 text-sm text-cyan-300"><ArrowLeft size={15} />{t("back")}</Link>
      <h1 className="text-3xl font-extrabold leading-tight text-white">{c.title}</h1>
      {c.summary && <p className="text-lg text-slate-300">{c.summary}</p>}
      {c.video_url && (embed
        ? <iframe src={embed} title={c.title} className="aspect-video w-full rounded-xl" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        : <video src={asset(c.video_url)} controls playsInline className="w-full rounded-xl" />)}
      {c.image_url && !c.video_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset(c.image_url)} alt="" className="w-full rounded-xl" />
      )}
      {c.body && <Body text={c.body} />}
      {c.locked && <Link href="/premium/" className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 font-semibold text-amber-200"><Lock size={16} />Premium · {t("upgrade")}</Link>}
      <AdSlot placement="learn" />
    </article>
  );
}

function List() {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Content[]>([]);
  useEffect(() => { const h = setTimeout(() => P.content(lang, kind, q).then(setItems).catch(() => {}), 200); return () => clearTimeout(h); }, [lang, kind, q]);
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div><h1 className="text-3xl font-extrabold text-white">{t("learn_title")}</h1><p className="text-slate-400">{t("learn_sub")}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {[["", t("all")], ["video", t("videos")], ["article", t("articles")], ["tip", t("tips")]].map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm ${kind === k ? "bg-cyan-400 text-black" : "bg-white/5 text-slate-300"}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="ml-auto rounded-lg border border-white/10 bg-void-900 px-3 py-1.5 text-sm text-white outline-none" />
      </div>
      <AdSlot placement="learn" />
      <ContentCards items={items} />
    </div>
  );
}

function LearnInner() {
  const id = useSearchParams().get("id");
  return id ? <Detail id={id} /> : <List />;
}

export default function LearnPage() {
  return <Suspense fallback={null}><LearnInner /></Suspense>;
}

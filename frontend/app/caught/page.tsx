"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { W } from "@/lib/v5";

export default function CaughtPage() {
  const [q, setQ] = useState<{ t: string; reported: boolean }>({ t: "", reported: false });
  const [tpl, setTpl] = useState<{ name: string; subject: string; from_name: string; flags: string[] } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("t") || "";
    setQ({ t, reported: p.get("reported") === "1" });
    if (t) W.simTemplate(t).then(setTpl).catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-12 text-center">
      {q.reported ? <CheckCircle2 size={56} className="mx-auto text-emerald-400" /> : <ShieldAlert size={56} className="mx-auto text-amber-300" />}
      <h1 className="text-3xl font-black text-white">{q.reported ? "Well spotted — you reported a training email!" : "This was a phishing training exercise"}</h1>
      <p className="text-slate-300">{q.reported ? "Reporting suspicious emails is exactly the right move. Your organisation's team score just went up." :
        "Nothing bad happened: no password was collected and nothing was installed. Your organisation sends these safe tests so everyone learns to spot real attacks."}</p>
      {tpl && <div className="panel p-5 text-left">
        <div className="text-[12px] text-slate-500">From: {tpl.from_name} · Subject: {tpl.subject}</div>
        <h2 className="mt-2 font-bold text-white">The clues in this email</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-200">{tpl.flags.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/courses/?id=phishing" className="rounded-lg bg-cyan-400 px-5 py-2.5 font-bold text-black">Take the 5-minute phishing course</Link>
        <Link href="/play/" className="btn-ghost">Practise with today&apos;s game</Link>
      </div>
    </div>
  );
}

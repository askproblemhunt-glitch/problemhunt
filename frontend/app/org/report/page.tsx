"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { W } from "@/lib/v5";

const LABEL: Record<string, string> = { risk_posture: "Risk posture", compliance: "Compliance", maturity: "Security maturity (1–5)", awareness: "Awareness", exposure: "Threat exposure (lower is better)" };
const STATUS: Record<string, string> = { done: "Done", partial: "Partly", not_started: "Not started", na: "N/A" };

export default function ReportPage() {
  const [r, setR] = useState<Record<string, any> | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { W.report().then(setR).catch((e) => setErr(e.message)); }, []);
  if (!r) return <p className="p-10 text-center text-slate-500">{err ? <>{err} <Link href="/org/" className="underline">Back</Link></> : "Preparing report…"}</p>;
  return (
    <div className="report mx-auto max-w-3xl space-y-5 px-4 py-8 print:max-w-none print:bg-white print:text-black">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[12px] uppercase tracking-wider text-slate-400 print:text-gray-500">Cyber risk report · ProblemHunt Workplace</div>
          <h1 className="text-3xl font-black text-white print:text-black">{r.org}</h1>
          <div className="text-sm text-slate-400 print:text-gray-600">Generated {new Date(r.generated_at).toLocaleString()}</div></div>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 font-bold text-black print:hidden"><Printer size={16} />Print / save PDF</button>
      </div>
      <section><h2 className="mb-1 text-lg font-bold text-white print:text-black">Summary</h2><p className="text-slate-200 print:text-black">{r.summary}</p></section>
      <section><h2 className="mb-2 text-lg font-bold text-white print:text-black">Scores</h2>
        <table className="w-full text-sm"><tbody>{Object.entries(r.scores as Record<string, number>).map(([k, v]) => (
          <tr key={k} className="border-b border-white/10 print:border-gray-300"><td className="py-1.5">{LABEL[k] || k}</td><td className="text-right font-mono font-bold">{v}{k === "maturity" ? "/5" : "/100"}</td></tr>))}</tbody></table></section>
      <section><h2 className="mb-2 text-lg font-bold text-white print:text-black">Top risks and recommended fixes</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{(r.risks as { level: string; text: string; fix: string }[]).map((x, i) => <li key={i}><b className="uppercase">[{x.level}]</b> {x.text} <i>{x.fix}</i></li>)}</ol></section>
      <section><h2 className="mb-2 text-lg font-bold text-white print:text-black">Compliance coverage</h2>
        <table className="w-full text-sm"><tbody>{(r.coverage.frameworks as { name: string; pct: number }[]).map((f) => (
          <tr key={f.name} className="border-b border-white/10 print:border-gray-300"><td className="py-1">{f.name}</td><td className="text-right font-mono">{f.pct}%</td></tr>))}</tbody></table>
        <p className="mt-1 text-[11px] text-slate-500">Indicative self-assessment mapping; confirm with a qualified auditor.</p></section>
      <section><h2 className="mb-2 text-lg font-bold text-white print:text-black">Controls</h2>
        <table className="w-full text-sm"><tbody>{(r.controls as { id: string; title: string; status: string; owner: string }[]).map((c) => (
          <tr key={c.id} className="border-b border-white/10 print:border-gray-300"><td className="py-1 font-mono text-[11px]">{c.id}</td><td>{c.title}</td><td>{STATUS[c.status]}</td><td className="text-slate-400">{c.owner}</td></tr>))}</tbody></table></section>
      {(r.kev as unknown[]).length > 0 && <section><h2 className="mb-2 text-lg font-bold text-white print:text-black">Known-exploited vulnerabilities to patch</h2>
        <ul className="text-sm">{(r.kev as { cve: string; vendor: string; product: string; due_date: string }[]).map((k) => <li key={k.cve}>{k.cve} — {k.vendor} {k.product} (CISA due {k.due_date})</li>)}</ul></section>}
      <p className="text-[11px] text-slate-500">ProblemHunt gives security guidance; it is not a certification body or legal advice.</p>
    </div>
  );
}

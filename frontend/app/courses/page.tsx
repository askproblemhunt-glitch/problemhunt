"use client";

import { ArrowLeft, BookOpen, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { W, type Course, type CourseFull } from "@/lib/v5";

export default function CoursesPage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setId(new URLSearchParams(window.location.search).get("id"));
    read(); window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const open = (cid: string | null) => { window.history.pushState(null, "", cid ? `/courses/?id=${cid}` : "/courses/"); setId(cid); window.scrollTo(0, 0); };
  return id ? <Player id={id} back={() => open(null)} /> : <List open={open} />;
}

function List({ open }: { open: (id: string) => void }) {
  const { lang } = useI18n();
  const { user } = useSession();
  const [rows, setRows] = useState<Course[]>([]);
  useEffect(() => { W.courses().then(setRows).catch(() => {}); }, [user?.id]);
  const done = rows.filter((r) => r.done).length;
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <header><h1 className="flex items-center gap-2 text-3xl font-black text-white"><BookOpen className="text-cyan-300" />Security courses</h1>
        <p className="text-slate-400">Short, practical lessons with a quiz. {user ? `${done} of ${rows.length} done.` : "Log in to save progress and earn points."}</p></header>
      <div className="grid gap-3 sm:grid-cols-2">{rows.map((c) => (
        <button key={c.id} onClick={() => open(c.id)} className="panel p-4 text-left transition hover:border-cyan-400/40">
          <div className="flex items-center justify-between text-[12px] text-slate-400"><span className="inline-flex items-center gap-1"><Clock size={12} />{c.minutes} min · {c.level}</span>
            {c.done && <span className="text-emerald-300">✓ {c.score}/{c.total}</span>}</div>
          <div className="mt-1 text-lg font-bold text-white">{lang === "hi" && c.title_hi ? c.title_hi : c.title}</div>
          <div className="text-[12.5px] text-slate-400">{c.lessons} lessons · {c.questions} questions</div>
        </button>))}</div>
      <p className="text-sm text-slate-400">Organisations: track your team&apos;s progress in <Link href="/org/" className="text-cyan-300">Workplace</Link>.</p>
    </div>
  );
}

function Player({ id, back }: { id: string; back: () => void }) {
  const [c, setC] = useState<CourseFull | null>(null);
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<number[]>([]);
  const [res, setRes] = useState<Awaited<ReturnType<typeof W.submit>> | null>(null);
  useEffect(() => { W.course(id).then((x) => { setC(x); setStep(0); setAns([]); setRes(null); }).catch(() => {}); }, [id]);
  if (!c) return <p className="p-10 text-center text-slate-500">…</p>;
  const n = c.lessons.length;
  const lesson = c.lessons[step];
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <button onClick={back} className="flex items-center gap-1 text-sm text-slate-400"><ArrowLeft size={14} />All courses</button>
      <h1 className="text-2xl font-black text-white">{c.title}</h1>
      <div className="flex gap-1">{[...c.lessons, null].map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-cyan-400" : "bg-white/10"}`} />)}</div>
      {step < n ? (
        <div className="panel p-5">
          <div className="text-[12px] text-slate-500">Lesson {step + 1} of {n}</div>
          <h2 className="mt-1 text-xl font-bold text-white">{lesson.title}</h2>
          {lesson.body.split("\n\n").map((p, i) => <p key={i} className="mt-3 leading-relaxed text-slate-200">{p}</p>)}
          <div className="mt-5 flex justify-between">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className="btn-ghost disabled:opacity-30">Back</button>
            <button onClick={() => setStep(step + 1)} className="rounded-lg bg-cyan-400 px-5 py-2 font-bold text-black">{step === n - 1 ? "Take the quiz" : "Next"}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {c.quiz.map((q, qi) => (
            <div key={qi} className="panel p-4">
              <div className="font-semibold text-white">{qi + 1}. {q.q}</div>
              <div className="mt-2 space-y-1">{q.options.map((o, oi) => {
                const r = res?.results[qi];
                const chosen = ans[qi] === oi;
                const cls = r ? (oi === r.answer ? "border-emerald-400 bg-emerald-400/10" : chosen ? "border-rose-500 bg-rose-500/10" : "border-white/10")
                  : chosen ? "border-cyan-400 bg-cyan-400/10" : "border-white/10";
                return <button key={oi} disabled={!!res} onClick={() => { const a = [...ans]; a[qi] = oi; setAns(a); }} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-100 ${cls}`}>{o}</button>;
              })}</div>
              {res && <p className={`mt-2 flex gap-1 text-sm ${res.results[qi].correct ? "text-emerald-300" : "text-rose-300"}`}>{res.results[qi].correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{res.results[qi].why}</p>}
            </div>))}
          {!res ? <button disabled={ans.filter((a) => a !== undefined).length < c.quiz.length} onClick={async () => setRes(await W.submit(id, ans))}
            className="w-full rounded-xl bg-cyan-400 py-3 font-bold text-black disabled:opacity-40">Submit answers</button> : (
            <div className={`rounded-2xl p-5 text-center ${res.passed ? "bg-emerald-400/10" : "bg-amber-400/10"}`}>
              <div className="text-3xl font-black text-white">{res.score}/{res.total}</div>
              <p className="text-slate-200">{res.passed ? "Passed — well done!" : "Almost there — review the lessons and try again."}{res.points ? ` +${res.points} points` : ""}</p>
              <div className="mt-3 flex justify-center gap-2"><button onClick={back} className="btn-ghost">More courses</button>
                {!res.passed && <button onClick={() => { setRes(null); setAns([]); setStep(0); }} className="rounded-lg bg-cyan-400 px-4 py-2 font-bold text-black">Try again</button>}</div>
            </div>)}
        </div>
      )}
    </div>
  );
}

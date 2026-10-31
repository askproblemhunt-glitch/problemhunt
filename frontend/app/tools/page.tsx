"use client";

import { Copy, KeyRound, RefreshCw, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PasswordCheck } from "@/components/site/HomeSections";
import { useI18n } from "@/lib/i18n";

function strength(pw: string): { score: number; tips: string[] } {
  const tips: string[] = [];
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26; else tips.push("add lowercase letters");
  if (/[A-Z]/.test(pw)) pool += 26; else tips.push("add CAPITAL letters");
  if (/\d/.test(pw)) pool += 10; else tips.push("add numbers");
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33; else tips.push("add symbols like ! @ #");
  if (pw.length < 12) tips.push("use 12+ characters");
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  if (/(.)\1{2,}/.test(pw)) { bits -= 15; tips.push("avoid repeated characters"); }
  if (/(1234|abcd|qwerty|password|india|admin|welcome|iloveyou)/i.test(pw)) { bits -= 30; tips.push("avoid common words like 'password' or '1234'"); }
  if (/(19|20)\d{2}/.test(pw)) { bits -= 8; tips.push("avoid years and birthdays"); }
  return { score: bits < 28 ? 0 : bits < 45 ? 1 : bits < 65 ? 2 : 3, tips };
}

const WORDS = "river tiger mango cloud rocket pepper silver garden window planet lemon candle forest ocean pixel thunder violet copper saffron monsoon".split(" ");

export default function ToolsPage() {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [gen, setGen] = useState("");
  const [mode, setMode] = useState<"random" | "words">("random");
  const [copied, setCopied] = useState(false);
  const s = useMemo(() => strength(pw), [pw]);
  const generate = () => {
    const r = new Uint32Array(24); crypto.getRandomValues(r);
    if (mode === "words") {
      setGen([0, 1, 2, 3].map((i) => WORDS[r[i] % WORDS.length]).map((w, i) => (i === 1 ? w.toUpperCase() : w)).join("-") + "-" + (r[5] % 90 + 10) + "!");
    } else {
      const cs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
      setGen(Array.from(r.slice(0, 18), (x) => cs[x % cs.length]).join(""));
    }
    setCopied(false);
  };
  useEffect(generate, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const labels = [t("weak"), t("fair"), t("strong"), t("very_strong")];
  const colors = ["#f43f5e", "#fbbf24", "#22d3ee", "#34d399"];
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div><h1 className="text-3xl font-extrabold text-white">{t("nav_tools")}</h1><p className="text-slate-400">{t("tools_sub")}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="flex items-center gap-2 font-semibold text-white"><KeyRound size={17} className="text-cyan-300" />{t("pw_strength")}</h2>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off"
            className="mt-3 w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-white outline-none" />
          {pw && (
            <>
              <div className="mt-3 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-2 rounded" style={{ background: i <= s.score ? colors[s.score] : "rgba(255,255,255,.08)" }} />)}</div>
              <p className="mt-1 text-sm font-bold" style={{ color: colors[s.score] }}>{labels[s.score]}</p>
              {s.tips.length > 0 && <ul className="mt-1 list-inside list-disc text-[12.5px] text-slate-400">{s.tips.slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>}
            </>
          )}
          <p className="mt-2 text-[11px] text-slate-500">{t("pw_sub")}</p>
        </div>
        <div className="panel p-4">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Wand2 size={17} className="text-emerald-300" />{t("pw_gen")}</h2>
          <div className="mt-3 flex gap-2">{(["random", "words"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs ${mode === m ? "bg-emerald-400 text-black" : "bg-white/5 text-slate-300"}`}>{m === "random" ? "Ab3$…" : "word-WORD-word"}</button>)}</div>
          <div className="mt-3 break-all rounded-lg bg-void-950 p-3 font-mono text-lg text-emerald-200">{gen}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={generate} className="btn-ghost"><RefreshCw size={14} /></button>
            <button onClick={async () => { try { await navigator.clipboard.writeText(gen); setCopied(true); } catch {} }} className="btn-ghost"><Copy size={14} />{copied ? t("copied") : t("copy")}</button>
          </div>
        </div>
      </div>
      <PasswordCheck />
    </div>
  );
}

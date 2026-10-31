"use client";

import jsQR from "jsqr";
import { AlertOctagon, Camera, CheckCircle2, Crown, FileImage, Flag, ImageUp, Loader2, Search, Share2, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, type CheckResult } from "@/lib/product";
import { useSession } from "@/lib/session";
import AdSlot from "./AdSlot";
import AffiliateCards from "./AffiliateCards";
import GovtLinks from "./GovtLinks";
import ShareImageButton from "./ShareCard";
import { readScreenshot } from "@/lib/ocr";

const EXAMPLES = [
  { label: "SMS", text: "Dear customer, your SBI KYC is pending. Account will be blocked within 24 hours. Update: http://sbi-kyc-verify.top/login" },
  { label: "UPI", text: "refund.helpdesk@okaxis" },
  { label: "Link", text: "https://paypa1-secure-login.xyz/verify" },
  { label: "Job", text: "Part time job! Earn Rs 3000 daily by liking YouTube videos. Contact our Telegram task mentor." },
  { label: "Email", text: "sbi.support.team@gmail.com" },
];

function decode(img: CanvasImageSource, w: number, h: number): string | null {
  const c = document.createElement("canvas");
  const s = Math.min(1, 1024 / Math.max(w, h));
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

const STYLE = {
  malicious: { c: "#f43f5e", bg: "bg-rose-500/10", ring: "ring-rose-500/40", Icon: AlertOctagon },
  suspicious: { c: "#fbbf24", bg: "bg-amber-400/10", ring: "ring-amber-400/40", Icon: ShieldAlert },
  safe: { c: "#34d399", bg: "bg-emerald-400/10", ring: "ring-emerald-400/40", Icon: CheckCircle2 },
};

export default function CheckBox({ initial = "" }: { initial?: string }) {
  const { t, lang } = useI18n();
  const { refresh } = useSession();
  const shotRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState<number | null>(null);
  const onShot = async (f: File) => {
    setErr(null); setRes(null); setOcr(0);
    try {
      const txt = await readScreenshot(f, lang, setOcr);
      if (!txt) { setErr({ msg: t("ocr_none") }); return; }
      setText(txt); setOcr(null); run(txt);
    } catch { setErr({ msg: t("ocr_fail") }); } finally { setOcr(null); }
  };
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<{ msg: string; limit?: boolean } | null>(null);
  const [cam, setCam] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = async (value = text, kind = "auto") => {
    if (!value.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await P.check(value.trim(), kind);
      setRes(r); refresh();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      const st = (e as { status?: number }).status;
      setErr({ msg: (e as Error).message, limit: st === 429 });
    } finally { setBusy(false); }
  };

  const onQR = (payload: string | null) => {
    if (!payload) { setErr({ msg: "No QR code found. Try a clearer photo." }); return; }
    setText(payload); run(payload, "qr");
  };

  const share = () => {
    if (!res) return;
    const msg = `${t("share_msg")} ${res.checked_value}\n→ ${t(`v_${res.verdict}`)} (${t("risk")} ${res.risk_score}/100)\n${typeof window !== "undefined" ? window.location.origin : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const S = res ? STYLE[res.verdict] : null;

  return (
    <div>
      <div className="panel p-3 sm:p-4">
        <div className="relative">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={8000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.length < 300 && !text.includes("\n")) { e.preventDefault(); run(); } }}
            placeholder={t("check_placeholder")}
            className="w-full resize-none rounded-xl border border-white/10 bg-void-950/80 p-4 pr-10 text-[15px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10" />
          {text && <button aria-label="clear" onClick={() => { setText(""); setRes(null); }} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={18} /></button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => run()} disabled={busy || !text.trim()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 text-base font-bold text-void-950 shadow-[0_0_30px_-8px_#22d3ee] transition hover:brightness-110 disabled:opacity-40 sm:flex-none">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}{busy ? t("checking") : t("check_btn")}
          </button>
          <button onClick={() => shotRef.current?.click()} disabled={ocr !== null} className="btn-ghost !py-3 !border-violet-400/40 !text-violet-100">
            {ocr !== null ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}{ocr !== null ? `${t("ocr_reading")} ${ocr}%` : t("check_screenshot")}</button>
          <input ref={shotRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onShot(f); }} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-3"><ImageUp size={16} />{t("check_qr_photo")}</button>
          <button onClick={() => setCam(true)} className="btn-ghost !py-3"><Camera size={16} />{t("check_camera")}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const url = URL.createObjectURL(f); const img = new Image();
            img.onload = () => { onQR(decode(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(url); };
            img.src = url;
          }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
          {t("try_examples")}
          {EXAMPLES.map((x) => (
            <button key={x.label} onClick={() => { setText(x.text); run(x.text); }}
              className="rounded-md border border-white/10 px-2 py-0.5 text-slate-400 hover:border-cyan-400/40 hover:text-cyan-200">{x.label}</button>
          ))}
        </div>
      </div>

      {err && (
        <div className={`mt-3 rounded-xl border p-4 text-sm ${err.limit ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-rose-500/30 bg-rose-500/10 text-rose-100"}`}>
          {err.limit && <b className="block">{t("limit_reached")}</b>}
          {err.msg}
          {err.limit && <Link href="/premium/" className="ml-2 inline-flex items-center gap-1 font-bold text-amber-300 underline"><Crown size={14} />{t("upgrade")}</Link>}
        </div>
      )}

      {res && S && (
        <div ref={resultRef} className="mt-4 scroll-mt-24 space-y-4 animate-slidein">
          <div className={`rounded-2xl p-5 ring-2 ${S.bg} ${S.ring}`}>
            <div className="flex items-start gap-4">
              <S.Icon size={44} style={{ color: S.c }} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-extrabold leading-tight" style={{ color: S.c }}>{t(`v_${res.verdict}`)}</h2>
                <p className="mt-1 text-[15px] text-slate-100">{t(`v_${res.verdict}_tip`)}</p>
                {res.verdict !== "safe" && <p className="mt-1 text-sm text-slate-300">{res.category_label}</p>}
              </div>
              <div className="text-right">
                <div className="font-mono text-4xl font-black tabular-nums" style={{ color: S.c }}>{res.risk_score}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{t("risk")} /100</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(4, res.risk_score)}%`, background: S.c }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={share} className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-black hover:brightness-110">
                <Share2 size={16} />{t("warn_family")}
              </button>
              {res.verdict !== "safe" && (
                <ShareImageButton label={t("share_image")} spec={{
                  badge: res.verdict === "malicious" ? "⚠ SCAM ALERT" : "⚠ BE CAREFUL", color: S.c,
                  title: t(`v_${res.verdict}`),
                  lines: [res.checked_value.slice(0, 140), res.category_label, ...res.indicators.slice(0, 2), t(`v_${res.verdict}_tip`)].filter(Boolean),
                }} />
              )}
              {res.verdict !== "safe" && (
                <Link href={`/report/?value=${encodeURIComponent(res.checked_value)}&kind=${res.kind}`} className="btn-ghost !py-2 !text-sm">
                  <Flag size={15} />{t("report_this")}
                </Link>
              )}
            </div>
          </div>

          {res.verdict !== "safe" && <GovtLinks />}
          {(res.indicators.length > 0 || res.providers.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {res.indicators.length > 0 && (
                <div className="panel p-4">
                  <h3 className="mb-2 text-sm font-semibold text-white">{t("why")}</h3>
                  <ul className="space-y-1.5">
                    {res.indicators.map((i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-slate-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: S.c }} />{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="panel p-4">
                <h3 className="mb-2 text-sm font-semibold text-white">{t("checked_by")}</h3>
                <ul className="space-y-1.5 text-[13px]">
                  <li className="flex justify-between gap-2"><span className="text-slate-300">ProblemHunt AI engine</span><span className="text-slate-500">{res.elapsed_ms} ms</span></li>
                  <li className="flex justify-between gap-2"><span className="text-slate-300">Live phishing feeds</span><span className="text-slate-500">✓</span></li>
                  <li className="flex justify-between gap-2"><span className="text-slate-300">{t("community_reports")}</span>
                    <span className={res.community.approved ? "font-semibold text-rose-300" : "text-slate-500"}>{res.community.approved + res.community.pending}</span></li>
                  {res.providers.map((p) => (
                    <li key={p.provider} className="flex justify-between gap-2">
                      <span className="text-slate-300">{p.label}</span>
                      <span className={p.status === "malicious" ? "text-rose-300" : p.status === "suspicious" ? "text-amber-300" : p.status === "clean" ? "text-emerald-300" : "text-slate-500"}
                        title={p.detail}>{p.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {res.affiliates.length > 0 && <AffiliateCards items={res.affiliates} compact />}
          <AdSlot placement="result" />
          <p className="text-[12px] text-slate-500">
            {res.usage.premium ? t("unlimited") : res.usage.limit != null ? `${Math.max(0, res.usage.limit - res.usage.used)} ${t("checks_left")}` : ""}
            {!res.usage.premium && <Link href="/premium/" className="ml-2 text-amber-300 underline">{t("upgrade")}</Link>}
          </p>
        </div>
      )}

      {cam && <CameraModal onClose={() => setCam(false)} onResult={(p) => { setCam(false); onQR(p); }} />}
    </div>
  );
}

function CameraModal({ onClose, onResult }: { onClose: () => void; onResult: (p: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = ref.current!; v.srcObject = stream; await v.play();
        const tick = () => {
          if (stop) return;
          if (v.readyState >= 2) { const p = decode(v, v.videoWidth, v.videoHeight); if (p) { onResult(p); return; } }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setError(true); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end"><button onClick={onClose} aria-label="close"><X /></button></div>
        {error ? <p className="text-rose-300">Camera unavailable — allow camera access or upload a QR photo.</p> :
          <div className="relative overflow-hidden rounded-lg"><video ref={ref} playsInline muted className="w-full" />
            <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-cyan-300" /></div>}
      </div>
    </div>
  );
}

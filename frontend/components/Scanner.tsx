"use client";

import jsQR from "jsqr";
import { Camera, ImageUp, Loader2, ScanLine, ShieldCheck, ShieldQuestion, ShieldX, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ScanResult } from "@/lib/types";
import { SEV_COLOR } from "@/lib/types";
import { Panel, SevBadge, Tag } from "./ui";

const KINDS = [
  { id: "auto", label: "Auto-detect" },
  { id: "url", label: "Link" },
  { id: "message", label: "SMS / WhatsApp" },
  { id: "qr", label: "QR payload" },
  { id: "audio_transcript", label: "Call transcript" },
] as const;

const SAMPLES = [
  { label: "Bank KYC SMS", kind: "message", text: "Dear customer, your SBI KYC is pending. Account will be blocked within 24 hours. Update now: http://sbi-kyc-verify.top/login" },
  { label: "Job trap", kind: "message", text: "Hello! Part time job available. Earn Rs 3000 daily income by liking YouTube videos. No interview needed. Contact our Telegram task mentor." },
  { label: "Refund QR", kind: "qr", text: "upi://pay?pa=refund.desk77@ybl&pn=Refund%20Helpdesk&am=4999&cu=INR" },
  { label: "Voice clone", kind: "audio_transcript", text: "Mom it's me, I'm in trouble, police took my phone. Please don't tell dad, send money urgently to this new number." },
  { label: "Safe text", kind: "message", text: "Hey, are we still on for lunch tomorrow at 1? I booked a table." },
];

function decodeImage(img: CanvasImageSource, w: number, h: number): string | null {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export default function Scanner({ nodeName }: { nodeName?: string }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<string>("auto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (content = text, k = kind) => {
    if (!content.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.scan(content.trim(), k, nodeName));
    } catch (e) {
      setErr((e as Error).message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const onQrDecoded = (payload: string | null) => {
    if (!payload) {
      setErr("No QR code found in that image. Try a sharper, closer photo.");
      return;
    }
    setText(payload);
    setKind("qr");
    run(payload, "qr");
  };

  const onFile = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      onQrDecoded(decodeImage(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const Verdict = res?.verdict === "malicious" ? ShieldX : res?.verdict === "suspicious" ? ShieldQuestion : ShieldCheck;
  const vColor = res ? (res.verdict === "safe" ? "#34d399" : SEV_COLOR[res.severity]) : "#22d3ee";

  return (
    <Panel title="One-Click Threat Scanner" icon={<ScanLine size={14} />} right={<Tag tone="cyan">static analysis · links never opened</Tag>} className="h-full">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${kind === k.id ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/40" : "bg-white/5 text-slate-400 hover:text-slate-200"}`}>
            {k.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
        placeholder="Paste any suspicious link, SMS, WhatsApp message, email, QR text or call transcript…"
        maxLength={8000}
        rows={4}
        className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-void-950/70 p-3 font-mono text-[12.5px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={() => run()} disabled={busy || !text.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-void-950 shadow-[0_0_24px_-6px_#22d3ee] transition hover:brightness-110 disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Scan now
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-ghost"><ImageUp size={14} />QR image</button>
        <button onClick={() => setCamera(true)} className="btn-ghost"><Camera size={14} />Live camera</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <span>Try:</span>
        {SAMPLES.map((s) => (
          <button key={s.label} onClick={() => { setText(s.text); setKind(s.kind); run(s.text, s.kind); }}
            className="rounded border border-white/10 px-1.5 py-0.5 text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
            {s.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">{err}</p>}

      {res && (
        <div className="mt-4 animate-slidein rounded-xl border p-4" style={{ borderColor: `${vColor}55`, background: `${vColor}0d` }}>
          <div className="flex items-start gap-3">
            <Verdict size={34} style={{ color: vColor }} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold uppercase tracking-wide" style={{ color: vColor }}>{res.verdict}</span>
                {res.verdict !== "safe" && <SevBadge severity={res.severity} />}
                <Tag tone={res.action === "neutralized" ? "mint" : res.action === "flagged" ? "amber" : "slate"}>{res.action}</Tag>
                <span className="text-xs text-slate-400">{res.category_label}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{res.explanation}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-bold tabular-nums" style={{ color: vColor }}>{res.risk_score}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">risk / 100</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${res.risk_score}%`, background: vColor }} />
          </div>
          {res.indicators.length > 0 && (
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {res.indicators.map((i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: vColor }} />{i}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-500">
            <span>engine: {res.engine}</span><span>confidence: {Math.round(res.confidence * 100)}%</span><span>{res.elapsed_ms} ms</span>
          </div>
        </div>
      )}

      {camera && <CameraScanner onClose={() => setCamera(false)} onResult={(p) => { setCamera(false); onQrDecoded(p); }} />}
    </Panel>
  );
}

function CameraScanner({ onClose, onResult }: { onClose: () => void; onResult: (p: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stopped) return;
          if (v.readyState >= 2) {
            const payload = decodeImage(v, v.videoWidth, v.videoHeight);
            if (payload) {
              onResult(payload);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Camera unavailable. Allow camera access, or upload a QR image instead (camera needs HTTPS or localhost).");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="panel w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-100">Point the camera at a QR code</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : (
          <div className="relative overflow-hidden rounded-lg">
            <video ref={videoRef} playsInline muted className="w-full" />
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-cyan-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" />
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">The QR is decoded on your device and checked before you pay or open anything.</p>
      </div>
    </div>
  );
}

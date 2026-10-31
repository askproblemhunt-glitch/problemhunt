"use client";

import { ImageDown, Loader2 } from "lucide-react";
import { useState } from "react";

export type CardSpec = { badge: string; title: string; lines: string[]; color: string; footer?: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/); const out: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > max && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

/** Draws a 1080×1350 warning card (WhatsApp / Instagram status friendly). */
export async function makeCard(c: CardSpec): Promise<Blob> {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0b1120"); g.addColorStop(1, "#02040a");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = c.color; x.globalAlpha = 0.14; x.beginPath(); x.arc(W - 120, 160, 360, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  x.fillStyle = c.color; x.fillRect(0, 0, W, 18);
  const font = (w: number, s: number) => `${w} ${s}px "Noto Sans", "Nirmala UI", "Segoe UI", system-ui, sans-serif`;
  // badge
  x.font = font(800, 40); const bw = x.measureText(c.badge).width + 60;
  x.fillStyle = c.color; x.beginPath(); x.roundRect(70, 110, bw, 76, 38); x.fill();
  x.fillStyle = "#02040a"; x.fillText(c.badge, 100, 162);
  // title
  x.fillStyle = "#ffffff"; x.font = font(900, 76);
  let y = 300;
  for (const l of wrap(x, c.title, W - 140).slice(0, 4)) { x.fillText(l, 70, y); y += 92; }
  y += 20;
  x.font = font(500, 42); x.fillStyle = "#cbd5e1";
  for (const para of c.lines) {
    if (y > H - 260) break;
    x.fillStyle = c.color; x.beginPath(); x.arc(86, y - 14, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#cbd5e1";
    for (const l of wrap(x, para, W - 180).slice(0, 4)) {
      if (y > H - 260) break;
      x.fillText(l, 110, y); y += 58;
    }
    y += 22;
  }
  // footer
  x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(0, H - 190, W, 190);
  x.fillStyle = "#22d3ee"; x.font = font(900, 54); x.fillText("ProblemHunt", 70, H - 105);
  x.fillStyle = "#94a3b8"; x.font = font(500, 34); x.fillText(c.footer || "Check before you click, pay or reply · Helpline 1930", 70, H - 55);
  return await new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}

export async function shareCard(c: CardSpec, text?: string): Promise<"shared" | "downloaded"> {
  const blob = await makeCard(c);
  const file = new File([blob], "problemhunt-alert.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: text || c.title }); return "shared"; } catch { /* user cancelled */ }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "problemhunt-alert.png"; a.click();
  return "downloaded";
}

export default function ShareImageButton({ spec, label, text, className = "" }: { spec: CardSpec; label: string; text?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); try { await shareCard(spec, text); } finally { setBusy(false); } }}
      className={"inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 " + className}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />}{label}
    </button>
  );
}

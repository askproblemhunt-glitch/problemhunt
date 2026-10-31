"use client";

import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { W } from "@/lib/v5";

const inp = "w-40 rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-white outline-none";

/** 2-step verification with any authenticator app (Google Authenticator, Microsoft Authenticator, Authy…). */
export default function MfaSetup() {
  const [on, setOn] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { W.mfa().then((r) => setOn(r.enabled)).catch(() => {}); }, []);
  if (on === null) return null;
  return (
    <div id="security" className="panel space-y-2 p-5">
      <h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck size={18} className={on ? "text-emerald-300" : "text-amber-300"} />2-step verification {on ? <span className="text-sm text-emerald-300">ON</span> : <span className="text-sm text-amber-300">OFF</span>}</h2>
      <p className="text-sm text-slate-400">Adds a 6-digit code from an authenticator app to every login. Required for organisation admins.</p>
      {!on && !setup && <button className="rounded-lg bg-cyan-400 px-4 py-2 font-bold text-black" onClick={async () => {
        setMsg(""); try { const r = await W.mfaSetup(); setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.otpauth, { margin: 1, width: 200 }) }); } catch (e) { setMsg((e as Error).message); } }}>Turn on</button>}
      {setup && !on && <div className="flex flex-wrap items-start gap-4">
        <img src={setup.qr} alt="Scan with your authenticator app" className="rounded-lg bg-white p-1" width={160} height={160} />
        <div className="space-y-2 text-sm text-slate-300">
          <p>1. Scan this QR in your authenticator app (or type the key: <span className="break-all font-mono text-white">{setup.secret}</span>).</p>
          <p>2. Enter the 6-digit code it shows:</p>
          <div className="flex gap-2"><input className={inp} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className="rounded-lg bg-emerald-400 px-4 font-bold text-black" onClick={async () => { setMsg(""); try { await W.mfaEnable(code); setOn(true); setSetup(null); setCode(""); setMsg("2-step verification is on ✓"); } catch (e) { setMsg((e as Error).message); } }}>Verify</button></div>
        </div></div>}
      {on && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">To turn off, enter a current code:</span>
        <input className={inp} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <button className="text-rose-300 underline" onClick={async () => { setMsg(""); try { await W.mfaDisable(code); setOn(false); setCode(""); } catch (e) { setMsg((e as Error).message); } }}>Turn off</button></div>}
      {msg && <p className="text-sm text-slate-200">{msg}</p>}
    </div>
  );
}

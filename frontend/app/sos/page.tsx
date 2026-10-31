"use client";

import { CheckCircle2, MapPin, MessageCircle, Phone, ShieldAlert, Siren } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Contacts from "@/components/site/Contacts";
import { timeAgo } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { P, type Contact } from "@/lib/product";
import { useSession } from "@/lib/session";

type Kind = "safety" | "scam" | "medical";
type SosResult = Awaited<ReturnType<typeof P.sos>>;

function getLocation(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    if (!("geolocation" in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  });
}

export default function SosPage() {
  const { t } = useI18n();
  const { user, ready } = useSession();
  const [kind, setKind] = useState<Kind>("safety");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SosResult | null>(null);
  const [err, setErr] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hist, setHist] = useState<Awaited<ReturnType<typeof P.sosFamily>>>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nums, setNums] = useState({ e: "112", c: "1930" });

  useEffect(() => { P.config().then((c) => setNums({ e: c.emergency_number || "112", c: c.cyber_helpline || "1930" })).catch(() => {}); }, []);
  useEffect(() => { if (user) P.sosFamily().then(setHist).catch(() => {}); }, [user, res]);

  const fire = async () => {
    setBusy(true); setErr("");
    try { if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } catch {}
    const pos = await getLocation();
    try {
      const r = await P.sos({ kind, message: msg, lat: pos?.coords.latitude, lon: pos?.coords.longitude, accuracy: pos?.coords.accuracy });
      setRes(r);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); setProgress(0); }
  };
  const start = () => {
    if (busy || !user) return;
    let p = 0;
    timer.current = setInterval(() => { p += 5; setProgress(p); if (p >= 100) { stop(); fire(); } }, 100);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setProgress((p) => (p >= 100 ? p : 0)); };

  const KINDS: [Kind, string][] = [["safety", t("sos_kind_safety")], ["scam", t("sos_kind_scam")], ["medical", t("sos_kind_medical")]];

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-white"><Siren className="text-rose-500" />{t("sos_title")}</h1>
        <p className="mt-1 text-slate-300">{t("sos_sub")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a href={`tel:${nums.e}`} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 py-4 text-lg font-extrabold text-white"><Phone />{t("call_emergency")} {nums.e}</a>
        <a href={`tel:${nums.c}`} className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-lg font-extrabold text-black"><Phone />{t("call_cyber")} {nums.c}</a>
      </div>

      {!ready ? null : !user ? (
        <div className="panel p-5 text-center">
          <p className="text-slate-200">{t("sos_login")}</p>
          <Link href="/account/?next=/sos/" className="mt-3 inline-block rounded-lg bg-rose-500 px-5 py-2 font-bold text-white">{t("nav_login")}</Link>
        </div>
      ) : (
        <>
          <div className="panel space-y-4 p-5">
            <div className="flex flex-wrap justify-center gap-2">
              {KINDS.map(([k, l]) => (
                <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${kind === k ? "bg-rose-500 text-white" : "bg-white/5 text-slate-300"}`}>{l}</button>
              ))}
            </div>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} placeholder="…"
              className="w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-white outline-none" />
            <div className="flex justify-center">
              <button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()} disabled={busy}
                className="relative grid h-48 w-48 select-none place-items-center rounded-full bg-rose-600 text-white shadow-[0_0_60px_-10px_#f43f5e] transition active:scale-95 disabled:opacity-60"
                style={{ background: `conic-gradient(#fff3 ${progress * 3.6}deg, #e11d48 0deg)` }}>
                <span className="grid h-40 w-40 place-items-center rounded-full bg-rose-600">
                  <span className="text-center"><ShieldAlert size={40} className="mx-auto" /><span className="mt-1 block text-xl font-black">SOS</span>
                    <span className="block text-[11px] opacity-80">{busy ? "…" : t("sos_hold")}</span></span>
                </span>
              </button>
            </div>
            {kind === "scam" && <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-100">{t("sos_scam_steps")}</p>}
            {err && <p className="text-center text-sm text-rose-300">{err}</p>}
          </div>

          {res && (
            <div className="space-y-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-5">
              <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-100"><CheckCircle2 />{t("sos_sent")}</h2>
              <p className="text-sm text-emerald-100/90">{t("sos_notified", { n: res.notified })} · {res.maps ? <a className="underline" href={res.maps} target="_blank" rel="noopener noreferrer"><MapPin size={13} className="inline" /> map</a> : t("location_off")}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(res.share_text)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 font-bold text-black"><MessageCircle size={16} />{t("share_location")}</a>
                {res.contact_phones.map((p) => <a key={p} href={`tel:${p}`} className="btn-ghost"><Phone size={14} />{p}</a>)}
                <a href={`sms:${res.contact_phones.join(",")}?body=${encodeURIComponent(res.share_text)}`} className="btn-ghost">SMS</a>
              </div>
            </div>
          )}

          <div className="panel p-5">
            <h2 className="mb-1 font-semibold text-white">{t("contacts")}</h2>
            <p className="mb-3 text-[13px] text-slate-400">{t("family_sub")}</p>
            <Contacts onChange={setContacts} />
            {contacts.length === 0 && <p className="mt-2 text-[12px] text-amber-200">⚠ {t("add_contact")}</p>}
          </div>

          {hist.length > 0 && (
            <div className="panel p-5">
              <h2 className="mb-2 font-semibold text-white">{t("sos_history")}</h2>
              <ul className="space-y-1.5 text-sm">
                {hist.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="font-semibold text-rose-200">{h.name || "—"}</span><span className="text-slate-400">{h.kind}</span>
                    {h.message && <span className="text-slate-300">“{h.message}”</span>}
                    {h.maps && <a href={h.maps} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline"><MapPin size={12} className="inline" />map</a>}
                    {h.phone && <a href={`tel:${h.phone}`} className="text-emerald-300"><Phone size={12} className="inline" />{h.phone}</a>}
                    <span className="ml-auto text-[11px] text-slate-500">{timeAgo(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

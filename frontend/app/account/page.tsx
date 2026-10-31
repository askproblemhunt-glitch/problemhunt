"use client";

import { Bell, Crown, KeyRound, LogOut, Phone, Receipt, Siren, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Contacts from "@/components/site/Contacts";
import MfaSetup from "@/components/site/MfaSetup";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { P, type Order } from "@/lib/product";
import { enableAlerts } from "@/lib/pwa";
import { useSession, type User } from "@/lib/session";

const inp = "w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400/50";

function AuthForm() {
  const { t, lang } = useI18n();
  const { login, signup, setUser, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [mode, setMode] = useState<"code" | "login" | "signup">("code");
  const [f, setF] = useState({ email: "", password: "", name: "", ident: "", code: "" });
  const [step, setStep] = useState<"ask" | "verify">("ask");
  const [info, setInfo] = useState<{ target?: string; dev?: string; note?: string }>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfa, setMfa] = useState("");

  const done = () => { if (next) router.push(next); };
  const run = async (fn: () => Promise<void>) => {
    setErr(""); setBusy(true);
    try { await fn(); } catch (e) {
      const m = (e as Error).message;
      if (m.includes("MFA_REQUIRED")) { setMfaNeeded(true); setErr(mfa ? m.replace(/^.*MFA_REQUIRED:\s*/, "") : ""); }
      else setErr(m);
    } finally { setBusy(false); }
  };
  const sendCode = () => run(async () => {
    const r = await P.otpRequest(f.ident, lang);
    setInfo({ target: r.target, dev: r.dev_code, note: r.note }); setStep("verify");
  });
  const verify = () => run(async () => {
    const r = await P.otpVerify(f.ident, f.code, f.name, lang, mfa);
    try { localStorage.setItem("ph_session", r.token); } catch {}
    setUser(r.user as User); await refresh(); done();
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="panel space-y-4 p-6">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 text-sm">
          {([["code", t("login_code")], ["login", t("login")], ["signup", t("signup")]] as const).map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} className={`rounded-lg px-2 py-2 font-semibold ${mode === m ? "bg-white text-black" : "text-slate-300"}`}>{l}</button>
          ))}
        </div>

        {mode === "code" ? (
          step === "ask" ? (
            <>
              <p className="flex items-center gap-2 text-sm text-slate-300"><Smartphone size={16} className="text-cyan-300" />{t("identifier")}</p>
              <input className={inp} placeholder="98765 43210  /  you@email.com" value={f.ident} autoComplete="username"
                onChange={(e) => setF({ ...f, ident: e.target.value })} onKeyDown={(e) => e.key === "Enter" && sendCode()} />
              <button onClick={sendCode} disabled={busy || f.ident.trim().length < 5} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 font-bold text-black disabled:opacity-50">{t("send_code")}</button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">{t("code_sent", { t: info.target || f.ident })}</p>
              {info.dev && <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100"><b>{t("dev_code", { c: info.dev })}</b><br /><span className="text-[12px]">{info.note}</span></div>}
              <input className={inp + " text-center font-mono text-2xl tracking-[0.5em]"} inputMode="numeric" maxLength={6} placeholder="••••••" autoComplete="one-time-code"
                value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} onKeyDown={(e) => e.key === "Enter" && verify()} />
              <input className={inp} placeholder={`${t("name")} (${t("signup").toLowerCase()})`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <button onClick={verify} disabled={busy || f.code.length < 6} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 font-bold text-black disabled:opacity-50">{t("verify")}</button>
              <div className="flex justify-between text-sm"><button className="text-slate-400" onClick={() => { setStep("ask"); setF({ ...f, code: "" }); }}>← {t("back")}</button>
                <button className="text-cyan-300" onClick={sendCode} disabled={busy}>{t("resend")}</button></div>
            </>
          )
        ) : (
          <>
            {mode === "signup" && <input placeholder={t("name")} className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
            <input placeholder={t("email")} type="email" autoComplete="email" className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input placeholder={`${t("password")} (8+)`} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inp}
              value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && run(async () => { if (mode === "login") await login(f.email, f.password, mfa); else await signup(f.email, f.password, f.name, lang); done(); })} />
            <button disabled={busy} onClick={() => run(async () => { if (mode === "login") await login(f.email, f.password, mfa); else await signup(f.email, f.password, f.name, lang); done(); })}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 font-bold text-black disabled:opacity-50">{mode === "login" ? t("login") : t("signup")}</button>
          </>
        )}
        {mfaNeeded && (
          <div className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 p-3">
            <p className="text-sm font-semibold text-cyan-100">2-step verification</p>
            <p className="text-[12.5px] text-slate-300">Enter the 6-digit code from your authenticator app, then press the button above again.</p>
            <input className={inp + " mt-2 text-center font-mono text-xl tracking-[0.4em]"} inputMode="numeric" maxLength={6} autoComplete="one-time-code"
              value={mfa} onChange={(e) => setMfa(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
          </div>
        )}
        {err && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-200">{err}</p>}
        <p className="text-center text-[11.5px] text-slate-500">🔒 {t("pw_sub").split(":")[0]} · <Link href="/privacy/" className="underline">{t("privacy")}</Link></p>
      </div>
    </div>
  );
}

function PhoneLink() {
  const { t, lang } = useI18n();
  const { refresh } = useSession();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <input className={inp} placeholder="+91 98765 43210" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-ghost whitespace-nowrap" onClick={async () => { setMsg(""); try { const r = await P.otpRequest(phone, lang); setSent(r.dev_code || ""); } catch (e) { setMsg((e as Error).message); } }}>{t("send_code")}</button>
      </div>
      {sent !== null && (
        <div className="flex gap-2">
          <input className={inp + " font-mono"} placeholder="••••••" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="rounded-lg bg-cyan-400 px-4 font-bold text-black" onClick={async () => { try { await P.linkPhone(phone, code); setMsg("✓"); refresh(); } catch (e) { setMsg((e as Error).message); } }}>{t("verify")}</button>
        </div>
      )}
      {sent && <p className="text-[12px] text-amber-200">{t("dev_code", { c: sent })}</p>}
      {msg && <p className="text-sm text-slate-300">{msg}</p>}
    </div>
  );
}

function Profile() {
  const { t, lang, setLang } = useI18n();
  const { user, usage, logout, refresh } = useSession();
  const [fam, setFam] = useState<Awaited<ReturnType<typeof P.family>> | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [alerts, setAlerts] = useState("");
  const loadFam = () => P.family().then(setFam).catch(() => {});
  useEffect(() => { loadFam(); P.myOrders().then(setOrders).catch(() => {}); }, []);
  if (!user) return null;

  const turnOnAlerts = async () => {
    const st = await enableAlerts();
    setAlerts(st);
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); if (sub) await P.pushLink(sub.endpoint); } catch {}
  };
  const famAction = async (fn: () => Promise<unknown>) => { setMsg(""); try { await fn(); await refresh(); loadFam(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="panel flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white">{user.name || user.email || user.phone}</h1>
          <p className="text-sm text-slate-400">{[user.email, user.phone].filter(Boolean).join(" · ")}
            {user.role === "admin" && <span className="ml-2 rounded bg-amber-400/20 px-1.5 text-amber-200">admin</span>}</p>
        </div>
        {user.role === "admin" && <Link href="/admin/" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-black">Admin panel</Link>}
        <button onClick={logout} className="btn-ghost"><LogOut size={15} />{t("logout")}</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Crown size={16} className="text-amber-300" />{t("current_plan")}</h2>
          {user.premium ? <p className="mt-2 text-emerald-200">Premium · {t("premium_active")} {new Date(user.premium_until * 1000).toLocaleDateString()}</p> : (
            <><p className="mt-2 text-slate-300">Free · {usage?.limit != null ? `${Math.max(0, usage.limit - usage.used)} ${t("checks_left")}` : ""}</p>
              <Link href="/premium/" className="mt-3 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black">{t("upgrade")}</Link></>
          )}
          <p className="mt-3 text-[12px] text-slate-500">Total checks: {user.scans_total}</p>
        </div>
        <div className="panel space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Bell size={16} className="text-cyan-300" />{t("alerts_on")}</h2>
          <button onClick={turnOnAlerts} className="btn-ghost">{alerts === "push" || alerts === "local" ? t("alerts_enabled") : t("alerts_on")}</button>
          <label className="block text-sm text-slate-300">{t("language")}
            <select className={inp + " mt-1"} value={lang} onChange={(e) => { setLang(e.target.value as Lang); P.updateMe({ lang: e.target.value }).catch(() => {}); }}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select></label>
        </div>
      </div>

      {!user.phone && (
        <div className="panel p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Phone size={16} className="text-cyan-300" />{t("identifier")}</h2>
          <p className="text-[13px] text-slate-400">{t("login_code")}</p>
          <PhoneLink />
        </div>
      )}

      <div className="panel p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Siren size={16} className="text-rose-400" />{t("contacts")}</h2>
          <Link href="/sos/" className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-bold text-white">SOS</Link>
        </div>
        <Contacts />
      </div>

      <MfaSetup />

      <Link href="/org/" className="panel block p-5 transition hover:border-cyan-400/40">
        <h2 className="font-semibold text-white">ProblemHunt Workplace</h2>
        <p className="text-sm text-slate-400">Training, phishing tests and risk scores for your school, office or bank — create or join your organisation.</p>
      </Link>

      <div className="panel p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white"><Users size={16} className="text-violet-300" />{t("family")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("family_sub")}</p>
        {fam?.code ? (
          <div className="mt-3">
            <p className="text-sm text-slate-300">{t("family_code")}: <b className="font-mono text-xl tracking-widest text-white">{fam.code}</b>
              <button className="ml-3 text-[12px] text-cyan-300 underline" onClick={() => navigator.share ? navigator.share({ text: `Join my ProblemHunt family: code ${fam.code}` }).catch(() => {}) : navigator.clipboard.writeText(fam.code)}>share</button></p>
            <p className="mt-2 text-sm text-slate-400">{t("members")}:</p>
            <ul className="mt-1 space-y-1">{fam.members.map((m) => <li key={m.id} className="text-sm text-slate-200">• {m.name} {m.me && "(you)"}</li>)}</ul>
            <button className="mt-3 text-sm text-rose-300 underline" onClick={() => famAction(P.familyLeave)}>Leave family</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => famAction(P.familyCreate)}>{t("family_create")}</button>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("family_code")} className="w-32 rounded-lg border border-white/10 bg-void-950 px-3 py-2 font-mono text-white" />
            <button className="btn-ghost" onClick={() => code.trim().length < 4 ? setMsg(t("err_enter_code")) : famAction(() => P.familyJoin(code.trim()))}>{t("family_join")}</button>
          </div>
        )}
        {msg && <p className="mt-2 text-sm text-amber-200">{msg} {/family|plan/i.test(msg) && <Link href="/premium/" className="underline">{t("upgrade")}</Link>}</p>}
      </div>

      {orders.length > 0 && (
        <div className="panel p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Receipt size={16} className="text-emerald-300" />{t("my_orders")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">{orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="font-mono text-white">{o.order_code}</span><span className="text-slate-400">{o.plan_id} · ₹{o.amount}</span>
              <span className={`ml-auto rounded px-2 py-0.5 text-[11px] font-bold ${o.status === "approved" ? "bg-emerald-400/20 text-emerald-200" : o.status === "rejected" ? "bg-rose-500/20 text-rose-200" : "bg-amber-400/20 text-amber-200"}`}>{t(o.status)}</span>
            </li>))}</ul>
        </div>
      )}
      <p className="text-center text-[12px] text-slate-500"><KeyRound size={12} className="inline" /> <Link href="/tools/" className="underline">{t("nav_tools")}</Link> · <Link href="/trust/" className="underline">{t("trust")}</Link></p>
    </div>
  );
}

function AccountInner() {
  const { user, ready } = useSession();
  if (!ready) return <div className="p-10 text-center text-slate-500">…</div>;
  return user ? <Profile /> : <AuthForm />;
}

export default function AccountPage() {
  return <Suspense fallback={null}><AccountInner /></Suspense>;
}

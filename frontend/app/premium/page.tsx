"use client";

import { Check, Crown, Gift, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { P, loadScript, type Order, type Plan, type PublicConfig } from "@/lib/product";
import { useSession } from "@/lib/session";

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } } }

function PremiumInner() {
  const { t, lang } = useI18n();
  const { user, refresh } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [cur, setCur] = useState<"INR" | "USD">("INR");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    P.plans().then(setPlans).catch(() => {});
    P.config().then(setCfg).catch(() => {});
    try { if (!Intl.DateTimeFormat().resolvedOptions().timeZone.startsWith("Asia/Calcutta") && !Intl.DateTimeFormat().resolvedOptions().timeZone.startsWith("Asia/Kolkata") && lang === "en") setCur("USD"); } catch {}
  }, [lang]);

  useEffect(() => {
    const sid = sp.get("session_id");
    if (sid && user) {
      P.stripeConfirm(sid).then((r) => { setMsg({ ok: r.ok, text: r.ok ? "🎉 Premium activated. Thank you!" : "Payment not completed yet." }); refresh(); })
        .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
    }
    if (sp.get("cancelled")) setMsg({ ok: false, text: "Payment cancelled." });
  }, [sp, user, refresh]);

  const needLogin = () => { router.push("/account/?next=/premium/"); };
  const [code, setCode] = useState("");
  const [manual, setManual] = useState<{ order: Order; upi_id: string; instructions: string; upi_link: string; qr: string } | null>(null);
  const [utr, setUtr] = useState("");

  const redeem = async () => {
    if (!user) return needLogin();
    setMsg(null);
    try { const r = await P.redeem(code); setMsg({ ok: true, text: t("redeem_ok", { d: r.days }) }); setCode(""); refresh(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const payManual = async (p: Plan) => {
    if (!user) return needLogin();
    setMsg(null);
    try {
      const r = await P.order(p.id, "upi");
      const qr = r.upi_link ? await QRCode.toDataURL(r.upi_link, { margin: 1, width: 220 }) : "";
      setManual({ ...r, qr });
      setTimeout(() => document.getElementById("manual-pay")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const payRazorpay = async (p: Plan) => {
    if (!user) return needLogin();
    setBusy(p.id); setMsg(null);
    try {
      const o = await P.rzpOrder(p.id);
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      const rz = new window.Razorpay!({
        key: o.key_id, amount: o.amount, currency: o.currency, name: o.name, description: o.description, order_id: o.order_id,
        prefill: { email: o.email }, theme: { color: "#22d3ee" },
        handler: async (r: Record<string, string>) => {
          try { await P.rzpVerify(r); setMsg({ ok: true, text: "🎉 Premium activated. Thank you!" }); refresh(); }
          catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
        },
        modal: { ondismiss: () => setBusy("") },
      });
      rz.open();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(""); }
  };

  const payStripe = async (p: Plan) => {
    if (!user) return needLogin();
    setBusy(p.id + "s"); setMsg(null);
    try { const r = await P.stripeCheckout(p.id); window.location.href = r.url; }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); setBusy(""); }
  };

  const price = (p: Plan) => cur === "INR" ? `₹${p.price_inr.toLocaleString("en-IN")}` : `$${p.price_usd.toFixed(2)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-white sm:text-4xl"><Crown className="text-amber-300" />{t("premium_title")}</h1>
        <p className="mt-2 text-slate-300">{t("premium_sub")}</p>
        <div className="mt-4 inline-flex rounded-full bg-white/5 p-1">
          {(["INR", "USD"] as const).map((c) => (
            <button key={c} onClick={() => setCur(c)} className={`rounded-full px-4 py-1 text-sm ${cur === c ? "bg-white text-black" : "text-slate-300"}`}>{c === "INR" ? "₹ INR" : "$ USD"}</button>
          ))}
        </div>
      </div>
      {user?.premium && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-center text-amber-100">
          {t("premium_active")} <b>{new Date(user.premium_until * 1000).toLocaleDateString()}</b>
        </div>
      )}
      {msg && <div className={`rounded-xl p-4 text-center ${msg.ok ? "bg-emerald-400/15 text-emerald-100" : "bg-rose-500/15 text-rose-100"}`}>{msg.text}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const free = p.price_inr <= 0 && p.price_usd <= 0;
          return (
            <div key={p.id} className={`panel relative flex flex-col p-6 ${p.highlight ? "ring-2 ring-amber-400/70" : ""}`}>
              {p.highlight ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-black">Most popular</span> : null}
              <h2 className="text-xl font-bold text-white">{p.name}</h2>
              <div className="mt-2 text-4xl font-black text-white">{free ? "₹0" : price(p)}
                {!free && <span className="ml-1 text-sm font-normal text-slate-400">{t("per")} {p.days} {t("days")}</span>}</div>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-[14px] text-slate-200"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />{f}</li>)}
              </ul>
              {!free && (
                <div className="mt-5 space-y-2">
                  {cfg?.payments.razorpay && cur === "INR" && p.price_inr > 0 && (
                    <button onClick={() => payRazorpay(p)} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 font-bold text-black disabled:opacity-50">
                      {busy === p.id && <Loader2 size={16} className="animate-spin" />}{user ? t("buy_upi") : t("login_to_buy")}
                    </button>
                  )}
                  {cfg?.payments.stripe && cur === "USD" && p.price_usd > 0 && (
                    <button onClick={() => payStripe(p)} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-bold text-white ring-1 ring-white/20 disabled:opacity-50">
                      {busy === p.id + "s" && <Loader2 size={16} className="animate-spin" />}{user ? t("buy_card") : t("login_to_buy")}
                    </button>
                  )}
                  {cfg?.manual_payment && cur === "INR" && p.price_inr > 0 && (
                    <button onClick={() => payManual(p)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/15">
                      <QrCode size={15} />{t("pay_manual")}</button>
                  )}
                  {cfg && !(cur === "INR" ? cfg.payments.razorpay || cfg.manual_payment : cfg.payments.stripe) && <p className="text-center text-sm text-slate-500">{cur === "INR" ? "₹ payments coming soon — try $ USD." : "$ payments coming soon — try ₹ INR."}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {manual && (
        <div id="manual-pay" className="panel mx-auto max-w-xl space-y-3 p-5 text-center">
          <h2 className="text-lg font-bold text-white">{t("order_created", { c: manual.order.order_code })}</h2>
          <p className="text-sm text-slate-300">₹{manual.order.amount} · {t("pay_to")}: <b className="font-mono text-white">{manual.upi_id}</b></p>
          {manual.qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={manual.qr} alt="UPI QR" className="mx-auto rounded-lg bg-white p-2" />
          )}
          {manual.upi_link && <a href={manual.upi_link} className="inline-block rounded-lg bg-emerald-400 px-4 py-2 font-bold text-black md:hidden">Open UPI app</a>}
          <p className="text-[13px] text-slate-400">{manual.instructions}</p>
          <div className="flex gap-2">
            <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder={t("utr")} className="w-full rounded-lg border border-white/10 bg-void-950 px-3 py-2 text-white" />
            <button className="rounded-lg bg-cyan-400 px-4 font-bold text-black disabled:opacity-40" disabled={utr.length < 4}
              onClick={async () => { try { await P.orderRef(manual.order.id, utr); setMsg({ ok: true, text: `${manual.order.order_code}: ${t("pending")}` }); setManual(null); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } }}>{t("submit_ref")}</button>
          </div>
        </div>
      )}
      <div className="panel mx-auto flex max-w-xl flex-wrap items-center gap-2 p-4">
        <Gift size={18} className="text-amber-300" /><span className="font-semibold text-white">{t("redeem_title")}</span>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PH-XXXX-XXXX" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-950 px-3 py-2 font-mono text-white" />
        <button onClick={redeem} disabled={code.length < 4} className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-40">{t("redeem_btn")}</button>
      </div>
      <p className="text-center text-[12px] text-slate-500">Secure payments by Razorpay (UPI, cards, wallets) and Stripe. Premium is a one-time pass — no automatic renewal.
        {" "}<Link href="/account/" className="underline">{t("nav_account")}</Link></p>
    </div>
  );
}

export default function PremiumPage() {
  return <Suspense fallback={null}><PremiumInner /></Suspense>;
}

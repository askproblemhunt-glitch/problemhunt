"use client";

import { Database, Eye, Lock, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatsStrip } from "@/components/site/HomeSections";
import { P, type PublicConfig } from "@/lib/product";

export default function TrustPage() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  useEffect(() => { P.config().then(setCfg).catch(() => {}); }, []);
  const items = [
    { icon: Eye, title: "We never open suspicious links", text: "Links are analysed as text. Our servers never visit attacker websites, and dangerous links are shown 'defanged' (hxxps://evil[.]com) so nobody clicks them by accident." },
    { icon: Lock, title: "Your passwords stay on your device", text: "The password-leak check uses k-anonymity: only the first 5 characters of a one-way hash leave your phone. Passwords are never sent to us." },
    { icon: Database, title: "Many independent data sources", text: `Every check combines our AI engine, community reports and public threat feeds${cfg?.feeds?.length ? ` (${cfg.feeds.join(", ")})` : ""}${cfg?.providers?.length ? `, plus ${cfg.providers.join(", ")}` : ""}.` },
    { icon: Users, title: "Moderated community", text: "Scam reports are reviewed by moderators before they are published, so honest numbers and businesses are not wrongly accused." },
    { icon: ShieldCheck, title: "Secure by design", text: "Encrypted passwords (scrypt), one-time login codes that expire in 10 minutes, rate limits, strict browser security headers, and payment details handled only by Razorpay / Stripe — never stored by us." },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-extrabold text-white">Why you can trust ProblemHunt</h1>
      <StatsStrip />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="panel p-4"><h2 className="flex items-center gap-2 font-semibold text-white"><Icon size={17} className="text-emerald-300" />{title}</h2><p className="mt-1 text-sm text-slate-300">{text}</p></div>
        ))}
      </div>
      <p className="text-sm text-slate-400">ProblemHunt gives safety guidance; it is not a bank, police or legal service. In an emergency call 112; for cyber fraud call 1930 or visit cybercrime.gov.in.
        {" "}<Link href="/privacy/" className="underline">Privacy</Link> · <Link href="/terms/" className="underline">Terms</Link></p>
    </div>
  );
}

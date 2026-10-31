"use client";

import { Bot, BookOpen, Building2, Crown, Radar, ShieldCheck, ShieldHalf, Siren, Target, UserRound, Wrench, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LANGS, LangProvider, useI18n, type Lang } from "@/lib/i18n";
import { registerServiceWorker } from "@/lib/pwa";
import { SessionProvider, useSession } from "@/lib/session";

const NAV = [
  { href: "/", key: "nav_home", icon: ShieldCheck },
  { href: "/play/", key: "nav_play", icon: Target },
  { href: "/intel/", key: "nav_intel", icon: Radar },
  { href: "/ai/", key: "nav_ai", icon: Bot },
  { href: "/courses/", key: "nav_courses", icon: BookOpen },
  { href: "/org/", key: "nav_org", icon: Building2 },
  { href: "/premium/", key: "nav_premium", icon: Crown },
];
const BOTTOM = [
  { href: "/", key: "nav_home", icon: ShieldCheck },
  { href: "/play/", key: "nav_play", icon: Target },
  { href: "/sos/", key: "nav_sos", icon: Siren },
  { href: "/guide/", key: "nav_guide", icon: Zap },
  { href: "/account/", key: "nav_account", icon: UserRound },
];

function Header() {
  const { t, lang, setLang } = useI18n();
  const { user } = useSession();
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path?.startsWith(h.replace(/\/$/, "")));
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-void-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-void-950">
            <ShieldHalf size={20} strokeWidth={2.4} />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white">Problem<span className="text-cyan-300">Hunt</span></span>
        </Link>
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`rounded-lg px-2.5 py-2 text-sm font-medium transition ${active(n.href) ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
              {t(n.key)}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link href="/admin/" className={`rounded-lg px-3 py-2 text-sm font-medium ${active("/admin/") ? "bg-amber-400/15 text-amber-200" : "text-amber-300/80 hover:text-amber-200"}`}>
              <Wrench size={14} className="mr-1 inline" />{t("nav_admin")}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/sos/" className="hidden items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-black text-white shadow-[0_0_20px_-6px_#f43f5e] sm:inline-flex">
            <Siren size={15} />SOS</Link>
          <select aria-label={t("language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded-lg border border-white/10 bg-void-900 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400/50">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Link href="/account/" className="btn-ghost !py-1.5">
            <UserRound size={15} />
            <span className="hidden sm:inline">{user ? (user.name || user.email.split("@")[0]) : t("nav_login")}</span>
            {user?.premium && <Crown size={13} className="text-amber-300" />}
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-void-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {BOTTOM.map(({ href, key, icon: Icon }) => {
          const on = href === "/" ? path === "/" : path?.startsWith(href.replace(/\/$/, ""));
          if (href === "/sos/") return (
            <Link key={href} href={href} className="flex flex-col items-center py-1">
              <span className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-[0_0_24px_-4px_#f43f5e] ring-4 ring-void-950"><Icon size={24} /></span>
              <span className="text-[10.5px] font-bold text-rose-300">SOS</span>
            </Link>
          );
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${on ? "text-cyan-300" : "text-slate-400"}`}>
              <Icon size={19} />{t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-24 pt-10 text-center text-[12px] text-slate-500 md:pb-10">
      <div className="mb-2 flex flex-wrap justify-center gap-4 text-slate-400">
        <Link href="/play/">{t("nav_play")}</Link><Link href="/intel/">{t("nav_intel")}</Link><Link href="/ai/">{t("nav_ai")}</Link><Link href="/courses/">{t("nav_courses")}</Link><Link href="/org/">{t("nav_org")}</Link><Link href="/coach/">{t("coach_title")}</Link><Link href="/score/">{t("score_title")}</Link><Link href="/guide/">{t("nav_guide")}</Link><Link href="/learn/">{t("nav_learn")}</Link><Link href="/report/">{t("nav_report")}</Link>
        <Link href="/awareness/">{t("nav_programs")}</Link><Link href="/tools/">{t("nav_tools")}</Link><Link href="/sos/">SOS</Link>
        <Link href="/premium/">{t("nav_premium")}</Link><Link href="/threats/">{t("nav_live")}</Link>
        <Link href="/trust/">{t("trust")}</Link><Link href="/privacy/">{t("privacy")}</Link><Link href="/terms/">{t("terms")}</Link>
        <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a>
        <a href="tel:1930">Helpline 1930</a>
      </div>
      <p>{t("footer_note")}</p>
      <p className="mt-1">© {new Date().getFullYear()} ProblemHunt.com</p>
    </footer>
  );
}

function Shell({ children }: { children: ReactNode }) {
  useEffect(() => { registerServiceWorker(); }, []);
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}

export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <SessionProvider>
        <Shell>{children}</Shell>
      </SessionProvider>
    </LangProvider>
  );
}

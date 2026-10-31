"use client";

import { BarChart3, Building2, CalendarDays, Database, FileVideo, Flag, Gem, Handshake, Megaphone, Receipt, Settings, Siren, Target, Ticket, UserCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Crud, { type Field } from "@/components/admin/Crud";
import { Overview, PaymentsPanel, ProvidersPanel, Reports, SettingsPanel, UsersPanel } from "@/components/admin/Panels";
import { ApprovalsPanel, CodesPanel, OrdersPanel, OrgsPanel, RegistrationsPanel, SosPanel } from "@/components/admin/Panels3";
import { useSession } from "@/lib/session";

const LANG_OPTS: [string, string][] = [["all", "All languages"], ["en", "English"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["mr", "Marathi"], ["kn", "Kannada"], ["ml", "Malayalam"], ["gu", "Gujarati"], ["pa", "Punjabi"], ["or", "Odia"], ["ur", "Urdu"]];
const PLACEMENTS: [string, string][] = [["home_top", "Home — top banner"], ["home_inline", "Home — middle"], ["result", "Below check result"], ["learn", "Scam Academy"], ["report", "Report page"]];

const CONTENT_FIELDS: Field[] = [
  { key: "title", label: "Title", required: true, wide: true },
  { key: "kind", label: "Type", type: "select", options: [["article", "Article"], ["video", "Video"], ["tip", "Quick tip"], ["alert", "Scam alert"]] },
  { key: "lang", label: "Language", type: "select", options: LANG_OPTS.slice(1) },
  { key: "category", label: "Category", type: "select", options: [["general", "General"], ["upi", "UPI / payments"], ["otp", "OTP / bank"], ["jobs", "Job scams"], ["impersonation", "Fake police / officials"], ["investment", "Investment / crypto"], ["shopping", "Shopping"], ["help", "Help after scam"]] },
  { key: "summary", label: "Short summary", wide: true },
  { key: "video_url", label: "Video (YouTube / Vimeo link or uploaded mp4)", type: "image", help: "Paste a YouTube link, or upload an mp4" },
  { key: "image_url", label: "Cover image", type: "image" },
  { key: "body", label: "Full text", type: "textarea" },
  { key: "published", label: "Published", type: "bool" }, { key: "pinned", label: "Pin to top", type: "bool" },
  { key: "premium_only", label: "Premium members only", type: "bool" },
];
const AD_FIELDS: Field[] = [
  { key: "name", label: "Internal name", required: true }, { key: "advertiser", label: "Advertiser / sponsor" },
  { key: "kind", label: "Ad type", type: "select", options: [["banner", "Image banner"], ["text", "Text ad"], ["video", "Video ad"], ["adsense", "Google AdSense unit"]] },
  { key: "placement", label: "Where to show", type: "select", options: PLACEMENTS },
  { key: "title", label: "Headline" }, { key: "cta", label: "Button text" },
  { key: "body", label: "Description (for AdSense: slot ID)", wide: true },
  { key: "image_url", label: "Banner image", type: "image" }, { key: "video_url", label: "Video (YouTube link or mp4)", type: "image" },
  { key: "target_url", label: "Click goes to (https://…)", wide: true },
  { key: "lang", label: "Language", type: "select", options: LANG_OPTS },
  { key: "weight", label: "Weight (higher = shown more)", type: "number" },
  { key: "start_at", label: "Start", type: "datetime" }, { key: "end_at", label: "End", type: "datetime" },
  { key: "price_note", label: "Deal note (private, e.g. ₹5,000/month)", wide: true },
  { key: "active", label: "Active", type: "bool" },
];
const AFF_FIELDS: Field[] = [
  { key: "name", label: "Product name", required: true }, { key: "badge", label: "Badge (e.g. 30% off)" },
  { key: "category", label: "Category", type: "select", options: [["password_manager", "Password manager"], ["antivirus", "Antivirus / mobile security"], ["vpn", "VPN"], ["identity", "Identity / credit protection"], ["call_blocker", "Call / SMS blocker"], ["general", "Other"]] },
  { key: "lang", label: "Language", type: "select", options: LANG_OPTS },
  { key: "description", label: "One-line description", wide: true },
  { key: "url", label: "Your affiliate link (https://…)", wide: true, required: true },
  { key: "logo_url", label: "Logo", type: "image" }, { key: "price_note", label: "Price note" },
  { key: "sort", label: "Order", type: "number" }, { key: "active", label: "Active", type: "bool" },
];
const PLAN_FIELDS: Field[] = [
  { key: "id", label: "Plan ID (letters, no spaces)" }, { key: "name", label: "Plan name", required: true },
  { key: "price_inr", label: "Price ₹ (Razorpay)", type: "number" }, { key: "price_usd", label: "Price $ (Stripe)", type: "number" },
  { key: "days", label: "Duration (days)", type: "number" }, { key: "sort", label: "Order", type: "number" },
  { key: "features", label: "Features (one per line)", type: "list" },
  { key: "highlight", label: "Highlight as most popular", type: "bool" }, { key: "family", label: "Family plan (enables family code)", type: "bool" },
  { key: "active", label: "Active", type: "bool" },
];

const PROGRAM_FIELDS: Field[] = [
  { key: "title", label: "Program title", required: true, wide: true },
  { key: "organizer", label: "Organizer (e.g. District Police, School, NGO)" },
  { key: "category", label: "Type", type: "select", options: [["workshop", "Workshop"], ["school", "School / college drive"], ["seniors", "Senior citizens"], ["government", "Government campaign"], ["corporate", "Office / corporate"], ["webinar", "Online webinar"]] },
  { key: "audience", label: "Audience" },
  { key: "date_at", label: "Date & time", type: "datetime" },
  { key: "location", label: "Venue / city" },
  { key: "online_url", label: "Online link (https://…, optional)", wide: true },
  { key: "lang", label: "Language", type: "select", options: LANG_OPTS },
  { key: "image_url", label: "Poster image", type: "image" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "active", label: "Show on site", type: "bool" },
];

const CHALLENGE_FIELDS: Field[] = [
  { key: "message", label: "Message exactly as the user would receive it", type: "textarea", required: true },
  { key: "answer", label: "Correct answer", type: "select", options: [["scam", "Scam"], ["safe", "Safe"]] },
  { key: "channel", label: "Arrives by", type: "select", options: [["sms", "SMS"], ["whatsapp", "WhatsApp"], ["call", "Phone call"], ["email", "Email"], ["upi", "UPI"]] },
  { key: "lang", label: "Language", type: "select", options: LANG_OPTS },
  { key: "explanation", label: "Why (shown after answering)", wide: true },
  { key: "active", label: "Active", type: "bool" },
];

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "content", label: "Content & videos", icon: FileVideo },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "affiliates", label: "Affiliates", icon: Handshake },
  { id: "plans", label: "Plans", icon: Gem },
  { id: "orders", label: "Orders (UPI)", icon: Receipt },
  { id: "codes", label: "Membership codes", icon: Ticket },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "approvals", label: "Approvals", icon: UserCheck },
  { id: "orgs", label: "Organisations", icon: Building2 },
  { id: "programs", label: "Awareness programs", icon: CalendarDays },
  { id: "challenges", label: "Daily challenge", icon: Target },
  { id: "sos", label: "SOS log", icon: Siren },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "users", label: "Users", icon: Users },
  { id: "providers", label: "Data providers", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AdminPage() {
  const { user, ready } = useSession();
  const [tab, setTab] = useState("overview");
  if (!ready) return <div className="p-10 text-center text-slate-500">…</div>;
  if (user?.role !== "admin") return (
    <div className="mx-auto max-w-md p-10 text-center"><p className="text-slate-300">Admins only.</p>
      <Link href="/account/?next=/admin/" className="mt-3 inline-block text-cyan-300 underline">Log in</Link></div>
  );
  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">Admin panel</div>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
              <Icon size={15} />{label}</button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        {tab === "overview" && <Overview />}
        {tab === "content" && <Crud entity="content" title="Content & videos" intro="Articles, quick tips and videos for the Scam Academy. Write in any of the 12 languages."
          fields={CONTENT_FIELDS} columns={[["title", "Title"], ["kind", "Type"], ["lang", "Lang"], ["views", "Views"], ["published", "Live"], ["pinned", "Pinned"]]}
          defaults={{ kind: "video", lang: "en", category: "general", published: 1, pinned: 0, premium_only: 0 }} />}
        {tab === "ads" && <Crud entity="ads" title="Ads" intro="Sell ad space to sponsors. Views and clicks are counted automatically so you can bill them."
          fields={AD_FIELDS} columns={[["name", "Name"], ["advertiser", "Sponsor"], ["placement", "Placement"], ["impressions", "Views"], ["clicks", "Clicks"], ["active", "Active"]]}
          defaults={{ kind: "banner", placement: "home_top", lang: "all", weight: 1, active: 1, cta: "Learn more" }} />}
        {tab === "affiliates" && <Crud entity="affiliates" title="Affiliate offers" intro="Security products you recommend with your affiliate links. Shown on the home page and after risky checks."
          fields={AFF_FIELDS} columns={[["name", "Product"], ["category", "Category"], ["clicks", "Clicks"], ["active", "Active"]]}
          defaults={{ category: "password_manager", lang: "all", active: 1, sort: 0 }} />}
        {tab === "plans" && <Crud entity="plans" title="Plans & pricing" intro="Prices shown on the Premium page. ₹ uses Razorpay, $ uses Stripe."
          fields={PLAN_FIELDS} columns={[["name", "Plan"], ["price_inr", "₹"], ["price_usd", "$"], ["days", "Days"], ["highlight", "Popular"], ["active", "Active"]]}
          defaults={{ price_inr: 99, price_usd: 2.99, days: 30, features: [], active: 1, sort: 5 }} />}
        {tab === "orders" && <OrdersPanel />}
        {tab === "codes" && <CodesPanel />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "orgs" && <OrgsPanel />}
        {tab === "sos" && <SosPanel />}
        {tab === "challenges" && <Crud entity="challenges" title="Daily challenge — Scam or Safe?" intro="Every day users get 3 messages to judge. 24 built-in examples (English + Hindi) are included; add your own — especially latest frauds and messages in Tamil, Telugu, Bengali, Kannada… Your items get priority for users of that language."
          fields={CHALLENGE_FIELDS} columns={[["message", "Message"], ["answer", "Answer"], ["channel", "Via"], ["lang", "Lang"], ["active", "Active"]]}
          defaults={{ answer: "scam", channel: "sms", lang: "en", active: 1 }} />}
        {tab === "programs" && <div className="space-y-8">
          <Crud entity="programs" title="Awareness programs" intro="Workshops, school drives, senior-citizen sessions and government campaigns. They appear on the Awareness page and home page; people can register."
            fields={PROGRAM_FIELDS} columns={[["title", "Title"], ["organizer", "Organizer"], ["date_at", "Date"], ["registrations", "Registered"], ["active", "Live"]]}
            defaults={{ category: "workshop", lang: "all", audience: "everyone", active: 1 }} />
          <RegistrationsPanel /></div>}
        {tab === "payments" && <PaymentsPanel />}
        {tab === "reports" && <Reports />}
        {tab === "users" && <UsersPanel />}
        {tab === "providers" && <ProvidersPanel />}
        {tab === "settings" && <SettingsPanel />}
      </section>
    </div>
  );
}

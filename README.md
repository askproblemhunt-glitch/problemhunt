# 🛡️ ProblemHunt.com — Autonomous Defense Grid

ProblemHunt is a free, open-source security command center. It runs on its own: an AI agent watches incoming
signals, catches scams (phishing links, fake QR codes, WhatsApp job traps, deepfake voice calls, KYC/OTP fraud),
writes new detection rules for itself, and sends alerts to every device you connect.

```
┌──────────────── Browser / Phone (PWA) ─────────────────┐        ┌──────────── FastAPI backend ─────────────┐
│ Next.js command center  ·  Service Worker  ·  Push     │◄──WS──►│ WebSocket hub ─► Detection engine        │
│ Immunity score · Live radar · Scanner · Lockdown       │──REST─►│        ▲                 │               │
└────────────────────────────────────────────────────────┘        │        │ hot-loads rules  ▼               │
          ▲  OS notifications (VAPID Web Push, no Firebase)       │ LangChain agent ◄─ ingestion queue      │
          └───────────────────────────────────────────────────────│ Threat simulator · Intel feeds · SQLite │
                                                                  └──────────────────────────────────────────┘
```

---

## 🧭 The product in 30 seconds

| For everyone (free) | For paying members | For you (admin) |
|---|---|---|
| **Check anything:** links, SMS/WhatsApp text, **phone numbers, UPI IDs, emails, IP addresses, QR codes** (photo or live camera) and call transcripts | **Unlimited** checks (free = 25/day, adjustable) | **Admin panel** at `/admin` |
| A big, plain-language answer (*Dangerous · Be careful · No scam signs*) with the reasons and the list of sources checked | **No ads** | Add **articles, tips and videos** (YouTube link or upload) in any language |
| **Warn family on WhatsApp** in one tap | **Deep scan**, including VirusTotal | Sell and run **ads** (banner, text, video, AdSense) with views, clicks and CTR |
| **Live scam alerts** (real feeds plus community) | **Family plan:** up to 6 members, push alert when a member checks something dangerous | **Affiliate offers**, shown after risky checks, with click tracking |
| **Scam Academy** videos and tips in 6 languages | | **Plans and prices** (₹ via Razorpay, $ via Stripe) and a payments list |
| **Report a scam** (number, UPI ID, link…) | | **Moderate reports**, manage users (give Premium, make admin) |
| **Password-leak checker** (private) · "Got scammed?" steps (1930) | | **Data providers:** turn feeds on or off, paste API keys, test them |

Languages: **English, हिन्दी, தமிழ், తెలుగు, বাংলা, मराठी** (automatic, switch at the top).

### Where the data comes from (several providers, not one)
- **Built in:** the ProblemHunt detection engine and self-learning AI agent, plus moderated community reports.
- **Free feeds, no key needed:** OpenPhish, abuse.ch URLhaus, Phishing Army, and Phishing.Database (off by default because it is large).
- **Free-tier APIs:** add a key in Admin → Data providers. Google Safe Browsing (links), VirusTotal (links, Premium deep scan), IPQualityScore (links, **phone numbers**, **emails**), AbuseIPDB (IP addresses), AlienVault OTX (domains).
- **In the browser:** Have I Been Pwned "Pwned Passwords" (k-anonymity, so the password never leaves the device).

### 💰 How ProblemHunt earns
1. **Premium and Family passes:** Admin → Settings → paste your Razorpay keys (India: UPI, cards, wallets) and/or Stripe keys (international). Edit prices in Admin → Plans.
2. **Direct sponsor ads:** Admin → Ads → *Add new*. Choose the placement (home top, below results, Academy…), add an image, video or text, set dates and language. Views and clicks are counted so you can bill sponsors (e.g. per month or per 1,000 views).
3. **Google AdSense:** Admin → Settings → paste your `ca-pub-…` ID. AdSense fills any slot with no direct sponsor. Premium users don't see ads.
4. **Affiliate offers:** Admin → Affiliates → add password managers, antivirus, VPN or identity protection with **your** affiliate links. They appear on the home page and after risky checks, chosen to match the threat type.

### 👑 Becoming the admin
- **On your computer:** the **first account you create** becomes the admin. Open `/account`, sign up, and an **Admin** link appears in the menu.
- **On a public server:** set `PH_ADMIN_EMAIL=you@example.com` (Render → Environment), then sign up with that email.
- **Already have an account that is not admin?** Stop the server and run
  `python start_problemhunt.py --make-admin you@example.com` (or a mobile number), start it again and log in again.

### 🆕 v5 — Workplace, Threat Intelligence and AI assistants
| Feature | Where | How it works |
|---|---|---|
| **Workplace (organisations)** | `/org` | Create an organisation or join with an invite code (`ORG-XXXXXX`). Roles owner/admin/member; admins must turn on **2-step verification** (any authenticator app). |
| **Awareness courses** | `/courses` | 6 courses (phishing, UPI, passwords, impersonation & deepfakes, safe work, DPDP/GDPR) with quizzes; progress and points saved. |
| **Safe phishing tests** | `/org` → Phishing tests | 8 templates; emails go only to members who joined; a click opens a training page (`/caught`), never a real login; "Report" links earn credit. Needs SMTP for real emails (developer mode prints links). |
| **Password audit** | `/org` → Passwords | Each person checks on their own device (k-anonymity); only leaked yes/no and strength 0–4 are stored. Includes a NIST-based policy checker. |
| **Compliance center** | `/org` → Compliance | 18 controls mapped (indicatively) to NIST CSF 2.0, ISO 27001:2022, SOC 2, PCI DSS 4.0, GDPR, HIPAA, DPDP Act, CERT-In. |
| **5 scores + board report** | `/org`, `/org/report` | Risk posture, compliance, maturity, awareness, threat exposure; printable PDF report; tamper-evident (hash-chained) audit log. |
| **Threat & Fraud Intelligence** | `/intel` | Fraud center (18 fraud types with risk, impact, countries, ATT&CK, official advisories); CISA KEV + FIRST EPSS + NIST NVD; CISA/NCSC/CERT-EU and other RSS advisories (add CERT-In in Admin); MITRE ATT&CK lookup. Downloads every 6 h. |
| **AI assistants** | `/ai` | Fraud investigator, security assistant, threat hunter, compliance advisor, awareness coach, career guide. Grounded in ProblemHunt's knowledge with cited sources. Free model: install [Ollama](https://ollama.com), run `ollama pull llama3.1`, then Admin → Settings → AI: base URL `http://localhost:11434/v1`, model `llama3.1`. Or a free Groq key. Without a model, rules-only answers. |

Smaller download: the screenshot-reading engine now lives once in `backend/static/tesseract`.

### 🆕 v3 — trust, safety & membership features
| Feature | How it works |
|---|---|
| **12 languages** | English, हिन्दी, தமிழ், తెలుగు, বাংলা, मराठी, ಕನ್ನಡ, മലയാളം, ગુજરાતી, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, اردو (right-to-left). Admin content can be written in any of them. |
| **Login with mobile or email code** | Account → *Log in with code*. A 6-digit code (valid 10 min, 5 tries, rate-limited) is sent by **email (SMTP)** or **SMS (Twilio or any SMS-gateway URL such as MSG91 / Fast2SMS)** — set in Admin → Settings. With nothing configured, the code is printed in the server window and shown on screen only on your own computer (developer mode). |
| **Admin approval** | Admin → Settings → *Require admin approval*. New sign-ups wait in **Admin → Approvals** (approve or delete). |
| **Membership orders (UPI)** | Set your UPI ID in Settings. Customers get an order code `PH-YYMM-XXXXXX`, a UPI QR, and enter their UTR. You approve in **Admin → Orders** → Premium starts instantly. |
| **Membership codes** | **Admin → Membership codes**: generate gift/partner codes (plan, days, uses, expiry, note), export CSV. Users redeem on the Premium page. |
| **Fraud guide** | 12 current Indian fraud types (UPI QR, KYC, digital arrest, voice clone, loan apps, sextortion, …) with *how it works / red flags / how to stop / if it happened*, plus live weekly counts from real checks. |
| **Awareness programs** | Admin → Awareness programs: publish workshops, school/government drives; citizens register; you see the registration list. |
| **Emergency SOS** | Red SOS button everywhere. Hold 2 s → family members and up to 5 emergency contacts get your location (push + SMS/email), plus one-tap 112 / 1930 and WhatsApp share. Admins see only an anonymous log, never locations. Works partly offline (calls). |
| **Password tools** | Strength meter, secure generator, private leak check. |
| **🎯 Daily game "Scam or Safe?"** | 3 real-style messages a day (24 built-in EN/HI + your own in any language from **Admin → Daily challenge**). Points, streaks, badges, weekly all-India / city leaderboard, WhatsApp "challenge friends" sharing, 10 am daily notification. |
| **🧭 Scam Coach** | "I'm on a suspicious call right now" — 8 yes/no questions give an instant verdict + what to do + one-tap 1930 / Chakshu. |
| **🛡️ Safety Score** | Personal 0–100 checkup (UPI PIN, WhatsApp 2-step, Sanchar Saathi SIM check, 2FA, bank alerts, SOS contacts, family…). Shareable score card. |
| **📸 Screenshot check** | Upload a screenshot of an SMS/WhatsApp — text is read **on the phone** (nothing uploaded; English + Hindi built in, other Indian languages download once) and checked. |
| **🖼️ Warning image cards** | One tap creates a WhatsApp/Status-ready warning image after a dangerous check — free word-of-mouth growth. |
| **📍 Scams near you** | City-wise map + ranking of community reports (last 30 days). |
| **🇮🇳 Government links** | 1930, cybercrime.gov.in, Chakshu and "SIMs in your name" (Sanchar Saathi) on every danger result. |
| **Trust pages** | /trust, /privacy, /terms — templates, **review them with a lawyer before launch**. |

---

## ▶️ Run it on your computer (1 click)

**You need:** Python 3.9 or newer ([python.org](https://www.python.org/downloads/)). On Windows, tick **“Add Python to PATH”** during install.

1. Download and unzip this folder.
2. **Double-click `start_problemhunt.py`**, or open a terminal in the folder and run:
   ```bash
   python start_problemhunt.py
   ```
3. That's it. The script creates a private `.venv`, installs everything it needs, starts the server and opens the dashboard in your browser.

The first run takes about a minute to install packages. Later runs start in a few seconds.

| Option | What it does |
|---|---|
| `--lan` | Phones on the same Wi-Fi can open the dashboard (the address is printed) |
| `--port 9000` | Use a different port (a free one is picked automatically if 8000 is busy) |
| `--no-browser` | Don't open a browser tab |
| `--demo` | Add simulated drill traffic and virtual devices (labelled "sim drill") |
| `--reset` | Wipe local history and learned rules, then start fresh |
| `--rebuild-frontend` | Rebuild the dashboard from source (needs Node.js 18+) |

> **Legal pages before launch:** add a Privacy Policy and Terms (AdSense and the payment gateways require them) and check the terms of each data provider before using its free tier commercially.

> The dashboard ships **prebuilt** in `frontend/out`, so you don't need Node.js to run it.

### Give the AI agent an LLM brain (optional, free)

ProblemHunt works fully offline: a statistical pattern miner learns new rules on its own. To add an LLM:

1. Copy `.env.example` to `.env`.
2. Pick **one** option:
   - **Groq** (fast, free tier): create a key at [console.groq.com/keys](https://console.groq.com/keys), then set `GROQ_API_KEY=...`
   - **Hugging Face**: set `HUGGINGFACEHUB_API_TOKEN=...`
   - **Ollama** (100% local and private): install [ollama.com](https://ollama.com), run `ollama pull llama3.2`, then set `PH_OLLAMA_MODEL=llama3.2`
3. Restart `start_problemhunt.py`. The **AI Agent Core** panel will show **LLM online**.

---

## ✨ What's inside

| Capability | How it works |
|---|---|
| **Autonomous AI agent** (`backend/app/agent.py`) | Every suspicious sample goes into an async learning queue. With an LLM, a LangChain chain (`prompt │ llm │ JsonOutputParser`) classifies it and pulls out reusable phrases and domains. Without one, an n-gram miner promotes phrases that show up in 3 or more separate scams and never in normal messages. New rules take effect immediately, with no restart. |
| **Detection engine** (`detection.py`) | Explainable signatures and heuristics: brand look-alikes including leetspeak (`paypa1`), punycode, raw-IP links, risky TLDs, URL shorteners, `@` tricks, APK/EXE downloads, UPI QR payloads that pre-fill an amount, job/task-scam wording, OTP requests, "digital arrest" threats, and family-emergency voice scripts. A scan takes under 1 ms. |
| **Live threat intel** (`intel.py`) | Downloads the free **OpenPhish** and **abuse.ch URLhaus** feeds every 30 minutes (no API key needed) and loads them into the engine. |
| **Real data by default** | The live feed and radar show **real** phishing and malware URLs from OpenPhish and URLhaus. URLs are defanged (`hxxp://evil[.]com`) and grouped into campaigns by the brand they impersonate. Only your real devices appear in the device list. |
| **Demo mode (optional)** | Run `python start_problemhunt.py --demo` to add simulated scam traffic and virtual devices, which is handy for presentations. Every simulated event is labelled **“sim drill”**. |
| **Real-time sync** (`realtime.py`) | A WebSocket hub sends threats, radar items, new rules, lockdown changes and node lists to every open dashboard. Each browser or phone shows up as a **live node**. If the WebSocket drops, the dashboard reconnects with backoff, then falls back to REST polling. |
| **Push notifications** (`push.py`, `public/sw.js`) | Standard **VAPID Web Push**. The server makes its own keys on first run, so there's no Firebase and no account to set up. Alerts reach the device even when the tab is **closed**. |
| **Digital Immunity Score** (`state.py`) | A 0–100 score built from five visible parts: interception rate, rule coverage, device mesh, AI brain and posture. It drops when high-severity threats are flagged but not neutralized. |
| **Emergency Lockdown** | One click lowers every node's blocking threshold (anything with risk 30 or above gets quarantined), pushes an alert to all subscribed devices, and puts the whole UI into alarm mode. |
| **Global Live Threat Radar** | An animated sweep showing new scam campaigns by region, with severity, trend and timestamps. |
| **Scanner** | Paste a link, SMS, email or call transcript, or scan a QR code from a **photo or live camera**. QR codes are decoded on the device with `jsQR`. |
| **PWA** | `manifest.json`, maskable icons and an offline shell. Use **Install app** or **Add to Home Screen**; no app store needed. |

### Security design
- **Links are never opened.** Scanned URLs are only analysed as text, so there's no SSRF risk and no drive-by downloads.
- **LLM output is untrusted.** Samples are wrapped in delimiters with an instruction to ignore anything inside them, and the response must pass a Pydantic schema check. The agent can only add **keyword and domain** rules, never raw regex, so model output can't cause ReDoS.
- Learned rules can add at most +50 to a score, so they can't take over.
- Per-IP rate limits, input size limits, optional `PH_ADMIN_TOKEN` for lockdown and rule deletion (checked in constant time), strict security headers and CSP, phone numbers and emails redacted in feeds, and a non-root Docker user.

---

## 🌍 Deploy for free

### Option A — Render (one service, simplest)
1. Push this folder to a GitHub repo, **including `frontend/out`**.
2. On [render.com](https://render.com): **New → Blueprint** → pick the repo. `render.yaml` sets everything up and creates a random `PH_ADMIN_TOKEN`. You'll find it in the service's **Environment** tab.
3. Optionally add `GROQ_API_KEY`. Your app goes live at `https://problemhunt-xxxx.onrender.com` with HTTPS, so **Install app** and **push alerts work on phones**.

> Render's free tier sleeps after 15 minutes idle and wipes local disk on redeploy. Add Supabase (Option C) to keep learned rules.

### Option B — Vercel (dashboard) + Render (API)
1. Deploy the backend as in Option A.
2. On [vercel.com](https://vercel.com): **New Project** → import the repo → set **Root Directory** to `frontend`.
3. Add the env var `NEXT_PUBLIC_API_URL=https://problemhunt-xxxx.onrender.com` and deploy.
4. On Render, set `PH_CORS_ORIGINS=https://your-app.vercel.app`.

> When the dashboard and API are on different domains, push subscriptions are tied to the dashboard's domain. Both setups work; Option A has fewer moving parts.

### Option C — Supabase (free persistent storage)
1. Create a free project at [supabase.com](https://supabase.com) → **SQL Editor** → run `supabase/schema.sql`.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (Settings → API → *service_role*) to your backend env.
3. Learned rules and real interceptions are copied to Postgres and restored on every boot.

### Option D — Docker (Hugging Face Spaces, Koyeb, Fly.io…)
```bash
docker build -t problemhunt . && docker run -p 7860:7860 problemhunt
```

---

## 🗂️ Project layout
```
start_problemhunt.py        one-click installer + launcher
backend/
  requirements.txt
  app/
    main.py                 FastAPI app, REST + WebSocket, pipeline, background loops
    agent.py                LangChain agent manager + offline pattern miner
    detection.py            signature/heuristic engine (hot-reloadable rules)
    simulation.py           automated threat-simulation engine + radar generator
    intel.py                OpenPhish / URLhaus ingestion
    realtime.py             WebSocket hub & defense-mesh nodes
    push.py                 VAPID Web Push
    state.py                counters, timeline, Digital Immunity Score, lockdown
    store.py                SQLite persistence
    sync.py                 optional Supabase mirror/restore
    models.py, config.py
frontend/
  app/                      Next.js App Router (static export)
  components/               CommandCenter, Radar, Feed, Scanner, Gauge, Charts, Rules, Nodes
  lib/                      API client, WebSocket hook, PWA/push helpers
  public/                   manifest.json, sw.js, icons
  out/                      prebuilt dashboard (served by FastAPI)
render.yaml · Dockerfile · supabase/schema.sql · .env.example
```

## 🔌 API
Interactive docs are at **`/api/docs`**.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/snapshot` | Full dashboard state |
| POST | `/api/scan` | `{content, kind: auto\|url\|message\|qr\|audio_transcript}` → verdict |
| GET | `/api/threats`, `/api/rules` | History and learned rules |
| DELETE | `/api/rules/{id}` | Remove a learned rule *(admin)* |
| POST | `/api/lockdown` | `{engaged: true\|false}` *(admin)* |
| GET/POST | `/api/push/public-key`, `/api/push/subscribe`, `/api/push/test` | Web Push |
| WS | `/ws` | Live events: `hello`, `threat`, `radar`, `rule`, `stats`, `lockdown`, `nodes` |

## 🧪 Develop
```bash
python start_problemhunt.py --no-browser          # API on :8000
cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev   # hot-reload UI on :3000
```

## ⚖️ What it does and doesn't do
A website can't legally or technically read other apps' SMS, WhatsApp or calls. ProblemHunt protects you by:
**(1)** analysing anything you paste or scan, **(2)** learning from live public threat feeds,
**(3)** running autonomous drills that keep the AI and your alerts sharp, and **(4)** sending push alerts and
lockdown to all your devices. To intercept traffic directly on a device, connect a browser extension, an
SMS-forwarding app or a mail rule to `POST /api/scan`; that's the integration point.

MIT licensed. Stay safe out there. 🛡️

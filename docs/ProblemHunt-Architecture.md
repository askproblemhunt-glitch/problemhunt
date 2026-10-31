# ProblemHunt.com — Architecture & Technical Documentation

**Version** 2.0 · **Date** 30 Oct 2026 · **Owner** ProblemHunt.com
**Diagram file:** `docs/ProblemHunt-Architecture.drawio`. Open it at [app.diagrams.net](https://app.diagrams.net) with **File → Open from → Device**. It has three pages: *System architecture*, *Data flows* and *Product & earning*.

---

## 1. What ProblemHunt is

ProblemHunt is a free, self-hosted security dashboard. It:

1. **Checks** anything a user pastes or scans (link, SMS/WhatsApp text, email, QR code, call transcript) and explains in plain language whether it is a scam.
2. **Streams real threat intelligence**: live phishing and malware URLs from the free OpenPhish and URLhaus feeds.
3. **Learns by itself**: an AI agent turns new scam samples into detection rules without anyone writing them.
4. **Alerts every device**: live dashboard updates over WebSockets, plus OS push notifications that arrive even when the tab is closed.
5. **Emergency Lockdown**: one button switches the whole system to maximum strictness and alerts all subscribed devices.

### Version 2.0: consumer product layer
| Module | What it adds |
|---|---|
| `backend/app/product.py` | Product API: accounts, universal `POST /api/check`, Scam Academy CMS, ads, affiliates, plans, Razorpay/Stripe payments, community reports, family protection, public stats, and the full `/api/admin/*` API |
| `backend/app/platform_db.py` | Product database: `users`, `content`, `ads`, `affiliates`, `plans`, `payments`, `reports`, `usage`, `stats`, `push_user`, `settings` |
| `backend/app/auth.py` | scrypt password hashing and HMAC-signed 30-day tokens. Roles: `user` and `admin`. Admin bootstrap via the first local signup or `PH_ADMIN_EMAIL` |
| `backend/app/providers.py` | Data providers. **Feeds:** OpenPhish, URLhaus, Phishing.Database, Phishing Army. **Lookups:** Google Safe Browsing, VirusTotal, IPQualityScore (URL/phone/email), AbuseIPDB (IP), AlienVault OTX. Called in parallel with a 6-hour cache and per-provider rate limits |
| `backend/app/checker.py` | Works out the input type (url, message, qr, phone, upi, email, ip), plus heuristics for UPI IDs, emails and phone numbers, and merges in community and provider evidence |
| `backend/app/payments.py` | Razorpay Orders and HMAC signature verification; Stripe Checkout Sessions and webhook signature verification. Premium is a time-boxed pass |
| `frontend/app/*` | Pages: `/` (Check), `/learn`, `/report`, `/premium`, `/account`, `/threats` (live map), `/admin` |
| `frontend/lib/i18n.tsx` | 6 UI languages: en, hi, ta, te, bn, mr |
| `frontend/components/site/*` | Check box and result card, ad slot (sponsor/AdSense), affiliate cards, live alerts, help panel, password-leak tool |
| `frontend/components/admin/*` | Admin panel: overview charts, generic create/edit/delete with image upload, reports moderation, users, payments, providers, settings |

**Earning model:** (1) Premium/Family passes via Razorpay (₹) and Stripe ($); (2) direct sponsor ads with tracked views and clicks; (3) Google AdSense as a fallback; (4) affiliate offers matched to the threat type. Premium users see no ads.

**Security additions:** secrets (gateway keys, provider keys) are stored server-side and always masked in the admin UI. Ad and affiliate links must be `http(s)` (no `javascript:`) and go through tracked redirects. Payments are verified server-side and activation is idempotent. Admin routes need `role=admin` (or `PH_ADMIN_TOKEN`). Uploads are limited to images/mp4 up to 5 MB with random names. The CSP allows only Razorpay, AdSense, YouTube/Vimeo and Stripe redirects.

---

## 2. Architecture at a glance

```
 USERS & DEVICES          FRONTEND (Next.js, static)          BACKEND (Python FastAPI)                 EXTERNAL (free)
 ───────────────          ──────────────────────────          ────────────────────────                 ───────────────
 Laptop browser  ──HTTP──▶ CommandCenter UI                    main.py  API layer ──▶ detection.py ◀──▶ agent.py ──▶ LLM (Groq/HF/Ollama)
 Phone (PWA)              Scanner + jsQR ──REST /api/scan────▶    │                       ▲                │
 User actions             useDefenseGrid ◀══WebSocket /ws═══▶ realtime.py hub ◀── live_intel.py ◀── intel.py ──▶ OpenPhish / URLhaus
 OS notification ◀── sw.js ◀──────────── push service ◀── push.py (VAPID) ◀── state.py (score, lockdown)
                                                             store.py (SQLite) ── sync.py ──▶ Supabase (optional)
```

The editable, colour-coded version is in the `.drawio` file.

---

## 3. Components: what each part does and how

### 3.1 Frontend (`frontend/`)

| File / module | What it does | How it works |
|---|---|---|
| `app/page.tsx`, `components/CommandCenter.tsx` | Main dashboard screen | React client component that lays out every panel and shows toast pop-ups |
| `components/ImmunityGauge.tsx` | Digital Immunity Score (0–100) | Recharts radial gauge, sparkline of score history, five-part breakdown |
| `components/ThreatRadar.tsx` | Global Live Threat Radar | Animated SVG sweep. Each dot is one real campaign; its angle comes from a hash of the campaign name and its distance from how big the campaign is |
| `components/ThreatFeed.tsx` | Live Interceptions list | Real-time list. Each item is tagged **live intel**, **your scan** or **sim drill**, and live-intel items have a **Verify on VirusTotal** link |
| `components/Scanner.tsx` | One-click scanner | Text box plus QR decoding with **jsQR** (from a photo or the live camera, decoded on the device), then `POST /api/scan` |
| `components/Charts.tsx` | Threat velocity and attack mix | Recharts area and bar charts, times shown in the viewer's local timezone |
| `components/NodesPanel.tsx` | Device mesh and AI status | Lists real connected devices, plus the AI provider, LangChain version and agent counters |
| `components/RulesPanel.tsx` | Self-learned rules | Table of rules the agent created, with origin (LLM agent or pattern miner) |
| `lib/useDefenseGrid.ts` | Live connection | WebSocket client with exponential back-off. After 3 failures it falls back to polling `/api/snapshot` every 5 s |
| `lib/api.ts` | REST client | `scan`, `lockdown`, `push` calls. Asks for the admin token if the server replies 401 |
| `lib/pwa.ts` | App install and alerts | Registers the service worker, subscribes to Web Push with the server's VAPID public key, detects the device type |
| `public/sw.js` | Service worker | Offline cache, `push` → `showNotification`, notification click → focus or open the app |
| `public/manifest.json` | PWA manifest | Name, icons (including maskable), standalone display, so "Add to Home Screen" works |

**Build:** `next build` with `output: "export"` produces plain HTML/JS/CSS in `frontend/out`. The Python server serves it, so **Node.js is not needed at runtime**.

### 3.2 Backend (`backend/app/`)

| File | What it does | How it works |
|---|---|---|
| `main.py` | API layer and orchestrator | FastAPI app: REST routes, `/ws` WebSocket, static dashboard, security headers and CSP, per-IP rate limit, optional admin token, background loops |
| `detection.py` | **Detection engine** | Explainable scoring in under 1 ms: (a) about 45 language signatures (job scams, OTP theft, KYC fraud, digital arrest, deepfake-voice scripts…); (b) URL checks such as brand look-alikes including leetspeak `paypa1`, punycode, raw IP addresses, risky TLDs, link shorteners, `@` tricks, APK/EXE downloads; (c) UPI QR checks such as a pre-filled amount or a fake "refund desk" payee; (d) learned keyword and domain rules; (e) the live intel blocklist. Produces a 0–100 score, a verdict and the reasons |
| `agent.py` | **Autonomous AI agent** | Async queue of suspicious samples. **With an LLM:** a LangChain chain (`ChatPromptTemplate │ LLM │ JsonOutputParser`) classifies the sample and extracts keywords and domains, and the output is checked by Pydantic. **Without an LLM:** an n-gram miner promotes a phrase seen in 3 or more separate scams that never appears in normal text. New rules are saved and hot-loaded |
| `intel.py` | Feed fetcher | Downloads the OpenPhish and URLhaus text feeds every 30 min (timeout, 4 MB cap), parses URLs and hosts, and excludes shared hosts like GitHub and Google Drive from host-wide blocking |
| `live_intel.py` | Live intel streamer | Turns each new real URL into a feed event: classifies the brand or malware type, maps the country TLD to a region, **defangs** the URL (`hxxps://a[.]b`), adds a VirusTotal link, and adds it to the radar campaign counts. Sends one every 2.5–6 s |
| `realtime.py` | WebSocket hub | Tracks connected devices as nodes and broadcasts `hello`, `threat`, `radar`, `rule`, `stats`, `lockdown` and `nodes` messages |
| `state.py` | Runtime state | Counters, 30-minute timeline, lockdown flag, **Immunity Score**. One radar entry is kept per campaign |
| `push.py` | Web Push | Generates **VAPID** keys on first run and sends signed pushes with `pywebpush` (throttled). Removes expired subscriptions |
| `store.py` | Database | SQLite (WAL mode): `rules`, `threats` (last 5 000), `intel`, `push_subs`, `kv` |
| `sync.py` | Cloud backup (optional) | Copies rules and real threats to Supabase Postgres over REST and restores rules on boot |
| `simulation.py` | Demo traffic (optional) | `--demo` only. Synthetic scams through the real pipeline, always labelled **sim drill** |
| `config.py` / `models.py` | Settings and schemas | Environment-variable settings and Pydantic models shared by the API and engines |

### 3.3 Launcher and deployment

| Item | Purpose |
|---|---|
| `start_problemhunt.py` | One-click launcher: creates `.venv`, installs missing packages, loads `.env`, finds a free port, starts Uvicorn, opens the browser. Flags: `--reset`, `--demo`, `--lan`, `--port`, `--rebuild-frontend` |
| `render.yaml` | Render free web service blueprint, including an auto-generated `PH_ADMIN_TOKEN` |
| `Dockerfile` | For Docker hosts (Hugging Face Spaces, Koyeb, Fly.io). Runs as a non-root user |
| `frontend/vercel.json` | Optional: host only the dashboard on Vercel and point it at the API |
| `supabase/schema.sql` | Tables for the optional Supabase backup |

---

## 4. How data flows

### A. One-click scan
1. The user pastes text or scans a QR code; **jsQR** decodes QR codes on the device.
2. `POST /api/scan` is rate-limited (40/min per IP) and limited to 8 000 characters.
3. The **detection engine** scores it. If the result is unclear and an LLM is configured, the **agent** gives a second opinion.
4. Result: verdict, severity, risk score, plain-language explanation and indicators.
5. The event goes to the feed (WebSocket), a push alert is sent if it's critical, and the sample goes to the agent queue for learning.

### B. Live threat intelligence (real data)
1. `intel.py` downloads OpenPhish and URLhaus every 30 minutes.
2. Indicators are saved in SQLite and loaded into the engine's blocklist, so any later scan of those URLs is blocked.
3. New URLs are queued in `live_intel.py`, classified, defanged and streamed to the feed.
4. Radar campaigns count live URLs per impersonated brand.

### C. Self-learning
1. Suspicious samples join the agent queue, so scans are never slowed down.
2. The LLM extracts keywords and domains (validated), **or** the miner finds phrases repeated across 3 or more scams.
3. The rule is saved, hot-loaded into the engine and shown in **Self-Learned Defense Rules**.
4. The next matching scam is caught by the learned rule.

### D. Alerts and lockdown
1. Pressing **Emergency Lockdown** calls `POST /api/lockdown`, which needs the admin token on public deployments.
2. Blocking thresholds drop: anything with risk 30 or above is quarantined.
3. `push.py` sends a VAPID-signed push through the browser's push service (Google FCM, Mozilla or Apple).
4. `sw.js` wakes up and shows an **OS notification**, even if the tab is closed.

---

## 5. Technology stack (all free and open-source)

| Layer | Technology | Why |
|---|---|---|
| Backend | Python 3.9+, **FastAPI**, Uvicorn, Pydantic v2 | Async, fast, typed, automatic API docs at `/api/docs` |
| Real-time | **WebSockets** (FastAPI/Starlette) | Instant updates on every device |
| AI | **LangChain** (`langchain-core`, `langchain-groq`), optional HF / Ollama | Swap LLM providers without changing code; free tiers or fully local |
| Storage | **SQLite** (+ optional **Supabase** Postgres) | Zero setup locally; optional free cloud backup |
| Push | **Web Push / VAPID** (`pywebpush`) | Standard, no Firebase account needed |
| Frontend | **Next.js 14** (App Router, static export), React 18, **Tailwind CSS**, **Recharts**, **lucide-react**, **jsQR** | Modern UI that compiles to static files the Python server can serve |
| PWA | `manifest.json` + Service Worker | Installable on phones, works offline, background alerts |
| Threat intel | **OpenPhish** community feed, **abuse.ch URLhaus** | Real, free, no API key |
| Verification | **VirusTotal** public domain reports (links only) | Independent proof for each live item |
| Hosting | **Render** free tier (or Docker / Vercel) | HTTPS, auto-deploy from GitHub |

---

## 6. API reference

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness check | – |
| GET | `/api/snapshot` | Full dashboard state | – |
| POST | `/api/scan` | `{content, kind}` → verdict | rate-limited |
| GET | `/api/threats?limit=` | Threat history | – |
| GET | `/api/rules` | Learned rules | – |
| DELETE | `/api/rules/{id}` | Remove a learned rule | admin |
| POST | `/api/lockdown` | `{engaged: true\|false}` | admin |
| GET | `/api/push/public-key` | VAPID public key | – |
| POST | `/api/push/subscribe` · `/unsubscribe` | Manage push subscriptions | – |
| POST | `/api/push/test` | Send a test push | admin |
| WS | `/ws` | Live events (`hello`, `threat`, `radar`, `rule`, `stats`, `lockdown`, `nodes`) | – |

"Admin" endpoints need the `X-Admin-Token` header only when `PH_ADMIN_TOKEN` is set, which it is automatically on Render.

---

## 7. Security design

- **Links are never opened.** Scanned URLs are analysed as text only, so there is no SSRF risk and no drive-by downloads.
- **Defanged display.** Malicious URLs are shown as `hxxps://evil[.]com` so they can't be clicked by accident.
- **LLM safety.** Samples are wrapped in `<sample>` delimiters with an instruction to ignore anything inside them. The output must pass a Pydantic schema. The agent can only create **keyword or domain** rules, never regex, so model output can't cause ReDoS. Learned rules can add at most +50 to a score.
- **Server hardening.** Strict security headers (CSP, `X-Frame-Options: DENY`, `nosniff`), per-IP rate limits, input size limits, admin token compared in constant time, phone numbers and emails redacted in feeds, fixed MIME types (fixes Windows), non-root Docker user.
- **Secrets** (`.env`, VAPID private key, database) are kept out of Git by `.gitignore`.

---

## 8. Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `GROQ_API_KEY` / `HUGGINGFACEHUB_API_TOKEN` / `PH_OLLAMA_MODEL` | empty | Turns on the LLM brain (pick one) |
| `PH_ADMIN_TOKEN` | empty (local) | Protects lockdown, rule deletion and test push |
| `PH_SIMULATION` | `0` | `1` = demo drill traffic |
| `PH_INTEL_FEEDS` | `1` | Live OpenPhish/URLhaus feeds |
| `PH_INTEL_REFRESH_SECONDS` | `1800` | How often feeds are downloaded |
| `PH_CORS_ORIGINS` | `*` | Allowed dashboard origins when hosting the dashboard separately |
| `PH_SCAN_RATE_PER_MIN` | `40` | Scan rate limit per IP |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | empty | Optional cloud backup |

---

## 9. Running and deploying

**Locally (Windows/Mac/Linux):** `python start_problemhunt.py` opens http://localhost:8000.

**Free online (Render):**
1. Push the folder to a private GitHub repo with GitHub Desktop.
2. On Render: **New → Blueprint**, pick the repo, then Deploy.
3. Copy `PH_ADMIN_TOKEN` from the service's **Environment** tab.
4. Optionally add `GROQ_API_KEY` and Supabase keys.
5. Optionally connect your own domain: Render → Custom Domains, then add the DNS records in BigRock.

**Free-tier limits:** the service sleeps after 15 min idle and takes about 1 min to wake. Local storage resets on sleep or redeploy unless Supabase is connected. There are 750 free instance hours per month.

---

## 10. Known limitations

- A website **cannot read SMS, WhatsApp or calls in other apps**. ProblemHunt protects what you scan, learns from public feeds and alerts your devices. Blocking automatically inside other apps would need a browser extension or a native mobile app that calls `POST /api/scan`.
- **"Blocklisted"** means ProblemHunt's own scanner will block that URL. It does not block traffic in other apps or across your network.
- The **Immunity Score** is a calculated indicator based on interception rate, rule coverage, devices, AI status and posture. It is not an outside certification.
- Push alerts can't be sent while a free-tier server is asleep.

---

## 11. Suggested roadmap

1. Browser extension that checks links before they open (uses `/api/scan`).
2. Android app or SMS-forwarder that sends incoming messages to `/api/scan`.
3. User accounts and per-user dashboards for multi-user hosting.
4. More free intel feeds (PhishTank, Phishing.Database) and VirusTotal API lookups (free key).
5. Live rule-hit counters and an analyst review queue for learned rules.

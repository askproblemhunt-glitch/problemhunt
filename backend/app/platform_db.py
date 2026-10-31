"""Product database: users, content (CMS), ads, affiliates, plans, payments,
community scam reports, usage limits, daily stats and settings.

SQLite by default (zero setup). All JSON-ish fields are stored as TEXT.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT '', pw_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', lang TEXT DEFAULT 'en', premium_until REAL DEFAULT 0,
  plan_id TEXT DEFAULT '', family_code TEXT DEFAULT '', created_at TEXT, last_login TEXT,
  scans_total INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_family ON users(family_code);
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'article', title TEXT NOT NULL, summary TEXT DEFAULT '',
  body TEXT DEFAULT '', video_url TEXT DEFAULT '', image_url TEXT DEFAULT '', lang TEXT DEFAULT 'en',
  category TEXT DEFAULT 'general', published INTEGER DEFAULT 1, pinned INTEGER DEFAULT 0,
  premium_only INTEGER DEFAULT 0, views INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, advertiser TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'banner',
  placement TEXT NOT NULL DEFAULT 'home_top', title TEXT DEFAULT '', body TEXT DEFAULT '', image_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '', cta TEXT DEFAULT 'Learn more', target_url TEXT DEFAULT '', lang TEXT DEFAULT 'all',
  start_at TEXT DEFAULT '', end_at TEXT DEFAULT '', weight INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
  impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, price_note TEXT DEFAULT '', created_at TEXT
);
CREATE TABLE IF NOT EXISTS affiliates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT DEFAULT 'general', description TEXT DEFAULT '',
  logo_url TEXT DEFAULT '', url TEXT NOT NULL, badge TEXT DEFAULT '', price_note TEXT DEFAULT '',
  lang TEXT DEFAULT 'all', active INTEGER DEFAULT 1, clicks INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, created_at TEXT
);
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, price_inr REAL DEFAULT 0, price_usd REAL DEFAULT 0,
  days INTEGER DEFAULT 30, features TEXT DEFAULT '[]', highlight INTEGER DEFAULT 0, family INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, user_id TEXT, plan_id TEXT, provider TEXT, provider_ref TEXT UNIQUE,
  amount REAL, currency TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL, value_norm TEXT NOT NULL,
  description TEXT DEFAULT '', amount_lost REAL DEFAULT 0, city TEXT DEFAULT '', lang TEXT DEFAULT 'en',
  status TEXT DEFAULT 'pending', reporter_id TEXT DEFAULT '', ip_hash TEXT DEFAULT '', created_at TEXT, reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS reports_norm ON reports(value_norm);
CREATE TABLE IF NOT EXISTS usage (day TEXT, subject TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(day, subject));
CREATE TABLE IF NOT EXISTS stats (day TEXT, key TEXT, value REAL DEFAULT 0, PRIMARY KEY(day, key));
CREATE TABLE IF NOT EXISTS push_user (endpoint TEXT PRIMARY KEY, user_id TEXT);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS otps (
  id TEXT PRIMARY KEY, target TEXT NOT NULL, channel TEXT NOT NULL, code_hash TEXT NOT NULL,
  expires REAL NOT NULL, attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0, created_at TEXT
);
CREATE INDEX IF NOT EXISTS otps_target ON otps(target);
CREATE TABLE IF NOT EXISTS redeem_codes (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, plan_id TEXT NOT NULL, days INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 1, uses INTEGER DEFAULT 0, expires_at TEXT DEFAULT '', note TEXT DEFAULT '',
  active INTEGER DEFAULT 1, created_at TEXT
);
CREATE TABLE IF NOT EXISTS code_uses (code_id TEXT, user_id TEXT, used_at TEXT, PRIMARY KEY(code_id, user_id));
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, order_code TEXT UNIQUE NOT NULL, user_id TEXT, plan_id TEXT, amount REAL, currency TEXT,
  method TEXT DEFAULT 'upi', payer_ref TEXT DEFAULT '', note TEXT DEFAULT '', status TEXT DEFAULT 'pending',
  created_at TEXT, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, organizer TEXT DEFAULT '', description TEXT DEFAULT '',
  date_at TEXT DEFAULT '', location TEXT DEFAULT '', online_url TEXT DEFAULT '', image_url TEXT DEFAULT '',
  lang TEXT DEFAULT 'all', category TEXT DEFAULT 'workshop', audience TEXT DEFAULT 'everyone',
  active INTEGER DEFAULT 1, registrations INTEGER DEFAULT 0, created_at TEXT
);
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY, program_id TEXT, name TEXT, contact TEXT, city TEXT DEFAULT '', created_at TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '', created_at TEXT
);
CREATE TABLE IF NOT EXISTS sos_events (
  id TEXT PRIMARY KEY, user_id TEXT, family_code TEXT DEFAULT '', kind TEXT DEFAULT 'safety', message TEXT DEFAULT '',
  lat REAL, lon REAL, accuracy REAL, notified INTEGER DEFAULT 0, status TEXT DEFAULT 'active', created_at TEXT
);
"""

MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",
    # v4: daily game, safety score, city
    "ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN last_play_day TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN badges TEXT DEFAULT '[]'",
    "ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN checkup TEXT DEFAULT '{}'",
    """CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY, message TEXT NOT NULL, answer TEXT DEFAULT 'scam', explanation TEXT DEFAULT '',
  channel TEXT DEFAULT 'sms', lang TEXT DEFAULT 'en', active INTEGER DEFAULT 1, created_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS play_answers (
  id TEXT PRIMARY KEY, user_id TEXT, day TEXT, item_id TEXT, choice TEXT, correct INTEGER, points INTEGER, created_at TEXT,
  UNIQUE(user_id, day, item_id))""",
    "CREATE INDEX IF NOT EXISTS idx_play_day ON play_answers(day)",
]

TABLE_FIELDS: Dict[str, List[str]] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


DEFAULT_SETTINGS: Dict[str, Any] = {
    "site_name": "ProblemHunt",
    "tagline": "Check before you click, pay or reply.",
    "free_daily_limit": 25,
    "support_email": "",
    "site_url": "",
    "adsense_client": "",
    "adsense_slots": {},
    "razorpay_key_id": "",
    "razorpay_key_secret": "",
    "stripe_secret_key": "",
    "stripe_webhook_secret": "",
    "show_ads_to_premium": False,
    "community_auto_publish": False,
    "require_approval": False,
    "manual_payment_upi": "",
    "manual_payment_note": "Pay with any UPI app, then enter the UPI transaction ID (UTR). We activate your plan after checking.",
    "smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_password": "", "smtp_from": "",
    "sms_provider": "", "twilio_sid": "", "twilio_token": "", "twilio_from": "",
    "sms_webhook_url": "",
    "default_country_code": "+91",
    "emergency_number": "112",
    "cyber_helpline": "1930",
}
SECRET_SETTINGS = {"razorpay_key_secret", "stripe_secret_key", "stripe_webhook_secret", "smtp_password", "twilio_token",
                   "sms_webhook_url"}


class PlatformDB:
    def __init__(self, path) -> None:
        self._lock = threading.RLock()
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript(SCHEMA)
        for m in MIGRATIONS:  # upgrade older databases in place
            try:
                self.db.execute(m)
            except sqlite3.OperationalError:
                pass
        self.db.commit()
        for t in ("users", "content", "ads", "affiliates", "plans", "payments", "reports", "redeem_codes", "orders",
                  "programs", "registrations", "contacts", "sos_events", "otps", "challenges", "play_answers"):
            TABLE_FIELDS[t] = [r["name"] for r in self.db.execute(f"PRAGMA table_info({t})")]
        self._seed()

    # ------------------------------------------------------------- generic
    def insert(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        row = {k: v for k, v in row.items() if k in TABLE_FIELDS[table]}
        cols = ",".join(row)
        with self._lock:
            self.db.execute(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", list(row.values()))
            self.db.commit()
        return row

    def update(self, table: str, row_id: str, changes: Dict[str, Any]) -> bool:
        changes = {k: v for k, v in changes.items() if k in TABLE_FIELDS[table] and k != "id"}
        if not changes:
            return False
        sets = ",".join(f"{k}=?" for k in changes)
        with self._lock:
            cur = self.db.execute(f"UPDATE {table} SET {sets} WHERE id=?", [*changes.values(), row_id])
            self.db.commit()
            return cur.rowcount > 0

    def delete(self, table: str, row_id: str) -> bool:
        with self._lock:
            cur = self.db.execute(f"DELETE FROM {table} WHERE id=?", (row_id,))
            self.db.commit()
            return cur.rowcount > 0

    def get(self, table: str, row_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            r = self.db.execute(f"SELECT * FROM {table} WHERE id=?", (row_id,)).fetchone()
        return dict(r) if r else None

    def query(self, sql: str, params: Iterable[Any] = ()) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self.db.execute(sql, list(params)).fetchall()]

    def scalar(self, sql: str, params: Iterable[Any] = ()) -> Any:
        with self._lock:
            r = self.db.execute(sql, list(params)).fetchone()
        return r[0] if r else None

    def execute(self, sql: str, params: Iterable[Any] = ()) -> int:
        with self._lock:
            cur = self.db.execute(sql, list(params))
            self.db.commit()
            return cur.rowcount

    # ------------------------------------------------------------ settings
    def settings(self) -> Dict[str, Any]:
        out = dict(DEFAULT_SETTINGS)
        for r in self.query("SELECT k, v FROM settings WHERE k NOT LIKE 'provider:%'"):
            try:
                out[r["k"]] = json.loads(r["v"])
            except ValueError:
                pass
        return out

    def set_settings(self, changes: Dict[str, Any]) -> None:
        with self._lock:
            for k, v in changes.items():
                if k in DEFAULT_SETTINGS:
                    self.db.execute("INSERT OR REPLACE INTO settings VALUES (?,?)", (k, json.dumps(v)))
            self.db.commit()

    def provider_cfg(self, name: str) -> Dict[str, Any]:
        v = self.scalar("SELECT v FROM settings WHERE k=?", (f"provider:{name}",))
        try:
            return json.loads(v) if v else {}
        except ValueError:
            return {}

    def set_provider_cfg(self, name: str, cfg: Dict[str, Any]) -> None:
        self.execute("INSERT OR REPLACE INTO settings VALUES (?,?)", (f"provider:{name}", json.dumps(cfg)))

    # --------------------------------------------------------------- stats
    def bump(self, key: str, by: float = 1) -> None:
        self.execute(
            "INSERT INTO stats(day,key,value) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET value=value+excluded.value",
            (today(), key, by),
        )

    def use(self, subject: str) -> int:
        """Increment and return today's usage count for a subject (user id or ip hash)."""
        with self._lock:
            self.db.execute(
                "INSERT INTO usage(day,subject,count) VALUES (?,?,1) ON CONFLICT(day,subject) DO UPDATE SET count=count+1",
                (today(), subject),
            )
            self.db.commit()
            return self.db.execute("SELECT count FROM usage WHERE day=? AND subject=?", (today(), subject)).fetchone()[0]

    def usage_today(self, subject: str) -> int:
        return self.scalar("SELECT count FROM usage WHERE day=? AND subject=?", (today(), subject)) or 0

    # ---------------------------------------------------------------- seed
    def _seed(self) -> None:
        if not self.scalar("SELECT COUNT(*) FROM plans"):
            for p in DEFAULT_PLANS:
                self.insert("plans", {**p, "features": json.dumps(p["features"])})
        if not self.scalar("SELECT COUNT(*) FROM content"):
            for c in DEFAULT_CONTENT:
                self.insert("content", {"id": new_id("cnt"), "created_at": now_iso(), "updated_at": now_iso(), **c})


DEFAULT_PLANS = [
    {"id": "free", "name": "Free", "price_inr": 0, "price_usd": 0, "days": 0, "sort": 0,
     "features": ["25 checks per day", "Live scam alerts", "Scam Academy videos", "Community reports"]},
    {"id": "premium_month", "name": "Premium", "price_inr": 99, "price_usd": 2.99, "days": 30, "highlight": 1, "sort": 1,
     "features": ["Unlimited checks", "No ads", "Deep scan with all providers", "Instant push alerts", "Priority support"]},
    {"id": "family_year", "name": "Family (1 year)", "price_inr": 999, "price_usd": 24.99, "days": 365, "family": 1, "sort": 2,
     "features": ["Everything in Premium", "Protect up to 6 family members", "Alert when a family member hits a scam", "1 year, best value"]},
]

DEFAULT_CONTENT = [
    {"kind": "tip", "title": "Never share your OTP — not even with the 'bank'", "category": "otp", "pinned": 1,
     "summary": "No bank, courier or government office will ever ask for your OTP, UPI PIN or card CVV.",
     "body": "If someone asks for an OTP, it is a scam. Hang up, and call the official number printed on your card or the bank app."},
    {"kind": "tip", "title": "You never need to scan a QR code to RECEIVE money", "category": "upi", "pinned": 1,
     "summary": "Scanning a QR or entering your UPI PIN always SENDS money. Refund and prize QR codes are traps.",
     "body": "Receiving money via UPI needs nothing from you. If a buyer, 'refund desk' or 'prize team' sends a QR, block them."},
    {"kind": "article", "title": "Got scammed? Do this in the first hour", "category": "help", "pinned": 1,
     "summary": "Fast action can freeze the money. Call 1930 (India) and report at cybercrime.gov.in.",
     "body": "1. Call 1930, India's National Cyber Crime Helpline, immediately.\n2. Report at https://cybercrime.gov.in.\n"
             "3. Call your bank and block cards / UPI.\n4. Change passwords of email and banking apps.\n"
             "5. Keep screenshots of chats, numbers and transaction IDs."},
    {"kind": "article", "title": "Part-time 'like & earn' jobs are traps", "category": "jobs",
     "summary": "Tasks start with small payouts, then ask you to 'invest' in prepaid tasks you never get back.",
     "body": "Real employers never ask you to pay to get a job or to deposit money to unlock earnings."},
    {"kind": "tip", "lang": "hi", "title": "OTP किसी को न बताएं — 'बैंक' को भी नहीं", "category": "otp", "pinned": 1,
     "summary": "कोई भी बैंक, कूरियर या सरकारी दफ़्तर कभी OTP, UPI PIN या CVV नहीं माँगता।",
     "body": "अगर कोई OTP माँगे तो समझिए यह धोखा है। फ़ोन काटें और कार्ड या बैंक ऐप पर लिखे आधिकारिक नंबर पर कॉल करें।"},
    {"kind": "tip", "lang": "hi", "title": "पैसे पाने के लिए QR स्कैन करने की ज़रूरत नहीं होती", "category": "upi", "pinned": 1,
     "summary": "QR स्कैन करने या UPI PIN डालने से पैसा हमेशा जाता है, आता नहीं। 'रिफ़ंड' या 'इनाम' वाले QR जाल हैं।",
     "body": "UPI से पैसे पाने के लिए आपको कुछ नहीं करना होता। ऐसा QR भेजने वाले को तुरंत ब्लॉक करें।"},
    {"kind": "article", "lang": "hi", "title": "ठगी हो गई? पहले एक घंटे में यह करें", "category": "help", "pinned": 1,
     "summary": "तुरंत 1930 पर कॉल करें और cybercrime.gov.in पर शिकायत दर्ज करें।",
     "body": "1. तुरंत 1930 (राष्ट्रीय साइबर क्राइम हेल्पलाइन) पर कॉल करें।\n2. https://cybercrime.gov.in पर शिकायत करें।\n"
             "3. बैंक को कॉल करके कार्ड / UPI ब्लॉक कराएँ।\n4. ईमेल और बैंकिंग ऐप के पासवर्ड बदलें।\n5. चैट, नंबर और ट्रांज़ैक्शन ID के स्क्रीनशॉट रखें।"},
    {"kind": "article", "title": "'Digital arrest' does not exist", "category": "impersonation",
     "summary": "Police, CBI or customs never arrest anyone on a video call or ask for money to 'verify'.",
     "body": "Disconnect, do not transfer money, and report the number at 1930 or cybercrime.gov.in."},
]

"""ProblemHunt product API: accounts, universal 'Check anything', Scam Academy
(CMS), ads, affiliates, plans & payments, community reports, family
protection, live public stats, and the full Admin API.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import random
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from . import auth, checker, config, payments, providers
from .auth import current_user, is_premium, public_user, require_admin_user, require_user
from .detection import ENGINE
from .models import CATEGORY_LABELS, ThreatEvent
from .platform_db import SECRET_SETTINGS, PlatformDB, new_id, now_iso, today
from .realtime import HUB
from .state import STATE

log = logging.getLogger("problemhunt.product")
router = APIRouter()

PDB = PlatformDB(config.DATA_DIR / "platform.db")
auth.PDB = PDB
UPLOAD_DIR = config.DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
LANGS = ["en", "hi", "ta", "te", "bn", "mr", "kn", "ml", "gu", "pa", "or", "ur"]

# Injected by main.py
_process: Optional[Callable] = None
_decide_action: Optional[Callable] = None
_store = None
_push = None
_rate_limit: Optional[Callable] = None


def bind(*, process, decide_action, store, push, rate_limit) -> None:
    global _process, _decide_action, _store, _push, _rate_limit
    _process, _decide_action, _store, _push, _rate_limit = process, decide_action, store, push, rate_limit


def _rl(request: Request) -> None:
    if _rate_limit:
        _rate_limit(request)


def _ip_hash(request: Request) -> str:
    ip = request.client.host if request.client else "?"
    return "ip:" + hashlib.sha256((ip + auth.SECRET.decode()[:16]).encode()).hexdigest()[:16]


def _optional_user(authorization: Optional[str] = Header(default=None)):
    return current_user(authorization)


def _http_url(u: str, allow_empty=True, allow_upload=True) -> str:
    u = (u or "").strip()
    if not u and allow_empty:
        return ""
    if allow_upload and u.startswith("/uploads/"):
        return u
    if not re.match(r"^https?://[^\s<>\"']+$", u, re.I):
        raise HTTPException(400, f"Invalid URL: {u[:60]}")
    return u


# =============================================================================== AUTH
class SignupIn(BaseModel):
    email: str = Field(..., max_length=200)
    password: str = Field(..., min_length=8, max_length=200)
    name: str = Field(default="", max_length=80)
    lang: str = "en"


class LoginIn(BaseModel):
    email: str = Field(..., max_length=200)
    password: str = Field(..., max_length=200)
    mfa_code: Optional[str] = Field(default=None, max_length=12)


@router.post("/api/auth/signup", dependencies=[Depends(_rl)])
async def signup(body: SignupIn, request: Request):
    email = body.email.strip().lower()
    if not checker.EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email")
    if PDB.scalar("SELECT 1 FROM users WHERE email=?", (email,)):
        raise HTTPException(409, "An account with this email already exists — please log in")
    role = "user"
    import os
    admin_email = os.getenv("PH_ADMIN_EMAIL", "").strip().lower()
    no_admin = not PDB.scalar("SELECT 1 FROM users WHERE role='admin'")
    client = request.client.host if request.client else ""
    if admin_email and email == admin_email:
        role = "admin"
    elif not admin_email and no_admin and config.is_local_request(request):
        role = "admin"  # local install: the first account becomes the admin
    uid = new_id("usr")
    pending = bool(PDB.settings()["require_approval"]) and role != "admin"
    PDB.insert("users", {"id": uid, "email": email, "name": body.name.strip()[:80], "pw_hash": auth.hash_password(body.password),
                         "role": role, "lang": body.lang if body.lang in LANGS else "en", "created_at": now_iso(),
                         "last_login": now_iso(), "status": "pending" if pending else "active"})
    PDB.bump("signups")
    if pending:
        raise HTTPException(403, "Account created! It is waiting for approval by the admin — you can log in once approved.")
    if role == "admin":
        log.warning("Admin account created for %s", email)
    return {"token": auth.make_token(uid), "user": public_user(PDB.get("users", uid))}


@router.post("/api/auth/login", dependencies=[Depends(_rl)])
async def login(body: LoginIn):
    u = PDB.query("SELECT * FROM users WHERE email=?", (body.email.strip().lower(),))
    if not u or not auth.verify_password(body.password, u[0]["pw_hash"]) or u[0].get("disabled"):
        raise HTTPException(401, "Wrong email or password")
    if u[0].get("status") == "pending":
        raise HTTPException(403, "Your account is waiting for approval by the admin.")
    from . import product4  # noqa: PLC0415 (late import)
    product4.mfa_gate(u[0], body.mfa_code)
    PDB.update("users", u[0]["id"], {"last_login": now_iso()})
    return {"token": auth.make_token(u[0]["id"]), "user": public_user(u[0])}


@router.get("/api/me")
async def me(request: Request, user=Depends(require_user)):
    s = PDB.settings()
    return {"user": public_user(user), "usage": {"used": PDB.usage_today(user["id"]),
                                                 "limit": None if is_premium(user) else int(s["free_daily_limit"])}}


class MeIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    lang: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=200)


@router.patch("/api/me")
async def update_me(body: MeIn, user=Depends(require_user)):
    ch: Dict[str, Any] = {}
    if body.name is not None:
        ch["name"] = body.name.strip()
    if body.lang in LANGS:
        ch["lang"] = body.lang
    if body.password:
        ch["pw_hash"] = auth.hash_password(body.password)
    PDB.update("users", user["id"], ch)
    return {"user": public_user(PDB.get("users", user["id"]))}


# ======================================================================== PUBLIC CONFIG
@router.get("/api/public/config")
async def public_config():
    s = PDB.settings()
    active = [m["label"] for n, m in providers.LOOKUPS.items() if PDB.provider_cfg(n).get("enabled") and PDB.provider_cfg(n).get("api_key")]
    feeds = [m["label"] for n, m in providers.FEEDS.items() if PDB.provider_cfg(n).get("enabled", m["default"])]
    return {
        "site_name": s["site_name"], "tagline": s["tagline"], "free_daily_limit": s["free_daily_limit"],
        "support_email": s["support_email"], "adsense_client": s["adsense_client"], "adsense_slots": s["adsense_slots"],
        "payments": {"razorpay": bool(s["razorpay_key_id"] and s["razorpay_key_secret"]), "razorpay_key_id": s["razorpay_key_id"],
                     "stripe": bool(s["stripe_secret_key"])},
        "languages": LANGS, "providers": active, "feeds": feeds + ["ProblemHunt AI engine", "Community reports"],
        "login": {"email_code": True, "sms_code": True, "email_ready": bool(s["smtp_host"] and s["smtp_user"]),
                  "sms_ready": bool(s["sms_provider"])},
        "manual_payment": bool(s["manual_payment_upi"]), "manual_payment_upi": s["manual_payment_upi"],
        "emergency_number": s["emergency_number"], "cyber_helpline": s["cyber_helpline"],
        "require_approval": bool(s["require_approval"]),
    }


@router.get("/api/public/stats")
async def public_stats():
    d = today()
    stat = {r["key"]: r["value"] for r in PDB.query("SELECT key, value FROM stats WHERE day=?", (d,))}
    alerts = [t.model_dump() for t in list(STATE.threats)[:12] if t.source != "simulation"]
    week = PDB.query("SELECT day, value FROM stats WHERE key='checks' AND day>=? ORDER BY day",
                     ((datetime.now(timezone.utc) - timedelta(days=13)).strftime("%Y-%m-%d"),))
    return {
        "checks_today": int(stat.get("checks", 0)),
        "dangers_today": int(stat.get("dangers", 0)),
        "reports_total": PDB.scalar("SELECT COUNT(*) FROM reports WHERE status='approved'") or 0,
        "people_protected": PDB.scalar("SELECT COUNT(*) FROM users") or 0,
        "intel_iocs": ENGINE.intel_size,
        "blocked_total": STATE.actions["neutralized"],
        "by_category": dict(STATE.by_category),
        "latest_alerts": alerts,
        "checks_series": week,
    }


# ============================================================================== CHECK
class CheckIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)
    kind: str = "auto"
    deep: bool = False


AFF_FOR_CATEGORY = {
    "phishing_link": ["password_manager", "identity"], "otp_theft": ["password_manager", "identity"],
    "malware": ["antivirus", "vpn"], "payment_fraud": ["identity", "antivirus"], "fake_qr": ["identity", "antivirus"],
    "impersonation": ["identity", "call_blocker"], "deepfake_audio": ["call_blocker", "identity"],
    "job_scam": ["identity"], "investment_scam": ["identity"],
}


def _affiliates_for(category: str, lang: str, n: int = 2) -> List[Dict]:
    cats = AFF_FOR_CATEGORY.get(category, [])
    rows = PDB.query("SELECT * FROM affiliates WHERE active=1 AND (lang='all' OR lang=?) ORDER BY sort, created_at DESC", (lang,))
    rows.sort(key=lambda r: (r["category"] not in cats, r["sort"]))
    return [_aff_public(r) for r in rows[:n]]


def _aff_public(r: Dict) -> Dict:
    return {k: r[k] for k in ("id", "name", "category", "description", "logo_url", "badge", "price_note")} | {
        "go_url": f"/api/affiliates/{r['id']}/go"}


def _community(kind: str, value: str):
    norm = checker.normalise(kind, value)
    if not norm:
        return 0, 0
    rows = PDB.query("SELECT status, COUNT(*) c FROM reports WHERE value_norm=? GROUP BY status", (norm,))
    c = {r["status"]: r["c"] for r in rows}
    return c.get("approved", 0), c.get("pending", 0)


def _explain(verdict: str, label: str, top: str) -> str:
    if verdict == "malicious":
        return f"Dangerous! This looks like a {label}. {top}. Don't click, pay, scan or reply."
    if verdict == "suspicious":
        return f"Be careful. Signs of a {label}: {top}. Verify through an official app or number first."
    return "No scam signs found right now. Still never share OTP, PIN or passwords."


async def _family_alert(user: Dict, result: Dict) -> None:
    code = user.get("family_code")
    if not code or not _push:
        return
    members = [m["id"] for m in PDB.query("SELECT id FROM users WHERE family_code=? AND id!=?", (code, user["id"]))]
    if not members:
        return
    endpoints = [r["endpoint"] for r in PDB.query(
        f"SELECT endpoint FROM push_user WHERE user_id IN ({','.join('?' * len(members))})", members)]
    if endpoints:
        who = user.get("name") or user["email"].split("@")[0]
        await _push.notify_endpoints(endpoints, "👨‍👩‍👧 Family alert",
                                     f"{who} just checked something dangerous: {result['category_label']}. Call them to make sure they're safe.")


@router.post("/api/check")
async def check(body: CheckIn, request: Request, user=Depends(_optional_user)):
    _rl(request)
    s = PDB.settings()
    premium = is_premium(user)
    subject = user["id"] if user else _ip_hash(request)
    limit = None if premium else int(s["free_daily_limit"])
    used = PDB.usage_today(subject)
    if limit is not None and used >= limit:
        raise HTTPException(429, f"You've used all {limit} free checks for today. Upgrade to Premium for unlimited checks.")
    used = PDB.use(subject)
    kind = checker.detect_kind(body.content, body.kind)
    content = body.content.strip()
    t0 = time.perf_counter()

    if kind in ("url", "message", "qr", "audio_transcript"):
        res, _ev = await _process(content, kind if kind != "message" else "message", title=None,
                                  vector={"url": "Web", "qr": "QR", "audio_transcript": "Voice"}.get(kind, "Message"),
                                  region="Your device", node_name=(user or {}).get("name") or None, source="scan", use_llm=True)
        r = res.model_dump()
        score, ind, category = r["risk_score"], list(r["indicators"]), r["category"]
        urls = ENGINE._extract_urls(content)
        target = urls[0] if urls else None
        prov = await providers.lookup_all(PDB, target, "url", deep=premium) if target else []
        appr, pend = _community("url", target) if target else (0, 0)
    else:
        score, category, ind = checker.score_identifier(kind, content)
        pk = {"phone": "phone", "email": "email", "ip": "ip", "upi": None}.get(kind)
        prov = await providers.lookup_all(PDB, content, pk, deep=premium) if pk else []
        appr, pend = _community(kind, content)
        r = {"id": new_id("scan"), "ts": now_iso(), "matched_rules": [], "engine": "identifier heuristics",
             "confidence": 0.7}
    score = checker.apply_providers(score, prov, ind)
    score = checker.apply_community(score, appr, pend, ind)
    verdict = checker.verdict_for(score)
    if verdict != "safe" and category == "safe":
        category = "phishing_link" if kind in ("url", "qr") else "impersonation"
    if verdict == "safe":
        category = "safe" if not ind else category
    label = CATEGORY_LABELS.get(category, category)
    severity = checker.severity_for(score)
    action = _decide_action(score)
    r.update({
        "kind": kind, "risk_score": score, "verdict": verdict, "severity": severity, "category": category,
        "category_label": label, "indicators": ind[:12], "action": action,
        "explanation": _explain(verdict, label, ind[0] if ind else ""),
        "providers": prov, "community": {"approved": appr, "pending": pend},
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
        "engine": (r.get("engine") or "engine") + (f" + {len(prov)} data providers" if prov else ""),
        "affiliates": _affiliates_for(category, (user or {}).get("lang", "en")) if verdict != "safe" else [],
        "usage": {"used": used, "limit": limit, "premium": premium},
        "checked_value": content[:200],
    })
    # record identifier checks in the live feed too
    if kind not in ("url", "message", "qr", "audio_transcript") and verdict != "safe":
        ev = ThreatEvent(title=f"{label}: {kind.upper()} checked", category=category, category_label=label,
                         severity=severity, vector=kind.upper(), region="Your device", node="Web Scanner",
                         action=action, risk_score=score, indicators=ind[:4], source="scan",
                         sample=re.sub(r"\d(?=\d{3})", "•", content[:60]))
        STATE.record(ev)
        _store.add_threat(ev)
        await HUB.broadcast("threat", ev.model_dump())
    PDB.bump("checks")
    if verdict != "safe":
        PDB.bump("dangers")
        PDB.bump(f"cat_{category}")
    if user:
        PDB.execute("UPDATE users SET scans_total=scans_total+1 WHERE id=?", (user["id"],))
        if verdict == "malicious":
            await _family_alert(user, r)
    return r


# ============================================================================ CONTENT
@router.get("/api/content")
async def list_content(lang: str = "en", kind: str = "", category: str = "", q: str = "", limit: int = 60):
    sql = "SELECT * FROM content WHERE published=1 AND (lang=? OR lang='all'"
    params: List[Any] = [lang]
    sql += " OR lang='en')" if lang != "en" else ")"
    if kind:
        sql += " AND kind=?"
        params.append(kind)
    if category:
        sql += " AND category=?"
        params.append(category)
    if q:
        sql += " AND (title LIKE ? OR summary LIKE ?)"
        params += [f"%{q}%", f"%{q}%"]
    sql += " ORDER BY pinned DESC, (lang=?) DESC, created_at DESC LIMIT ?"
    params += [lang, max(1, min(limit, 200))]
    rows = PDB.query(sql, params)
    for r in rows:
        r.pop("body", None)
    return rows


@router.get("/api/content/{cid}")
async def get_content(cid: str, user=Depends(_optional_user)):
    r = PDB.get("content", cid)
    if not r or not r["published"]:
        raise HTTPException(404, "Not found")
    PDB.execute("UPDATE content SET views=views+1 WHERE id=?", (cid,))
    PDB.bump("content_views")
    if r["premium_only"] and not is_premium(user):
        r["body"] = (r["body"] or "")[:280] + "…"
        r["locked"] = True
    return r


# ================================================================================ ADS
def _active(r: Dict) -> bool:
    now = now_iso()
    return bool(r["active"]) and (not r["start_at"] or r["start_at"] <= now) and (not r["end_at"] or r["end_at"] >= now)


@router.get("/api/ads")
async def get_ad(placement: str, lang: str = "en", user=Depends(_optional_user)):
    s = PDB.settings()
    if is_premium(user) and not s["show_ads_to_premium"]:
        return {"ad": None}
    rows = [r for r in PDB.query("SELECT * FROM ads WHERE placement=? AND (lang='all' OR lang=?)", (placement, lang)) if _active(r)]
    if rows:
        ad = random.choices(rows, weights=[max(1, r["weight"]) for r in rows])[0]
        PDB.execute("UPDATE ads SET impressions=impressions+1 WHERE id=?", (ad["id"],))
        PDB.bump("ad_impressions")
        out = {k: ad[k] for k in ("id", "kind", "title", "body", "image_url", "video_url", "cta", "advertiser")}
        out["click_url"] = f"/api/ads/{ad['id']}/click"
        if ad["kind"] == "adsense":
            out["adsense_client"] = s["adsense_client"]
            out["adsense_slot"] = ad["body"] or (s["adsense_slots"] or {}).get(placement, "")
        return {"ad": out}
    if s["adsense_client"]:
        return {"ad": {"kind": "adsense", "adsense_client": s["adsense_client"],
                       "adsense_slot": (s["adsense_slots"] or {}).get(placement, "")}}
    return {"ad": None}


@router.get("/api/ads/{aid}/click")
async def ad_click(aid: str):
    ad = PDB.get("ads", aid)
    if not ad or not ad["target_url"]:
        raise HTTPException(404, "Not found")
    PDB.execute("UPDATE ads SET clicks=clicks+1 WHERE id=?", (aid,))
    PDB.bump("ad_clicks")
    return RedirectResponse(_http_url(ad["target_url"], allow_empty=False, allow_upload=False), status_code=302)


# ========================================================================= AFFILIATES
@router.get("/api/affiliates")
async def list_affiliates(lang: str = "en", category: str = ""):
    rows = PDB.query("SELECT * FROM affiliates WHERE active=1 AND (lang='all' OR lang=?) ORDER BY sort, created_at DESC", (lang,))
    if category:
        rows = [r for r in rows if r["category"] == category]
    return [_aff_public(r) for r in rows]


@router.get("/api/affiliates/{aid}/go")
async def affiliate_go(aid: str):
    a = PDB.get("affiliates", aid)
    if not a:
        raise HTTPException(404, "Not found")
    PDB.execute("UPDATE affiliates SET clicks=clicks+1 WHERE id=?", (aid,))
    PDB.bump("aff_clicks")
    return RedirectResponse(_http_url(a["url"], allow_empty=False, allow_upload=False), status_code=302)


# ============================================================================== PLANS
def _plan_public(p: Dict) -> Dict:
    p = dict(p)
    try:
        p["features"] = json.loads(p["features"] or "[]")
    except ValueError:
        p["features"] = []
    return p


@router.get("/api/plans")
async def list_plans():
    return [_plan_public(p) for p in PDB.query("SELECT * FROM plans WHERE active=1 ORDER BY sort")]


# ============================================================================ PAYMENTS
class PlanIn(BaseModel):
    plan_id: str


def _activate(payment: Dict) -> Dict:
    if payment["status"] == "paid":
        return PDB.get("users", payment["user_id"])
    plan = PDB.get("plans", payment["plan_id"]) or {"days": 30, "family": 0}
    u = PDB.get("users", payment["user_id"])
    base = max(time.time(), u.get("premium_until") or 0)
    changes = {"premium_until": base + int(plan["days"] or 30) * 86400, "plan_id": payment["plan_id"]}
    if plan.get("family") and not u.get("family_code"):
        changes["family_code"] = secrets.token_hex(3).upper()
    PDB.update("users", u["id"], changes)
    PDB.update("payments", payment["id"], {"status": "paid"})
    PDB.bump(f"revenue_{payment['currency'].lower()}", payment["amount"])
    PDB.bump("payments")
    return PDB.get("users", u["id"])


def _site_url(request: Request) -> str:
    s = PDB.settings()
    return (s["site_url"] or str(request.base_url)).rstrip("/")


@router.post("/api/pay/razorpay/order")
async def razorpay_order(body: PlanIn, user=Depends(require_user)):
    s = PDB.settings()
    plan = PDB.get("plans", body.plan_id)
    if not plan or not plan["active"] or plan["price_inr"] <= 0:
        raise HTTPException(400, "Unknown plan")
    if not (s["razorpay_key_id"] and s["razorpay_key_secret"]):
        raise HTTPException(503, "Razorpay is not set up yet")
    try:
        import asyncio
        order = await asyncio.to_thread(payments.razorpay_create_order, s["razorpay_key_id"], s["razorpay_key_secret"],
                                        plan["price_inr"], new_id("rcpt"), {"user_id": user["id"], "plan_id": plan["id"]})
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    PDB.insert("payments", {"id": new_id("pay"), "user_id": user["id"], "plan_id": plan["id"], "provider": "razorpay",
                            "provider_ref": order["id"], "amount": plan["price_inr"], "currency": "INR",
                            "status": "created", "created_at": now_iso()})
    return {"order_id": order["id"], "key_id": s["razorpay_key_id"], "amount": order["amount"], "currency": "INR",
            "name": s["site_name"], "description": plan["name"], "email": user["email"]}


class RazorpayVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/api/pay/razorpay/verify")
async def razorpay_verify(body: RazorpayVerifyIn, user=Depends(require_user)):
    s = PDB.settings()
    rows = PDB.query("SELECT * FROM payments WHERE provider='razorpay' AND provider_ref=? AND user_id=?",
                     (body.razorpay_order_id, user["id"]))
    if not rows:
        raise HTTPException(404, "Order not found")
    if not payments.razorpay_verify(s["razorpay_key_secret"], rows[0]["provider_ref"], body.razorpay_payment_id,
                                    body.razorpay_signature):
        raise HTTPException(400, "Payment signature invalid")
    u = _activate(rows[0])
    return {"ok": True, "user": public_user(u)}


@router.post("/api/pay/stripe/checkout")
async def stripe_checkout(body: PlanIn, request: Request, user=Depends(require_user)):
    s = PDB.settings()
    plan = PDB.get("plans", body.plan_id)
    if not plan or not plan["active"] or plan["price_usd"] <= 0:
        raise HTTPException(400, "Unknown plan")
    if not s["stripe_secret_key"]:
        raise HTTPException(503, "Stripe is not set up yet")
    site = _site_url(request)
    try:
        import asyncio
        sess = await asyncio.to_thread(payments.stripe_checkout, s["stripe_secret_key"], plan["price_usd"], plan["name"],
                                       user["id"], plan["id"], f"{site}/premium/?session_id={{CHECKOUT_SESSION_ID}}",
                                       f"{site}/premium/?cancelled=1", user["email"])
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    PDB.insert("payments", {"id": new_id("pay"), "user_id": user["id"], "plan_id": plan["id"], "provider": "stripe",
                            "provider_ref": sess["id"], "amount": plan["price_usd"], "currency": "USD",
                            "status": "created", "created_at": now_iso()})
    return {"url": sess["url"]}


@router.get("/api/pay/stripe/confirm")
async def stripe_confirm(session_id: str, user=Depends(require_user)):
    s = PDB.settings()
    rows = PDB.query("SELECT * FROM payments WHERE provider='stripe' AND provider_ref=? AND user_id=?", (session_id, user["id"]))
    if not rows:
        raise HTTPException(404, "Payment not found")
    import asyncio
    sess = await asyncio.to_thread(payments.stripe_get_session, s["stripe_secret_key"], session_id)
    if sess.get("payment_status") != "paid" or sess.get("client_reference_id") != user["id"]:
        return {"ok": False, "status": sess.get("payment_status")}
    return {"ok": True, "user": public_user(_activate(rows[0]))}


@router.post("/api/pay/stripe/webhook")
async def stripe_webhook(request: Request):
    s = PDB.settings()
    payload = await request.body()
    ev = payments.stripe_verify_webhook(payload, request.headers.get("stripe-signature", ""), s["stripe_webhook_secret"]) \
        if s["stripe_webhook_secret"] else None
    if not ev:
        raise HTTPException(400, "Invalid signature")
    if ev.get("type") == "checkout.session.completed":
        obj = ev["data"]["object"]
        rows = PDB.query("SELECT * FROM payments WHERE provider='stripe' AND provider_ref=?", (obj.get("id"),))
        if rows and obj.get("payment_status") == "paid":
            _activate(rows[0])
    return {"received": True}


# ============================================================================ REPORTS
class ReportIn(BaseModel):
    kind: str = Field(..., pattern="^(url|phone|upi|email|app|social|other)$")
    value: str = Field(..., min_length=3, max_length=300)
    description: str = Field(default="", max_length=2000)
    amount_lost: float = Field(default=0, ge=0, le=1e9)
    city: str = Field(default="", max_length=80)
    lang: str = "en"


@router.post("/api/reports")
async def create_report(body: ReportIn, request: Request, user=Depends(_optional_user)):
    _rl(request)
    s = PDB.settings()
    rid = new_id("rep")
    norm_kind = {"url": "url", "phone": "phone", "upi": "upi", "email": "email"}.get(body.kind, body.kind)
    PDB.insert("reports", {"id": rid, "kind": body.kind, "value": body.value.strip(), "value_norm": checker.normalise(norm_kind, body.value),
                           "description": body.description.strip(), "amount_lost": body.amount_lost, "city": body.city.strip(),
                           "lang": body.lang, "status": "approved" if s["community_auto_publish"] else "pending",
                           "reporter_id": (user or {}).get("id", ""), "ip_hash": _ip_hash(request), "created_at": now_iso()})
    PDB.bump("reports")
    if user:
        from . import product3  # noqa: PLC0415 (late import: product3 imports this module)
        product3.on_report_filed(user["id"])
    return {"ok": True, "id": rid, "status": "approved" if s["community_auto_publish"] else "pending"}


@router.get("/api/reports/recent")
async def recent_reports(limit: int = 30, kind: str = ""):
    sql = "SELECT id, kind, value, description, amount_lost, city, created_at FROM reports WHERE status='approved'"
    params: List[Any] = []
    if kind:
        sql += " AND kind=?"
        params.append(kind)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(max(1, min(limit, 100)))
    rows = PDB.query(sql, params)
    counts = {r["value_norm"]: r["c"] for r in PDB.query(
        "SELECT value_norm, COUNT(*) c FROM reports WHERE status='approved' GROUP BY value_norm")}
    for r in rows:
        r["times_reported"] = counts.get(checker.normalise(r["kind"], r["value"]), 1)
    return rows


@router.get("/api/reports/stats")
async def report_stats():
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    by_kind = PDB.query("SELECT kind, COUNT(*) c FROM reports WHERE status='approved' AND created_at>=? GROUP BY kind", (since,))
    lost = PDB.scalar("SELECT COALESCE(SUM(amount_lost),0) FROM reports WHERE status='approved'") or 0
    top = PDB.query("SELECT kind, value, COUNT(*) c FROM reports WHERE status='approved' GROUP BY value_norm ORDER BY c DESC LIMIT 10")
    return {"by_kind": by_kind, "amount_lost": lost, "top": top}


# ============================================================================= FAMILY
class JoinIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


@router.get("/api/family")
async def family(user=Depends(require_user)):
    if not user.get("family_code"):
        return {"code": "", "members": []}
    rows = PDB.query("SELECT id, name, email, role FROM users WHERE family_code=?", (user["family_code"],))
    return {"code": user["family_code"], "members": [
        {"id": r["id"], "name": r["name"] or r["email"].split("@")[0], "email": r["email"][:3] + "•••", "me": r["id"] == user["id"]}
        for r in rows]}


@router.post("/api/family/create")
async def family_create(user=Depends(require_user)):
    if not is_premium(user):
        raise HTTPException(402, "Family protection is part of the Family plan")
    code = user.get("family_code") or secrets.token_hex(3).upper()
    PDB.update("users", user["id"], {"family_code": code})
    return {"code": code}


@router.post("/api/family/join")
async def family_join(body: JoinIn, user=Depends(require_user)):
    code = body.code.strip().upper()
    owners = PDB.query("SELECT * FROM users WHERE family_code=?", (code,))
    if not owners:
        raise HTTPException(404, "Family code not found")
    if len(owners) >= 6:
        raise HTTPException(400, "This family already has 6 members")
    PDB.update("users", user["id"], {"family_code": code})
    return {"ok": True, "code": code}


@router.post("/api/family/leave")
async def family_leave(user=Depends(require_user)):
    PDB.update("users", user["id"], {"family_code": ""})
    return {"ok": True}


class EndpointIn(BaseModel):
    endpoint: str = Field(..., max_length=1024)


@router.post("/api/push/link")
async def push_link(body: EndpointIn, user=Depends(require_user)):
    PDB.execute("INSERT OR REPLACE INTO push_user VALUES (?,?)", (body.endpoint, user["id"]))
    return {"ok": True}


# ======================================================================== UPLOADS (served)
@router.get("/uploads/{name}")
async def uploaded(name: str):
    if not re.fullmatch(r"[a-f0-9]{24}\.(png|jpg|jpeg|webp|gif|mp4)", name):
        raise HTTPException(404)
    p = UPLOAD_DIR / name
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, headers={"Cache-Control": "public, max-age=604800"})


# =============================================================================== ADMIN
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin_user)])

ENTITY_FIELDS = {
    "content": {"kind", "title", "summary", "body", "video_url", "image_url", "lang", "category", "published", "pinned", "premium_only"},
    "ads": {"name", "advertiser", "kind", "placement", "title", "body", "image_url", "video_url", "cta", "target_url", "lang",
            "start_at", "end_at", "weight", "active", "price_note"},
    "affiliates": {"name", "category", "description", "logo_url", "url", "badge", "price_note", "lang", "active", "sort"},
    "plans": {"name", "price_inr", "price_usd", "days", "features", "highlight", "family", "active", "sort"},
}
URL_FIELDS = {"video_url", "image_url", "target_url", "logo_url", "url"}
PREFIX = {"content": "cnt", "ads": "ad", "affiliates": "aff", "plans": "plan"}


def _clean(entity: str, data: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in data.items():
        if k not in ENTITY_FIELDS[entity]:
            continue
        if k in URL_FIELDS:
            v = _http_url(str(v or ""))
        if k == "features" and isinstance(v, list):
            v = json.dumps([str(x)[:120] for x in v][:20])
        if isinstance(v, bool):
            v = int(v)
        if isinstance(v, str):
            v = v[:20000]
        out[k] = v
    if entity in ("content", "ads", "affiliates") and not (out.get("title") or out.get("name") or data.get("id")):
        pass
    return out


@admin.get("/overview")
async def overview():
    now = time.time()
    since30 = (datetime.now(timezone.utc) - timedelta(days=29)).strftime("%Y-%m-%d")
    series = {}
    for r in PDB.query("SELECT day, key, value FROM stats WHERE day>=?", (since30,)):
        series.setdefault(r["day"], {})[r["key"]] = r["value"]
    days = [(datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    ts = [{"day": d[5:], **{k: series.get(d, {}).get(k, 0) for k in
           ("checks", "signups", "ad_impressions", "ad_clicks", "aff_clicks", "revenue_inr", "revenue_usd", "reports")}} for d in days]
    tot = lambda k: sum(x[k] for x in ts)  # noqa: E731
    imp, clk = PDB.scalar("SELECT COALESCE(SUM(impressions),0) FROM ads"), PDB.scalar("SELECT COALESCE(SUM(clicks),0) FROM ads")
    return {
        "users": PDB.scalar("SELECT COUNT(*) FROM users"),
        "premium_users": PDB.scalar("SELECT COUNT(*) FROM users WHERE premium_until>?", (now,)),
        "revenue_inr": PDB.scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND currency='INR'"),
        "revenue_usd": PDB.scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND currency='USD'"),
        "checks_30d": tot("checks"), "signups_30d": tot("signups"),
        "ad_impressions": imp, "ad_clicks": clk, "ad_ctr": round(100 * clk / imp, 2) if imp else 0,
        "aff_clicks": PDB.scalar("SELECT COALESCE(SUM(clicks),0) FROM affiliates"),
        "pending_reports": PDB.scalar("SELECT COUNT(*) FROM reports WHERE status='pending'"),
        "pending_orders": PDB.scalar("SELECT COUNT(*) FROM orders WHERE status='pending'"),
        "pending_users": PDB.scalar("SELECT COUNT(*) FROM users WHERE status='pending'"),
        "sos_30d": PDB.scalar("SELECT COUNT(*) FROM sos_events WHERE created_at>=?", (since30,)),
        "codes_redeemed": PDB.scalar("SELECT COALESCE(SUM(uses),0) FROM redeem_codes"),
        "content_items": PDB.scalar("SELECT COUNT(*) FROM content"),
        "content_views": PDB.scalar("SELECT COALESCE(SUM(views),0) FROM content"),
        "top_ads": PDB.query("SELECT id, name, advertiser, impressions, clicks FROM ads ORDER BY clicks DESC LIMIT 5"),
        "top_affiliates": PDB.query("SELECT id, name, clicks FROM affiliates ORDER BY clicks DESC LIMIT 5"),
        "series": ts,
    }


for _entity in ("content", "ads", "affiliates", "plans"):
    def _make(entity: str):
        @admin.get(f"/{entity}")
        async def _list():
            order = "sort" if entity in ("plans", "affiliates") else "created_at DESC"
            rows = PDB.query(f"SELECT * FROM {entity} ORDER BY {order}")
            return [_plan_public(r) for r in rows] if entity == "plans" else rows

        @admin.post(f"/{entity}")
        async def _create(data: Dict[str, Any]):
            row = _clean(entity, data)
            row["id"] = new_id(PREFIX[entity]) if entity != "plans" else re.sub(r"[^a-z0-9_]", "_", str(data.get("id") or new_id("plan")).lower())[:40]
            if entity in ("content",):
                row.setdefault("created_at", now_iso())
                row["updated_at"] = now_iso()
            elif entity in ("ads", "affiliates", "programs", "challenges"):
                row["created_at"] = now_iso()
            if entity == "affiliates" and not row.get("url"):
                raise HTTPException(400, "Affiliate link is required")
            PDB.insert(entity, row)
            return PDB.get(entity, row["id"])

        @admin.put(f"/{entity}/{{rid}}")
        async def _update(rid: str, data: Dict[str, Any]):
            row = _clean(entity, data)
            if entity == "content":
                row["updated_at"] = now_iso()
            if not PDB.get(entity, rid):
                raise HTTPException(404, "Not found")
            PDB.update(entity, rid, row)
            return PDB.get(entity, rid)

        @admin.delete(f"/{entity}/{{rid}}")
        async def _delete(rid: str):
            if entity == "plans" and rid == "free":
                raise HTTPException(400, "The Free plan can be edited but not deleted")
            return {"deleted": PDB.delete(entity, rid)}
    _make(_entity)


@admin.get("/reports")
async def admin_reports(status: str = "pending"):
    return PDB.query("SELECT * FROM reports WHERE status=? ORDER BY created_at DESC LIMIT 500", (status,))


class StatusIn(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|pending)$")


@admin.post("/reports/{rid}/status")
async def admin_report_status(rid: str, body: StatusIn):
    PDB.update("reports", rid, {"status": body.status, "reviewed_at": now_iso()})
    return {"ok": True}


@admin.get("/users")
async def admin_users(q: str = ""):
    rows = PDB.query("SELECT * FROM users WHERE email LIKE ? OR name LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT 300",
                     (f"%{q}%", f"%{q}%", f"%{q}%"))
    return [public_user(r) | {"created_at": r["created_at"], "last_login": r["last_login"], "disabled": r["disabled"]} for r in rows]


@admin.get("/users/pending")
async def admin_users_pending():
    return [public_user(r) | {"created_at": r["created_at"]} for r in PDB.query("SELECT * FROM users WHERE status='pending' ORDER BY created_at DESC")]


class UserAdminIn(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(user|admin)$")
    add_premium_days: Optional[int] = Field(default=None, ge=-3650, le=3650)
    disabled: Optional[bool] = None


@admin.patch("/users/{uid}")
async def admin_user_update(uid: str, body: UserAdminIn):
    u = PDB.get("users", uid)
    if not u:
        raise HTTPException(404, "Not found")
    ch: Dict[str, Any] = {}
    if body.role:
        ch["role"] = body.role
    if body.disabled is not None:
        ch["disabled"] = int(body.disabled)
    if body.add_premium_days:
        ch["premium_until"] = max(time.time(), u.get("premium_until") or 0) + body.add_premium_days * 86400
    PDB.update("users", uid, ch)
    return public_user(PDB.get("users", uid))


@admin.get("/payments")
async def admin_payments():
    return PDB.query("SELECT p.*, u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 500")


def _mask(v: str) -> str:
    return ("••••" + v[-4:]) if v else ""


@admin.get("/settings")
async def admin_settings():
    s = PDB.settings()
    return {k: (_mask(v) if k in SECRET_SETTINGS else v) for k, v in s.items()}


@admin.put("/settings")
async def admin_settings_update(data: Dict[str, Any]):
    clean = {}
    for k, v in data.items():
        if k in SECRET_SETTINGS and isinstance(v, str) and v.startswith("••••"):
            continue  # unchanged masked secret
        if k == "free_daily_limit":
            v = max(0, min(int(v), 100000))
        if k == "site_url":
            v = _http_url(str(v), allow_upload=False).rstrip("/")
        clean[k] = v
    PDB.set_settings(clean)
    return await admin_settings()


@admin.get("/providers")
async def admin_providers():
    out = []
    for name, m in providers.FEEDS.items():
        cfg = PDB.provider_cfg(name)
        out.append({"name": name, "type": "feed", "label": m["label"], "site": m["site"], "note": m.get("note", ""),
                    "enabled": cfg.get("enabled", m["default"]), "needs_key": False, "free": "Free, no key"})
    for name, m in providers.LOOKUPS.items():
        cfg = PDB.provider_cfg(name)
        out.append({"name": name, "type": "lookup", "label": m["label"], "site": m["signup"], "free": m["free"],
                    "checks": m["types"], "enabled": bool(cfg.get("enabled")), "needs_key": True,
                    "api_key": _mask(cfg.get("api_key", ""))})
    return out


class ProviderIn(BaseModel):
    enabled: bool
    api_key: Optional[str] = Field(default=None, max_length=300)


@admin.put("/providers/{name}")
async def admin_provider_update(name: str, body: ProviderIn):
    if name not in providers.FEEDS and name not in providers.LOOKUPS:
        raise HTTPException(404, "Unknown provider")
    cfg = PDB.provider_cfg(name)
    cfg["enabled"] = body.enabled
    if body.api_key is not None and not body.api_key.startswith("••••"):
        cfg["api_key"] = body.api_key.strip()
    PDB.set_provider_cfg(name, cfg)
    if name in providers.FEEDS:
        PDB.execute("INSERT OR REPLACE INTO settings VALUES ('feeds_dirty','1')")
    return {"ok": True}


@admin.post("/providers/{name}/test")
async def admin_provider_test(name: str):
    if name not in providers.LOOKUPS:
        raise HTTPException(400, "Only API lookups can be tested")
    key = PDB.provider_cfg(name).get("api_key")
    if not key:
        raise HTTPException(400, "Add an API key first")
    return await providers.test_provider(name, key)


class UploadIn(BaseModel):
    filename: str = Field(..., max_length=200)
    data_base64: str = Field(..., max_length=8_000_000)


@admin.post("/upload")
async def admin_upload(body: UploadIn):
    ext = body.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp", "gif", "mp4"):
        raise HTTPException(400, "Only images (png/jpg/webp/gif) or mp4")
    try:
        raw = base64.b64decode(body.data_base64.split(",", 1)[-1], validate=False)
    except Exception:
        raise HTTPException(400, "Bad file")
    if len(raw) > 5_500_000:
        raise HTTPException(400, "Max 5 MB")
    name = f"{secrets.token_hex(12)}.{ext}"
    (UPLOAD_DIR / name).write_bytes(raw)
    return {"url": f"/uploads/{name}"}

"""Razorpay (India: UPI, cards, wallets) and Stripe (international) — REST, no SDKs.

Keys are entered by the admin in Admin → Payments and stored server-side only.
Premium is sold as time-boxed passes (30 days / 1 year): each successful
payment extends `premium_until`. No card data ever touches this server.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple


def _req(url: str, *, method="GET", data: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None) -> Tuple[int, Dict]:
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310 - fixed gateway hosts
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


# ----------------------------------------------------------------------------- Razorpay
def razorpay_create_order(key_id: str, key_secret: str, amount_inr: float, receipt: str, notes: Dict[str, str]) -> Dict:
    auth = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    body = json.dumps({"amount": int(round(amount_inr * 100)), "currency": "INR", "receipt": receipt[:40],
                       "notes": notes}).encode()
    st, d = _req("https://api.razorpay.com/v1/orders", method="POST", data=body,
                 headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"})
    if st not in (200, 201) or "id" not in d:
        raise RuntimeError(d.get("error", {}).get("description", f"Razorpay error {st}"))
    return d


def razorpay_verify(key_secret: str, order_id: str, payment_id: str, signature: str) -> bool:
    calc = hmac.new(key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(calc, signature or "")


# ------------------------------------------------------------------------------- Stripe
def stripe_checkout(secret: str, amount_usd: float, plan_name: str, user_id: str, plan_id: str,
                    success_url: str, cancel_url: str, email: str = "") -> Dict:
    form = {
        "mode": "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(int(round(amount_usd * 100))),
        "line_items[0][price_data][product_data][name]": f"ProblemHunt {plan_name}",
        "line_items[0][quantity]": "1",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": user_id,
        "metadata[plan_id]": plan_id,
        "metadata[user_id]": user_id,
    }
    if email:
        form["customer_email"] = email
    st, d = _req("https://api.stripe.com/v1/checkout/sessions", method="POST",
                 data=urllib.parse.urlencode(form).encode(),
                 headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/x-www-form-urlencoded"})
    if st != 200 or "url" not in d:
        raise RuntimeError(d.get("error", {}).get("message", f"Stripe error {st}"))
    return d


def stripe_get_session(secret: str, session_id: str) -> Dict:
    st, d = _req(f"https://api.stripe.com/v1/checkout/sessions/{urllib.parse.quote(session_id)}",
                 headers={"Authorization": f"Bearer {secret}"})
    if st != 200:
        raise RuntimeError(d.get("error", {}).get("message", f"Stripe error {st}"))
    return d


def stripe_verify_webhook(payload: bytes, sig_header: str, secret: str, tolerance: int = 300) -> Optional[Dict]:
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        t = parts["t"]
        expected = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
        sigs = [v for k, v in (p.split("=", 1) for p in sig_header.split(",")) if k == "v1"]
        if not any(hmac.compare_digest(expected, s) for s in sigs):
            return None
        if abs(time.time() - int(t)) > tolerance:
            return None
        return json.loads(payload)
    except Exception:
        return None

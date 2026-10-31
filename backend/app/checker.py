"""'Check anything' logic: detects what the user pasted and scores identifiers
that are not links/messages (phone numbers, UPI IDs, emails, IP addresses)."""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

from .detection import ENGINE, severity_for

EMAIL_RE = re.compile(r"^[\w.+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$")
UPI_RE = re.compile(r"^[\w.\-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$")
PHONE_RE = re.compile(r"^\+?\d{10,15}$")
IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
URLISH_RE = re.compile(r"^(https?://|hxxps?://|www\.)\S+$|^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(/\S*)?$", re.I)

KNOWN_UPI_HANDLES = {
    "ybl", "ibl", "axl", "okaxis", "okhdfcbank", "oksbi", "okicici", "paytm", "ptyes", "ptaxis", "pthdfc", "ptsbi",
    "apl", "yapl", "upi", "sbi", "icici", "hdfcbank", "axisbank", "kotak", "barodampay", "pnb", "boi", "cnrb",
    "federal", "idfcbank", "indus", "kbl", "aubank", "jupiteraxis", "slice", "fbl", "airtel", "freecharge", "jio",
    "naviaxis", "superyes", "waicici", "wahdfcbank", "waaxis", "wasbi", "rbl", "yesbank", "dbs", "citi", "hsbc",
}
UPI_BAIT = re.compile(r"refund|cashback|prize|reward|kyc|support|helpdesk|help\.?desk|customer|care|lottery|winner|gift|"
                      r"claim|bonus|offer|electricity|bill|customs|police|loan", re.I)
OFFICIAL_WORDS = re.compile(r"bank|support|help|care|official|kyc|refund|customs|police|govt|gov|income.?tax|hr|"
                            r"recruit|verify|security|paypal|amazon|sbi|hdfc|icici|axis|paytm|phonepe", re.I)
FREE_MAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "protonmail.com", "rediffmail.com",
             "ymail.com", "aol.com", "icloud.com", "mail.com", "gmx.com", "zoho.com", "yandex.com"}


def detect_kind(text: str, hint: str = "auto") -> str:
    if hint and hint != "auto":
        return {"message": "message", "url": "url", "qr": "qr", "audio_transcript": "audio_transcript",
                "phone": "phone", "upi": "upi", "email": "email", "ip": "ip"}.get(hint, "message")
    t = text.strip()
    compact = re.sub(r"[\s\-()]", "", t)
    if t.lower().startswith("upi://"):
        return "qr"
    if IP_RE.match(t):
        return "ip"
    if PHONE_RE.match(compact):
        return "phone"
    if " " not in t and EMAIL_RE.match(t):
        return "email"
    if " " not in t and UPI_RE.match(t):
        return "upi"
    if " " not in t and URLISH_RE.match(t):
        return "url"
    return "message"


def normalise(kind: str, value: str) -> str:
    v = value.strip().lower()
    if kind == "phone":
        d = re.sub(r"\D", "", v)
        return d[-10:] if len(d) >= 10 else d
    if kind in ("url", "qr"):
        m = re.search(r"(?:https?://|hxxps?://)?([^/\s?#]+)", v)
        host = (m.group(1) if m else v).split("@")[-1].split(":")[0]
        return host.removeprefix("www.")
    return v


def score_identifier(kind: str, value: str) -> Tuple[int, str, List[str]]:
    """Heuristic score for phone / upi / email / ip. Returns (score, category, indicators)."""
    v = value.strip()
    ind: List[str] = []
    score = 0
    category = "impersonation"
    if kind == "upi":
        category = "payment_fraud"
        name, _, handle = v.partition("@")
        if UPI_BAIT.search(name):
            score += 40
            ind.append("UPI name uses refund / prize / support words (common in payment traps)")
        if handle.lower() not in KNOWN_UPI_HANDLES:
            score += 10
            ind.append(f"Unusual UPI handle '@{handle}'")
        if re.search(r"\d{6,}", name):
            score += 5
            ind.append("Long number inside the UPI name")
    elif kind == "email":
        local, _, domain = v.lower().partition("@")
        if domain in FREE_MAIL and OFFICIAL_WORDS.search(local):
            score += 40
            ind.append(f"Official-sounding name on a free {domain} mailbox — banks and companies don't do this")
        a = ENGINE.analyse("http://" + domain, "url")
        if a.score:
            score += a.score
            ind.extend(i for i in a.indicators[:3])
            category = "phishing_link" if a.score >= 30 else category
    elif kind == "phone":
        category = "impersonation"
        digits = re.sub(r"\D", "", v)
        if v.startswith("+") and not digits.startswith(("91", "1", "44", "61", "971", "65")):
            score += 10
            ind.append("International number — be careful if the caller claims to be a local bank, police or company")
        if digits.startswith("140") or digits[-10:].startswith("140"):
            score += 5
            ind.append("140-series number (telemarketing range in India)")
    elif kind == "ip":
        category = "malware"
    return min(score, 100), category, ind


def verdict_for(score: int) -> str:
    return "malicious" if score >= 60 else "suspicious" if score >= 30 else "safe"


def apply_community(score: int, approved: int, pending: int, ind: List[str]) -> int:
    if approved:
        score = max(score, min(95, 55 + approved * 10))
        ind.insert(0, f"Reported as a scam by {approved} people (verified by moderators)")
    elif pending:
        score += min(25, pending * 8)
        ind.append(f"{pending} unverified community report(s)")
    return min(score, 100)


def apply_providers(score: int, results: List[Dict], ind: List[str]) -> int:
    for r in results:
        if r["status"] == "malicious":
            score = max(score, 90)
            ind.insert(0, f"{r['label']}: {r['detail']}")
        elif r["status"] == "suspicious":
            score = max(score, min(100, score + 20), 45)
            ind.append(f"{r['label']}: {r['detail']}")
    return min(score, 100)


__all__ = ["detect_kind", "normalise", "score_identifier", "verdict_for", "apply_community", "apply_providers",
           "severity_for"]

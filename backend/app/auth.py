"""Accounts & sessions. Standard library only (scrypt + HMAC-signed tokens)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from . import config

TOKEN_DAYS = 30
_secret_file = config.DATA_DIR / "auth_secret"
if os.getenv("PH_AUTH_SECRET"):
    SECRET = os.environ["PH_AUTH_SECRET"].encode()
else:
    if not _secret_file.exists():
        _secret_file.write_text(secrets.token_hex(32))
        try:
            _secret_file.chmod(0o600)
        except OSError:
            pass
    SECRET = _secret_file.read_text().strip().encode()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${_b64(salt)}${_b64(h)}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, salt, h = stored.split("$")
        calc = hashlib.scrypt(pw.encode(), salt=_unb64(salt), n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(calc, _unb64(h))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    body = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_DAYS * 86400}).encode())
    sig = _b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token: str) -> Optional[str]:
    try:
        body, sig = token.split(".")
        good = _b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(_unb64(body))
        return data["uid"] if data.get("exp", 0) > time.time() else None
    except Exception:
        return None


# Wired up in main.py (avoids circular import)
PDB = None


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    premium = (u.get("premium_until") or 0) > time.time()
    email = u["email"] if not str(u["email"]).endswith("@phone.problemhunt") else ""
    return {
        "id": u["id"], "email": email, "phone": u.get("phone") or "", "status": u.get("status") or "active",
        "name": u.get("name", ""), "role": u.get("role", "user"),
        "lang": u.get("lang", "en"), "premium": premium, "premium_until": u.get("premium_until") or 0,
        "plan_id": u.get("plan_id", ""), "family_code": u.get("family_code", ""),
        "scans_total": u.get("scans_total", 0),
        "city": u.get("city") or "", "points": u.get("points") or 0, "streak": u.get("streak") or 0,
        "last_play_day": u.get("last_play_day") or "",
        "mfa": bool(u.get("mfa_enabled")),
    }


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    uid = read_token(authorization.split(" ", 1)[1].strip())
    if not uid:
        return None
    u = PDB.get("users", uid)
    if not u or u.get("disabled"):
        return None
    return u


def require_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    u = current_user(authorization)
    if not u:
        raise HTTPException(401, "Please log in")
    return u


def require_admin_user(
    authorization: Optional[str] = Header(default=None),
    x_admin_token: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if config.ADMIN_TOKEN and x_admin_token and hmac.compare_digest(x_admin_token, config.ADMIN_TOKEN):
        return {"id": "token-admin", "role": "admin", "email": "admin-token"}
    u = current_user(authorization)
    if not u or u.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return u


def is_premium(u: Optional[Dict[str, Any]]) -> bool:
    return bool(u and (u.get("premium_until") or 0) > time.time())

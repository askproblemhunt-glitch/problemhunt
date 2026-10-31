"""ProblemHunt Workplace (v5): organisations, roles, admin MFA, tamper-evident audit log,
awareness courses, safe phishing simulations, privacy-preserving password audit,
compliance mapping, five organisation scores and a board report.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import struct
import time
import urllib.parse
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from . import config, notify, product
from .auth import public_user, require_user
from .platform_db import TABLE_FIELDS, new_id, now_iso
from .product import PDB, _ip_hash, _optional_user, _rl, admin, router
from .workplace_content import (CONTROL_BY_ID, CONTROLS, COURSE_BY_ID, COURSES, FRAMEWORKS, PHISH_TEMPLATES,
                                TEMPLATE_BY_ID)

# ---------------------------------------------------------------- schema
DDL = """
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT DEFAULT '', plan TEXT DEFAULT 'trial', seats INTEGER DEFAULT 50,
  owner_id TEXT, require_mfa INTEGER DEFAULT 1, tech_stack TEXT DEFAULT '[]', invite_code TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY, org_id TEXT, user_id TEXT, role TEXT DEFAULT 'member', dept TEXT DEFAULT '', created_at TEXT,
  pw_checked_at TEXT DEFAULT '', pw_leaked INTEGER DEFAULT 0, pw_strength INTEGER DEFAULT -1, UNIQUE(org_id, user_id));
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, seq INTEGER, ts TEXT, org_id TEXT DEFAULT '', actor_id TEXT DEFAULT '', actor TEXT DEFAULT '',
  action TEXT, target TEXT DEFAULT '', detail TEXT DEFAULT '', ip_hash TEXT DEFAULT '', prev_hash TEXT, hash TEXT);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id, seq);
CREATE TABLE IF NOT EXISTS course_progress (
  id TEXT PRIMARY KEY, user_id TEXT, course_id TEXT, score INTEGER, total INTEGER, completed_at TEXT, UNIQUE(user_id, course_id));
CREATE TABLE IF NOT EXISTS sim_campaigns (
  id TEXT PRIMARY KEY, org_id TEXT, name TEXT, template_id TEXT, status TEXT DEFAULT 'sent', created_by TEXT,
  created_at TEXT, targets INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sim_targets (
  id TEXT PRIMARY KEY, campaign_id TEXT, org_id TEXT, user_id TEXT, token TEXT UNIQUE, channel TEXT DEFAULT '',
  sent_at TEXT DEFAULT '', clicked_at TEXT DEFAULT '', reported_at TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS org_controls (
  org_id TEXT, control_id TEXT, status TEXT DEFAULT 'not_started', owner TEXT DEFAULT '', note TEXT DEFAULT '',
  updated_at TEXT, PRIMARY KEY(org_id, control_id));
CREATE TABLE IF NOT EXISTS org_scores (org_id TEXT, day TEXT, data TEXT, PRIMARY KEY(org_id, day));
"""
USER_COLS = ["ALTER TABLE users ADD COLUMN mfa_secret TEXT DEFAULT ''", "ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0"]


def _ensure_schema() -> None:
    with PDB._lock:
        PDB.db.executescript(DDL)
        for m in USER_COLS:
            try:
                PDB.db.execute(m)
            except Exception:
                pass
        PDB.db.commit()
        for t in ("orgs", "org_members", "audit_log", "course_progress", "sim_campaigns", "sim_targets", "users"):
            TABLE_FIELDS[t] = [r["name"] for r in PDB.db.execute(f"PRAGMA table_info({t})")]


_ensure_schema()


# ---------------------------------------------------------------- TOTP (RFC 6238, stdlib only)
def _totp(secret_b32: str, t: Optional[float] = None, step: int = 30, digits: int = 6) -> str:
    key = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8), casefold=True)
    counter = int((t or time.time()) // step)
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[o:o + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def totp_ok(secret_b32: str, code: str) -> bool:
    code = re.sub(r"\D", "", code or "")
    if len(code) != 6 or not secret_b32:
        return False
    now = time.time()
    return any(hmac.compare_digest(_totp(secret_b32, now + d * 30), code) for d in (-1, 0, 1))


def mfa_gate(user: Dict[str, Any], code: Optional[str]) -> None:
    """Called by every login path: users with 2-step verification must give a valid code."""
    if user.get("mfa_enabled"):
        if not code:
            raise HTTPException(401, "MFA_REQUIRED: enter the 6-digit code from your authenticator app")
        if not totp_ok(user.get("mfa_secret", ""), code):
            raise HTTPException(401, "MFA_REQUIRED: that code is not valid — try the newest one")


# ---------------------------------------------------------------- audit log (hash-chained)
def audit(action: str, *, org_id: str = "", actor: Optional[Dict] = None, target: str = "", detail: Any = "",
          request: Optional[Request] = None) -> None:
    with PDB._lock:
        last = PDB.query("SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1")
        seq = (last[0]["seq"] + 1) if last else 1
        prev = last[0]["hash"] if last else "0" * 64
        row = {"id": new_id("aud"), "seq": seq, "ts": now_iso(), "org_id": org_id, "actor_id": (actor or {}).get("id", ""),
               "actor": (actor or {}).get("email", "") or (actor or {}).get("phone", ""), "action": action, "target": target,
               "detail": detail if isinstance(detail, str) else json.dumps(detail)[:2000],
               "ip_hash": _ip_hash(request) if request else ""}
        body = json.dumps({k: row[k] for k in sorted(row) if k != "id"}, sort_keys=True)
        row["prev_hash"] = prev
        row["hash"] = hashlib.sha256((prev + body).encode()).hexdigest()
        PDB.insert("audit_log", row)


def verify_chain(rows: List[Dict[str, Any]]) -> bool:
    for r in rows:
        body = json.dumps({k: r[k] for k in sorted(r) if k not in ("id", "prev_hash", "hash")}, sort_keys=True)
        if hashlib.sha256((r["prev_hash"] + body).encode()).hexdigest() != r["hash"]:
            return False
    return True


# ---------------------------------------------------------------- MFA routes
@router.get("/api/me/mfa")
async def mfa_status(user=Depends(require_user)):
    return {"enabled": bool(user.get("mfa_enabled"))}


@router.post("/api/me/mfa/setup")
async def mfa_setup(user=Depends(require_user)):
    if user.get("mfa_enabled"):
        raise HTTPException(400, "2-step verification is already on")
    secret = base64.b32encode(os.urandom(20)).decode().rstrip("=")
    PDB.update("users", user["id"], {"mfa_secret": secret})
    label = urllib.parse.quote(f"ProblemHunt:{user.get('email') or user.get('phone') or user['id']}")
    return {"secret": secret, "otpauth": f"otpauth://totp/{label}?secret={secret}&issuer=ProblemHunt&digits=6&period=30"}


class CodeIn(BaseModel):
    code: str = Field(..., max_length=12)


@router.post("/api/me/mfa/enable")
async def mfa_enable(body: CodeIn, request: Request, user=Depends(require_user)):
    if not totp_ok(user.get("mfa_secret", ""), body.code):
        raise HTTPException(400, "That code is not valid. Check the time on your phone and try the newest code.")
    PDB.update("users", user["id"], {"mfa_enabled": 1})
    audit("mfa.enabled", actor=user, org_id=_org_id(user), request=request)
    return {"enabled": True}


@router.post("/api/me/mfa/disable")
async def mfa_disable(body: CodeIn, request: Request, user=Depends(require_user)):
    if not totp_ok(user.get("mfa_secret", ""), body.code):
        raise HTTPException(400, "That code is not valid")
    PDB.update("users", user["id"], {"mfa_enabled": 0, "mfa_secret": ""})
    audit("mfa.disabled", actor=user, org_id=_org_id(user), request=request)
    return {"enabled": False}


# ---------------------------------------------------------------- organisation helpers
def _membership(user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    r = PDB.query("SELECT * FROM org_members WHERE user_id=? LIMIT 1", (user["id"],))
    return r[0] if r else None


def _org_id(user: Dict[str, Any]) -> str:
    m = _membership(user)
    return m["org_id"] if m else ""


def require_member(user=Depends(require_user)):
    m = _membership(user)
    if not m:
        raise HTTPException(404, "You are not in an organisation yet")
    org = PDB.get("orgs", m["org_id"])
    return {"user": user, "member": m, "org": org}


def require_org_admin(ctx=Depends(require_member)):
    if ctx["member"]["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Only organisation admins can do this")
    if ctx["org"].get("require_mfa") and not ctx["user"].get("mfa_enabled"):
        raise HTTPException(403, "MFA_SETUP_REQUIRED: turn on 2-step verification in your account to manage the organisation")
    return ctx


def _invite_code() -> str:
    a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "ORG-" + "".join(secrets.choice(a) for _ in range(6))


# ---------------------------------------------------------------- organisation routes
class OrgIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    domain: str = Field(default="", max_length=120)
    seats: int = Field(default=50, ge=1, le=100000)


@router.post("/api/org")
async def create_org(body: OrgIn, request: Request, user=Depends(require_user)):
    if _membership(user):
        raise HTTPException(400, "You are already in an organisation")
    oid = new_id("org")
    PDB.insert("orgs", {"id": oid, "name": body.name.strip(), "domain": body.domain.strip().lower(), "plan": "trial",
                        "seats": body.seats, "owner_id": user["id"], "require_mfa": 1, "tech_stack": "[]",
                        "invite_code": _invite_code(), "created_at": now_iso()})
    PDB.insert("org_members", {"id": new_id("om"), "org_id": oid, "user_id": user["id"], "role": "owner", "created_at": now_iso()})
    audit("org.created", org_id=oid, actor=user, target=body.name, request=request)
    return await my_org(user)


class JoinIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=20)


@router.post("/api/org/join")
async def join_org(body: JoinIn, request: Request, user=Depends(require_user)):
    if _membership(user):
        raise HTTPException(400, "You are already in an organisation. Leave it first.")
    org = PDB.query("SELECT * FROM orgs WHERE invite_code=?", (body.code.strip().upper(),))
    if not org:
        raise HTTPException(404, "Invite code not found")
    org = org[0]
    n = PDB.scalar("SELECT COUNT(*) FROM org_members WHERE org_id=?", (org["id"],))
    if n >= (org["seats"] or 0):
        raise HTTPException(403, "This organisation has used all its seats. Ask your admin to add more.")
    PDB.insert("org_members", {"id": new_id("om"), "org_id": org["id"], "user_id": user["id"], "role": "member", "created_at": now_iso()})
    audit("member.joined", org_id=org["id"], actor=user, request=request)
    return await my_org(user)


@router.post("/api/org/leave")
async def leave_org(request: Request, ctx=Depends(require_member)):
    if ctx["member"]["role"] == "owner":
        raise HTTPException(400, "The owner cannot leave. Transfer ownership first.")
    PDB.execute("DELETE FROM org_members WHERE id=?", (ctx["member"]["id"],))
    audit("member.left", org_id=ctx["org"]["id"], actor=ctx["user"], request=request)
    return {"ok": True}


@router.get("/api/org")
async def get_my_org(user=Depends(require_user)):
    return await my_org(user)


async def my_org(user: Dict[str, Any]) -> Dict[str, Any]:
    user = PDB.get("users", user["id"])
    m = _membership(user)
    progress = {r["course_id"]: {"score": r["score"], "total": r["total"]} for r in
                PDB.query("SELECT * FROM course_progress WHERE user_id=?", (user["id"],))}
    if not m:
        return {"org": None, "progress": progress, "mfa_enabled": bool(user.get("mfa_enabled"))}
    org = PDB.get("orgs", m["org_id"])
    is_admin = m["role"] in ("owner", "admin")
    out = {k: org[k] for k in ("id", "name", "domain", "plan", "seats", "require_mfa", "created_at")}
    out["tech_stack"] = json.loads(org.get("tech_stack") or "[]")
    out["members"] = PDB.scalar("SELECT COUNT(*) FROM org_members WHERE org_id=?", (org["id"],))
    if is_admin:
        out["invite_code"] = org["invite_code"]
    return {"org": out, "role": m["role"], "dept": m["dept"], "is_admin": is_admin, "progress": progress,
            "mfa_enabled": bool(user.get("mfa_enabled")), "admin_ready": (not org["require_mfa"]) or bool(user.get("mfa_enabled")),
            "pw_checked": bool(m.get("pw_checked_at")), "courses_total": len(COURSES)}


class OrgPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    domain: Optional[str] = Field(default=None, max_length=120)
    seats: Optional[int] = Field(default=None, ge=1, le=100000)
    require_mfa: Optional[bool] = None
    tech_stack: Optional[List[str]] = None


@router.patch("/api/org")
async def update_org(body: OrgPatch, request: Request, ctx=Depends(require_org_admin)):
    ch: Dict[str, Any] = {}
    if body.name is not None:
        ch["name"] = body.name.strip()
    if body.domain is not None:
        ch["domain"] = body.domain.strip().lower()
    if body.seats is not None:
        ch["seats"] = body.seats
    if body.require_mfa is not None:
        ch["require_mfa"] = int(body.require_mfa)
    if body.tech_stack is not None:
        ch["tech_stack"] = json.dumps([re.sub(r"[^\w .+-]", "", t)[:40] for t in body.tech_stack if t.strip()][:60])
    if ch:
        PDB.update("orgs", ctx["org"]["id"], ch)
        audit("org.updated", org_id=ctx["org"]["id"], actor=ctx["user"], detail=list(ch), request=request)
    return await my_org(ctx["user"])


@router.post("/api/org/invite/rotate")
async def rotate_invite(request: Request, ctx=Depends(require_org_admin)):
    code = _invite_code()
    PDB.update("orgs", ctx["org"]["id"], {"invite_code": code})
    audit("invite.rotated", org_id=ctx["org"]["id"], actor=ctx["user"], request=request)
    return {"invite_code": code}


def _member_rows(org_id: str) -> List[Dict[str, Any]]:
    rows = PDB.query("SELECT m.*, u.name, u.email, u.phone, u.mfa_enabled, u.points FROM org_members m "
                     "JOIN users u ON u.id=m.user_id WHERE m.org_id=? ORDER BY m.created_at", (org_id,))
    courses = {}
    for r in PDB.query("SELECT user_id, COUNT(*) n, SUM(score) s, SUM(total) t FROM course_progress "
                       "WHERE user_id IN (SELECT user_id FROM org_members WHERE org_id=?) GROUP BY user_id", (org_id,)):
        courses[r["user_id"]] = r
    sims = {}
    for r in PDB.query("SELECT user_id, COUNT(*) n, SUM(clicked_at!='') c, SUM(reported_at!='') rep FROM sim_targets "
                       "WHERE org_id=? GROUP BY user_id", (org_id,)):
        sims[r["user_id"]] = r
    out = []
    for r in rows:
        c, s = courses.get(r["user_id"], {}), sims.get(r["user_id"], {})
        email = r["email"] if not str(r["email"]).endswith("@phone.problemhunt") else ""
        out.append({"user_id": r["user_id"], "name": r["name"], "email": email, "phone": r["phone"] or "", "role": r["role"],
                    "dept": r["dept"], "joined": r["created_at"], "mfa": bool(r["mfa_enabled"]),
                    "courses_done": c.get("n", 0), "quiz_pct": round(100 * (c.get("s") or 0) / c["t"]) if c.get("t") else None,
                    "sims": s.get("n", 0), "clicked": s.get("c", 0) or 0, "reported": s.get("rep", 0) or 0,
                    "pw_checked": bool(r["pw_checked_at"]), "pw_leaked": bool(r["pw_leaked"]), "pw_strength": r["pw_strength"]})
    return out


@router.get("/api/org/members")
async def list_members(ctx=Depends(require_org_admin)):
    return _member_rows(ctx["org"]["id"])


class MemberPatch(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(admin|member)$")
    dept: Optional[str] = Field(default=None, max_length=60)


@router.patch("/api/org/members/{uid}")
async def update_member(uid: str, body: MemberPatch, request: Request, ctx=Depends(require_org_admin)):
    m = PDB.query("SELECT * FROM org_members WHERE org_id=? AND user_id=?", (ctx["org"]["id"], uid))
    if not m:
        raise HTTPException(404, "Not a member")
    if m[0]["role"] == "owner" and body.role:
        raise HTTPException(400, "The owner's role cannot be changed")
    ch = {k: v for k, v in body.model_dump().items() if v is not None}
    if ch:
        PDB.update("org_members", m[0]["id"], ch)
        audit("member.updated", org_id=ctx["org"]["id"], actor=ctx["user"], target=uid, detail=ch, request=request)
    return {"ok": True}


@router.delete("/api/org/members/{uid}")
async def remove_member(uid: str, request: Request, ctx=Depends(require_org_admin)):
    m = PDB.query("SELECT * FROM org_members WHERE org_id=? AND user_id=?", (ctx["org"]["id"], uid))
    if not m:
        raise HTTPException(404, "Not a member")
    if m[0]["role"] == "owner":
        raise HTTPException(400, "The owner cannot be removed")
    PDB.execute("DELETE FROM org_members WHERE id=?", (m[0]["id"],))
    audit("member.removed", org_id=ctx["org"]["id"], actor=ctx["user"], target=uid, request=request)
    return {"ok": True}


@router.get("/api/org/audit")
async def org_audit(limit: int = 200, ctx=Depends(require_org_admin)):
    rows = PDB.query("SELECT * FROM audit_log WHERE org_id=? ORDER BY seq DESC LIMIT ?", (ctx["org"]["id"], max(1, min(limit, 1000))))
    whole = PDB.query("SELECT * FROM audit_log ORDER BY seq")
    return {"rows": [{k: r[k] for k in ("seq", "ts", "actor", "action", "target", "detail")} for r in rows],
            "chain_ok": verify_chain(whole)}


# ---------------------------------------------------------------- courses (open to everyone)
@router.get("/api/courses")
async def list_courses(user=Depends(_optional_user)):
    prog = {}
    if user:
        prog = {r["course_id"]: r for r in PDB.query("SELECT * FROM course_progress WHERE user_id=?", (user["id"],))}
    return [{"id": c["id"], "title": c["title"], "title_hi": c.get("title_hi", ""), "minutes": c["minutes"], "level": c["level"],
             "lessons": len(c["lessons"]), "questions": len(c["quiz"]),
             "done": c["id"] in prog, "score": prog.get(c["id"], {}).get("score"), "total": prog.get(c["id"], {}).get("total")}
            for c in COURSES]


@router.get("/api/courses/{cid}")
async def get_course(cid: str):
    c = COURSE_BY_ID.get(cid)
    if not c:
        raise HTTPException(404, "Course not found")
    return {**{k: c[k] for k in ("id", "title", "title_hi", "minutes", "level", "lessons")},
            "quiz": [{"q": q["q"], "options": q["options"]} for q in c["quiz"]]}


class QuizIn(BaseModel):
    answers: List[int] = Field(..., max_length=50)


@router.post("/api/courses/{cid}/submit")
async def submit_quiz(cid: str, body: QuizIn, request: Request, user=Depends(_optional_user)):
    _rl(request)
    c = COURSE_BY_ID.get(cid)
    if not c:
        raise HTTPException(404, "Course not found")
    results, score = [], 0
    for i, q in enumerate(c["quiz"]):
        a = body.answers[i] if i < len(body.answers) else -1
        ok = a == q["answer"]
        score += ok
        results.append({"correct": ok, "answer": q["answer"], "why": q["why"]})
    out = {"score": score, "total": len(c["quiz"]), "results": results, "passed": score * 100 >= 70 * len(c["quiz"])}
    if user:
        prev = PDB.query("SELECT * FROM course_progress WHERE user_id=? AND course_id=?", (user["id"], cid))
        if not prev:
            PDB.insert("course_progress", {"id": new_id("cp"), "user_id": user["id"], "course_id": cid, "score": score,
                                           "total": len(c["quiz"]), "completed_at": now_iso()})
            PDB.execute("UPDATE users SET points=COALESCE(points,0)+? WHERE id=?", (score * 5 + 10, user["id"]))
            out["points"] = score * 5 + 10
        elif score > (prev[0]["score"] or 0):
            PDB.update("course_progress", prev[0]["id"], {"score": score, "completed_at": now_iso()})
        oid = _org_id(user)
        if oid:
            audit("course.completed", org_id=oid, actor=user, target=cid, detail={"score": score, "total": len(c["quiz"])})
    PDB.bump("course_submits")
    return out


# ---------------------------------------------------------------- phishing simulation
@router.get("/api/org/phishing/templates")
async def phish_templates(ctx=Depends(require_org_admin)):
    return PHISH_TEMPLATES


class CampaignIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    template_id: str
    user_ids: List[str] = Field(default_factory=list, max_length=5000)


def _base_url(request: Request) -> str:
    s = PDB.settings()
    return (s.get("site_url") or str(request.base_url)).rstrip("/")


def _is_local(request: Request) -> bool:
    return config.is_local_request(request)


@router.post("/api/org/phishing/campaigns")
async def create_campaign(body: CampaignIn, request: Request, ctx=Depends(require_org_admin)):
    t = TEMPLATE_BY_ID.get(body.template_id)
    if not t:
        raise HTTPException(400, "Unknown template")
    org = ctx["org"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if PDB.scalar("SELECT COUNT(*) FROM sim_campaigns WHERE org_id=? AND created_at>=?", (org["id"], today)) >= 5:
        raise HTTPException(429, "Up to 5 simulations per day")
    members = _member_rows(org["id"])
    if body.user_ids:
        members = [m for m in members if m["user_id"] in set(body.user_ids)]
    if not members:
        raise HTTPException(400, "No members selected")
    cid = new_id("sim")
    PDB.insert("sim_campaigns", {"id": cid, "org_id": org["id"], "name": body.name, "template_id": t["id"], "status": "sent",
                                 "created_by": ctx["user"]["id"], "created_at": now_iso(), "targets": len(members)})
    s = PDB.settings()
    base = _base_url(request)
    previews, sent, skipped = [], 0, 0
    for m in members:
        tok = secrets.token_urlsafe(18)
        click, report = f"{base}/api/sim/c/{tok}", f"{base}/api/sim/r/{tok}"
        text = t["body"].replace("{link}", click) + f"\n\n—\nSomething looks wrong? Report it: {report}"
        channel = "email" if m["email"] else ""
        if channel:
            ok, _ = await asyncio.to_thread(notify.send_email, s, m["email"], t["subject"], f"From: {t['from_name']}\n\n{text}")
            sent += 1
        else:
            skipped += 1
        PDB.insert("sim_targets", {"id": new_id("st"), "campaign_id": cid, "org_id": org["id"], "user_id": m["user_id"], "token": tok,
                                   "channel": channel or "none", "sent_at": now_iso() if channel else ""})
        if not notify.email_ready(s) and _is_local(request) and len(previews) < 20:
            previews.append({"user_id": m["user_id"], "click": click, "report": report})
    audit("phishing.campaign_sent", org_id=org["id"], actor=ctx["user"], target=cid, detail={"template": t["id"], "targets": len(members)}, request=request)
    out = {"id": cid, "sent": sent, "skipped_no_email": skipped}
    if previews:
        out["dev_previews"] = previews  # developer mode only: email is not configured and you are on this computer
    return out


@router.get("/api/org/phishing/campaigns")
async def list_campaigns(ctx=Depends(require_org_admin)):
    rows = PDB.query("SELECT c.*, SUM(t.clicked_at!='') clicked, SUM(t.reported_at!='') reported FROM sim_campaigns c "
                     "LEFT JOIN sim_targets t ON t.campaign_id=c.id WHERE c.org_id=? GROUP BY c.id ORDER BY c.created_at DESC",
                     (ctx["org"]["id"],))
    for r in rows:
        r["template_name"] = TEMPLATE_BY_ID.get(r["template_id"], {}).get("name", r["template_id"])
    return rows


@router.get("/api/sim/c/{token}")
async def sim_click(token: str):
    t = PDB.query("SELECT * FROM sim_targets WHERE token=?", (token,))
    if t:
        if not t[0]["clicked_at"]:
            PDB.update("sim_targets", t[0]["id"], {"clicked_at": now_iso()})
        tpl = PDB.get("sim_campaigns", t[0]["campaign_id"]) or {}
        return RedirectResponse(f"/caught/?t={tpl.get('template_id', '')}", status_code=302)
    return RedirectResponse("/caught/", status_code=302)


@router.get("/api/sim/r/{token}")
async def sim_report(token: str):
    t = PDB.query("SELECT * FROM sim_targets WHERE token=?", (token,))
    if t and not t[0]["reported_at"]:
        PDB.update("sim_targets", t[0]["id"], {"reported_at": now_iso()})
    tpl = PDB.get("sim_campaigns", t[0]["campaign_id"]) if t else {}
    return RedirectResponse(f"/caught/?reported=1&t={(tpl or {}).get('template_id', '')}", status_code=302)


@router.get("/api/sim/template/{tid}")
async def sim_template_public(tid: str):
    t = TEMPLATE_BY_ID.get(tid)
    if not t:
        raise HTTPException(404, "Not found")
    return {k: t[k] for k in ("name", "subject", "from_name", "flags")}


# ---------------------------------------------------------------- password audit (privacy-preserving)
class PwIn(BaseModel):
    leaked: bool
    strength: int = Field(..., ge=0, le=4)


@router.post("/api/org/password-check")
async def password_check(body: PwIn, ctx=Depends(require_member)):
    """The password itself never leaves the device: the browser checks it (k-anonymity) and sends only the result."""
    PDB.update("org_members", ctx["member"]["id"], {"pw_checked_at": now_iso(), "pw_leaked": int(body.leaked), "pw_strength": body.strength})
    return {"ok": True}


# ---------------------------------------------------------------- compliance
class ControlPatch(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(not_started|partial|done|na)$")
    owner: Optional[str] = Field(default=None, max_length=80)
    note: Optional[str] = Field(default=None, max_length=1000)


def _controls(org_id: str, stats: Dict[str, Any]) -> List[Dict[str, Any]]:
    saved = {r["control_id"]: r for r in PDB.query("SELECT * FROM org_controls WHERE org_id=?", (org_id,))}
    out = []
    for c in CONTROLS:
        s = saved.get(c["id"], {})
        status = s.get("status", "not_started")
        auto_note = ""
        if c.get("auto") == "training" and status != "na":
            if stats["training_pct"] >= 80 and stats["sims"] > 0:
                status, auto_note = "done", "Auto: 80%+ staff trained and phishing tests run"
            elif stats["training_pct"] >= 30 and status == "not_started":
                status, auto_note = "partial", f"Auto: {stats['training_pct']}% of staff trained"
        if c["id"] == "C05" and status == "not_started" and stats["admin_mfa"]:
            status, auto_note = "partial", "Auto: organisation admins use 2-step verification"
        out.append({"id": c["id"], "title": c["title"], "weight": c["weight"], "map": c["map"], "status": status,
                    "owner": s.get("owner", ""), "note": s.get("note", ""), "auto_note": auto_note})
    return out


def _coverage(controls: List[Dict[str, Any]]) -> Dict[str, Any]:
    val = {"done": 1, "partial": 0.5, "not_started": 0}
    tot = sum(c["weight"] for c in controls if c["status"] != "na")
    got = sum(c["weight"] * val.get(c["status"], 0) for c in controls if c["status"] != "na")
    per = []
    for f in FRAMEWORKS:
        cs = [c for c in controls if f["id"] in c["map"] and c["status"] != "na"]
        t = sum(c["weight"] for c in cs)
        g = sum(c["weight"] * val.get(c["status"], 0) for c in cs)
        per.append({"id": f["id"], "name": f["name"], "controls": len(cs), "pct": round(100 * g / t) if t else 0})
    return {"pct": round(100 * got / tot) if tot else 0, "frameworks": per}


@router.get("/api/org/compliance")
async def org_compliance(ctx=Depends(require_org_admin)):
    st = _stats(ctx["org"])
    controls = _controls(ctx["org"]["id"], st)
    return {"frameworks": FRAMEWORKS, "controls": controls, "coverage": _coverage(controls),
            "note": "Indicative mapping for self-assessment. Confirm with a qualified auditor before any certification."}


@router.patch("/api/org/compliance/{control_id}")
async def update_control(control_id: str, body: ControlPatch, request: Request, ctx=Depends(require_org_admin)):
    if control_id not in CONTROL_BY_ID:
        raise HTTPException(404, "Unknown control")
    cur = PDB.query("SELECT * FROM org_controls WHERE org_id=? AND control_id=?", (ctx["org"]["id"], control_id))
    row = cur[0] if cur else {"status": "not_started", "owner": "", "note": ""}
    ch = {k: v for k, v in body.model_dump().items() if v is not None}
    row.update(ch)
    PDB.execute("INSERT OR REPLACE INTO org_controls(org_id, control_id, status, owner, note, updated_at) VALUES (?,?,?,?,?,?)",
                (ctx["org"]["id"], control_id, row["status"], row["owner"], row["note"], now_iso()))
    audit("compliance.updated", org_id=ctx["org"]["id"], actor=ctx["user"], target=control_id, detail=ch, request=request)
    return {"ok": True}


# ---------------------------------------------------------------- scores, dashboard, report
def _kev_matches(org: Dict[str, Any]) -> List[Dict[str, Any]]:
    stack = [s.lower() for s in json.loads(org.get("tech_stack") or "[]") if len(s) >= 3]
    if not stack:
        return []
    try:
        rows = PDB.query("SELECT cve, vendor, product, name, date_added, due_date, epss, ransomware FROM intel_cves WHERE kev=1 "
                         "ORDER BY date_added DESC LIMIT 3000")
    except Exception:
        return []
    out = []
    for r in rows:
        hay = f"{r['vendor']} {r['product']}".lower()
        if any(s in hay for s in stack):
            out.append(r)
    since = (datetime.now(timezone.utc) - timedelta(days=120)).strftime("%Y-%m-%d")
    recent = [r for r in out if (r["date_added"] or "") >= since]
    return (recent or out)[:25]


def _stats(org: Dict[str, Any]) -> Dict[str, Any]:
    members = _member_rows(org["id"])
    n = len(members) or 1
    done_courses = sum(m["courses_done"] for m in members)
    training_pct = round(100 * sum(1 for m in members if m["courses_done"] >= 3) / n)
    course_pct = round(100 * done_courses / (n * len(COURSES)))
    qs = [m["quiz_pct"] for m in members if m["quiz_pct"] is not None]
    quiz = round(sum(qs) / len(qs)) if qs else 0
    tg = PDB.query("SELECT COUNT(*) n, SUM(clicked_at!='') c, SUM(reported_at!='') r FROM sim_targets WHERE org_id=? AND sent_at!=''", (org["id"],))[0]
    sims = tg["n"] or 0
    click = round(100 * (tg["c"] or 0) / sims) if sims else 0
    report = round(100 * (tg["r"] or 0) / sims) if sims else 0
    checked = [m for m in members if m["pw_checked"]]
    leaked = round(100 * sum(1 for m in checked if m["pw_leaked"]) / len(checked)) if checked else 0
    weak = round(100 * sum(1 for m in checked if (m["pw_strength"] or 0) <= 1) / len(checked)) if checked else 0
    admins = [m for m in members if m["role"] in ("owner", "admin")]
    return {"members": len(members), "training_pct": training_pct, "course_pct": course_pct, "quiz_pct": quiz,
            "sims": sims, "click_pct": click, "report_pct": report, "pw_checked_pct": round(100 * len(checked) / n),
            "pw_leaked_pct": leaked, "pw_weak_pct": weak, "admin_mfa": bool(admins) and all(m["mfa"] for m in admins),
            "member_mfa_pct": round(100 * sum(1 for m in members if m["mfa"]) / n)}


def _scores(org: Dict[str, Any]) -> Dict[str, Any]:
    st = _stats(org)
    controls = _controls(org["id"], st)
    cov = _coverage(controls)
    sim_score = max(0, min(100, 100 - st["click_pct"] + st["report_pct"] // 2)) if st["sims"] else None
    awareness = round(0.5 * st["course_pct"] + 0.5 * st["quiz_pct"]) if sim_score is None else \
        round(0.35 * st["course_pct"] + 0.3 * st["quiz_pct"] + 0.35 * sim_score)
    kev = _kev_matches(org)
    exposure = round(min(100, 0.35 * st["pw_leaked_pct"] + 0.25 * st["click_pct"] + 0.25 * min(100, len(kev) * 15)
                         + 0.15 * (100 - st["member_mfa_pct"])))
    compliance = cov["pct"]
    maturity = min(5, 1 + compliance // 25)
    risk_posture = round(0.35 * compliance + 0.35 * awareness + 0.30 * (100 - exposure))
    return {"risk_posture": risk_posture, "compliance": compliance, "maturity": maturity, "awareness": awareness,
            "exposure": exposure, "stats": st, "coverage": cov, "controls": controls, "kev": kev}


def _top_risks(sc: Dict[str, Any]) -> List[Dict[str, str]]:
    st, out = sc["stats"], []
    if not st["admin_mfa"]:
        out.append({"level": "high", "text": "Not every organisation admin uses 2-step verification.", "fix": "Ask all admins to enable it in Account → Security."})
    if sc["kev"]:
        out.append({"level": "high", "text": f"{len(sc['kev'])} known-exploited vulnerabilities (CISA KEV) match products you use.", "fix": "Patch them first, by their due dates."})
    if st["sims"] and st["click_pct"] >= 10:
        out.append({"level": "high" if st["click_pct"] >= 20 else "medium", "text": f"{st['click_pct']}% of staff clicked a simulated phishing link.", "fix": "Assign the 'Spot phishing' course to people who clicked; repeat a simulation in 30 days."})
    if st["pw_leaked_pct"]:
        out.append({"level": "high", "text": f"{st['pw_leaked_pct']}% of checked staff use a password found in known breaches.", "fix": "They should change it now and enable 2-step verification."})
    if st["training_pct"] < 80:
        out.append({"level": "medium", "text": f"Only {st['training_pct']}% of staff finished at least 3 awareness courses.", "fix": "Share the invite link and set a 2-week deadline."})
    if not st["sims"]:
        out.append({"level": "medium", "text": "No phishing simulation has been run yet.", "fix": "Run an easy template first to set a baseline."})
    for c in sc["controls"]:
        if c["weight"] >= 3 and c["status"] == "not_started":
            out.append({"level": "medium", "text": f"Control not in place: {c['title']}.", "fix": "Assign an owner in the Compliance tab."})
    if st["pw_checked_pct"] < 50:
        out.append({"level": "low", "text": f"Only {st['pw_checked_pct']}% of staff checked their password.", "fix": "Ask everyone to run the private password check."})
    return out[:8]


def _snapshot(org_id: str, sc: Dict[str, Any]) -> List[Dict[str, Any]]:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data = {k: sc[k] for k in ("risk_posture", "compliance", "maturity", "awareness", "exposure")}
    PDB.execute("INSERT OR REPLACE INTO org_scores(org_id, day, data) VALUES (?,?,?)", (org_id, day, json.dumps(data)))
    rows = PDB.query("SELECT day, data FROM org_scores WHERE org_id=? ORDER BY day DESC LIMIT 30", (org_id,))
    return [{"day": r["day"], **json.loads(r["data"])} for r in reversed(rows)]


@router.get("/api/org/dashboard")
async def org_dashboard(ctx=Depends(require_org_admin)):
    sc = _scores(ctx["org"])
    trend = _snapshot(ctx["org"]["id"], sc)
    camps = PDB.query("SELECT c.id, c.name, c.created_at, c.targets, SUM(t.clicked_at!='') clicked, SUM(t.reported_at!='') reported "
                      "FROM sim_campaigns c LEFT JOIN sim_targets t ON t.campaign_id=c.id WHERE c.org_id=? GROUP BY c.id "
                      "ORDER BY c.created_at DESC LIMIT 6", (ctx["org"]["id"],))
    return {"scores": {k: sc[k] for k in ("risk_posture", "compliance", "maturity", "awareness", "exposure")},
            "stats": sc["stats"], "coverage": sc["coverage"], "kev": sc["kev"][:10], "risks": _top_risks(sc),
            "trend": trend, "campaigns": camps}


@router.get("/api/org/report")
async def org_report(request: Request, ctx=Depends(require_org_admin)):
    sc = _scores(ctx["org"])
    risks = _top_risks(sc)
    s = sc
    summary = (f"{ctx['org']['name']} has a risk posture score of {s['risk_posture']}/100 (maturity level {s['maturity']} of 5). "
               f"Compliance coverage is {s['compliance']}%, staff awareness {s['awareness']}/100 and threat exposure {s['exposure']}/100 (lower is better). "
               + (f"The most urgent issue: {risks[0]['text']}" if risks else "No urgent issues were found."))
    try:
        from . import agents  # noqa: PLC0415
        ai = await agents.summarise_report(summary, risks)
        if ai:
            summary = ai
    except Exception:
        pass
    audit("report.generated", org_id=ctx["org"]["id"], actor=ctx["user"], request=request)
    return {"org": ctx["org"]["name"], "generated_at": now_iso(), "summary": summary,
            "scores": {k: sc[k] for k in ("risk_posture", "compliance", "maturity", "awareness", "exposure")},
            "stats": sc["stats"], "coverage": sc["coverage"], "risks": risks, "kev": sc["kev"][:10],
            "controls": [{k: c[k] for k in ("id", "title", "status", "owner")} for c in sc["controls"]]}


# ---------------------------------------------------------------- platform admin
@admin.get("/orgs")
async def admin_orgs():
    return PDB.query("SELECT o.id, o.name, o.domain, o.plan, o.seats, o.created_at, COUNT(m.id) members FROM orgs o "
                     "LEFT JOIN org_members m ON m.org_id=o.id GROUP BY o.id ORDER BY o.created_at DESC")


class AdminOrgPatch(BaseModel):
    plan: Optional[str] = Field(default=None, max_length=30)
    seats: Optional[int] = Field(default=None, ge=1, le=1000000)


@admin.patch("/orgs/{oid}")
async def admin_org_update(oid: str, body: AdminOrgPatch, request: Request):
    ch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not PDB.get("orgs", oid):
        raise HTTPException(404, "Not found")
    PDB.update("orgs", oid, ch)
    audit("platform.org_updated", org_id=oid, target=oid, detail=ch, request=request)
    return {"ok": True}

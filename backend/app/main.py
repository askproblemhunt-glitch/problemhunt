"""ProblemHunt — autonomous security command API.

Run:  uvicorn backend.app.main:app   (or just `python start_problemhunt.py`)
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import mimetypes
import random
import re
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager, suppress
from typing import Any, Deque, Dict, Optional, Tuple

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, config, intel, product, product2, product3, providers, simulation, sync  # noqa: F401 (product2/3 register routes)
from . import cloud_backup, product4, intel_center, agents  # noqa: F401,E402 (v5: workplace, intel center, AI agents register routes)
from .agent import ThreatAgent
from .live_intel import LIVE
from .detection import ENGINE, Analysis, severity_for
from .models import (CATEGORY_LABELS, LockdownRequest, PushSubscriptionIn, RadarBlip, Rule, ScanRequest,
                     ScanResult, ThreatEvent)
from .push import PushService
from .realtime import HUB
from .state import STATE
from .store import Store

# Windows often maps .js -> text/plain in the registry; with "nosniff" browsers then refuse to run
# the dashboard's scripts (blank page). Pin the correct types regardless of the OS registry.
for _ext, _type in {".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css",
                    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
                    ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
                    ".html": "text/html", ".txt": "text/plain", ".woff2": "font/woff2"}.items():
    mimetypes.add_type(_type, _ext)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
log = logging.getLogger("problemhunt")

store = Store(config.DB_PATH)
push = PushService(store, config.DATA_DIR)
agent: Optional[ThreatAgent] = None
_intel_meta: Dict[str, Any] = {"last_refresh": None, "sources": []}


# --------------------------------------------------------------------------- core pipeline
def decide_action(score: int) -> str:
    if STATE.lockdown:
        return "neutralized" if score >= 30 else "flagged" if score >= 15 else "allowed"
    return "neutralized" if score >= 60 else "flagged" if score >= 30 else "allowed"


def redact(text: str, limit: int = 180) -> str:
    """Never echo full PII into feeds: mask long digit runs and e-mail local parts."""
    text = re.sub(r"\d{6,}", lambda m: m.group()[:2] + "•" * (len(m.group()) - 4) + m.group()[-2:], text)
    text = re.sub(r"([\w.+-]{2})[\w.+-]*@", r"\1•••@", text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def explain(a: Analysis, action: str) -> str:
    top = a.indicators[0] if a.indicators else ""
    if a.verdict == "malicious":
        return f"Dangerous! This looks like a {a.label}. {top}. Don't click, pay, scan or reply — it has been {action}."
    if a.verdict == "suspicious":
        return f"Be careful. This has signs of a {a.label}: {top}. Verify through an official app or number before acting."
    return "No known scam signals found. Even so, never share OTPs, PINs or passwords with anyone."


async def process(content: str, kind: str, *, title: Optional[str], vector: str, region: str,
                  node_name: Optional[str], source: str, use_llm: bool) -> Tuple[ScanResult, ThreatEvent]:
    t0 = time.perf_counter()
    a = ENGINE.analyse(content, kind)
    engine = "signature+heuristic"
    confidence = round(min(0.99, 0.55 + a.score / 250 + 0.03 * len(a.indicators)), 2) if a.score else 0.9

    if use_llm and agent and agent.llm_enabled and (20 <= a.score < 85 or kind == "audio_transcript"):
        v = await agent.ask_llm(content, a)
        if v:
            engine = f"signature+heuristic+LLM ({agent.provider})"
            if v.risk_score >= 60 and v.confidence >= 0.7:
                a.score = max(a.score, v.risk_score)
            else:
                a.score = round(0.65 * a.score + 0.35 * v.risk_score)
            if a.category == "safe" and v.category != "safe" and a.score >= 30:
                a.category = v.category
            if v.reasoning:
                a.indicators.append(f"AI analyst: {v.reasoning}")
            a.severity = severity_for(a.score)
            a.verdict = "malicious" if a.score >= 60 else "suspicious" if a.score >= 30 else "safe"
            confidence = round(max(confidence, v.confidence), 2)

    action = decide_action(a.score)
    nodes = HUB.all_node_objs()
    node = next((n for n in nodes if n.name == node_name), None) or (random.choice(nodes) if source == "simulation" else None)
    if node and action != "allowed":
        node.intercepted += 1

    result = ScanResult(
        verdict=a.verdict, category=a.category, category_label=a.label, severity=a.severity,
        risk_score=a.score, confidence=confidence, indicators=a.indicators, matched_rules=a.matched_rules,
        action=action, explanation=explain(a, action), engine=engine,
        elapsed_ms=round((time.perf_counter() - t0) * 1000, 2),
    )
    ev = ThreatEvent(
        title=title or f"{a.label} detected", category=a.category, category_label=a.label,
        severity=a.severity, vector=vector, region=region, node=node.name if node else "Web Scanner",
        action=action, risk_score=a.score, indicators=a.indicators[:4], source=source, sample=redact(content),
    )
    STATE.record(ev)
    if ev.category != "safe":
        store.add_threat(ev)
        await HUB.broadcast("threat", ev.model_dump())
        if source != "simulation":
            asyncio.create_task(sync.mirror("threats", ev.model_dump()))
    if agent:
        agent.ingest(content, a)

    if action == "neutralized" and (ev.severity == "critical" or source == "scan"):
        if source != "simulation" or config.PUSH_SIMULATED:
            drill = " (drill)" if source == "simulation" else ""
            asyncio.create_task(push.notify(
                f"🛡️ Threat neutralized{drill}",
                f"{ev.title} — blocked on {ev.node}. Risk {ev.risk_score}/100.",
                tag=ev.id, severity=ev.severity, force=source == "scan",
            ))
    return result, ev


async def on_rule_learned(rule: Rule) -> None:
    await HUB.broadcast("rule", rule.model_dump())
    asyncio.create_task(sync.mirror("rules", rule.model_dump()))


# --------------------------------------------------------------------------- background loops
async def simulation_loop() -> None:
    await asyncio.sleep(1.5)
    while True:
        s = simulation.generate_sample()
        try:
            await process(s["text"], s["kind"], title=s["title"], vector=s["vector"], region=s["region"],
                          node_name=None, source="simulation", use_llm=False)
        except Exception:
            log.exception("simulation step failed")
        await asyncio.sleep(random.uniform(config.SIM_MIN_INTERVAL, config.SIM_MAX_INTERVAL))


async def radar_loop() -> None:
    if config.SIMULATION_ENABLED:
        for _ in range(8):  # warm start so the radar is never empty
            STATE.add_blip(RadarBlip(**simulation.generate_blip()))
    while True:
        await asyncio.sleep(random.uniform(4, 8))
        blip = LIVE.next_blip()  # real campaign aggregates from live intel
        if blip is None and config.SIMULATION_ENABLED:
            blip = RadarBlip(**simulation.generate_blip())
        elif config.SIMULATION_ENABLED and random.random() < 0.4:
            blip = RadarBlip(**simulation.generate_blip())
        if blip:
            STATE.add_blip(blip)
            await HUB.broadcast("radar", blip.model_dump())


async def intel_loop() -> None:
    ENGINE.load_intel(await asyncio.to_thread(store.intel))
    # Re-play the most recent real IOCs so the feed isn't empty after a restart.
    by_src: dict = {}
    for url, src in reversed(await asyncio.to_thread(store.recent_intel_urls, 40)):
        name = "OpenPhish" if "openphish" in src else "URLhaus" if "urlhaus" in src else "intel"
        by_src.setdefault(name, []).append(url)
    for name, urls in by_src.items():
        LIVE.enqueue(urls, name)
    await asyncio.sleep(3)
    while True:
        try:
            import os as _os
            feed_urls = config.INTEL_FEEDS if _os.getenv("PH_INTEL_FEED_URLS") else providers.enabled_feed_urls(product.PDB)
            new, sources, fresh = await intel.refresh(store, ENGINE, feed_urls)
            if sources:
                _intel_meta.update(last_refresh=time.time(), sources=sources)
                for name, urls in fresh:
                    LIVE.enqueue(urls, name)
                LIVE.note_batch_done()
        except Exception:
            log.exception("intel refresh failed")
        for _ in range(config.INTEL_REFRESH_SECONDS // 15):  # re-check soon if admin toggles feeds
            await asyncio.sleep(15)
            if product.PDB.scalar("SELECT v FROM settings WHERE k='feeds_dirty'"):
                product.PDB.execute("DELETE FROM settings WHERE k='feeds_dirty'")
                break


async def intel_stream_loop() -> None:
    """Drip real feed URLs into the live interception feed."""
    while True:
        url, source = await LIVE.queue.get()
        try:
            ev = LIVE.build_event(url, source)
            if ev:
                STATE.record(ev)
                store.add_threat(ev)
                await HUB.broadcast("threat", ev.model_dump())
        except Exception:
            log.exception("intel stream step failed")
        # faster while catching up on a big backlog, steady trickle otherwise
        backlog = LIVE.queue.qsize()
        await asyncio.sleep(0.6 if backlog > 300 else random.uniform(config.INTEL_STREAM_MIN, config.INTEL_STREAM_MAX))


async def stats_loop() -> None:
    while True:
        await asyncio.sleep(2)
        if HUB.client_count:
            await HUB.broadcast("stats", live_status())


async def hits_flush_loop() -> None:
    while True:
        await asyncio.sleep(20)
        counts = dict(ENGINE.hit_counter)
        ENGINE.hit_counter.clear()
        await asyncio.to_thread(store.bump_hits, counts)


# --------------------------------------------------------------------------- snapshots
def engine_info() -> Dict[str, Any]:
    learned = len(store.rules())
    return {
        "provider": agent.provider if agent else "starting",
        "llm": bool(agent and agent.llm_enabled),
        "llm_healthy": bool(agent and agent.llm_enabled and (agent.stats["llm_calls"] == 0 or agent.stats["llm_errors"] < agent.stats["llm_calls"])),
        "langchain": _langchain_version(),
        "total_rules": ENGINE.rule_count,
        "learned_rules": learned,
        "intel_iocs": ENGINE.intel_size,
        "intel_sources": _intel_meta["sources"],
        "intel_last_refresh": _intel_meta["last_refresh"],
        "agent": agent.stats if agent else {},
        "simulation": config.SIMULATION_ENABLED,
        "intel_streamed": LIVE.streamed,
        "intel_backlog": LIVE.queue.qsize(),
        "supabase": sync.enabled(),
    }


def _langchain_version() -> Optional[str]:
    try:
        import langchain_core

        return langchain_core.__version__
    except Exception:
        return None


def live_status() -> Dict[str, Any]:
    nodes = HUB.nodes()
    eng = engine_info()
    return {
        "stats": STATE.stats(),
        "immunity": STATE.immunity(eng["total_rules"], eng["intel_iocs"], len(nodes),
                                   sum(1 for n in nodes if n["live"]), eng["llm_healthy"]),
        "nodes": nodes,
        "engine": eng,
        "push": {"enabled": push.enabled, "subscribers": push.subscriber_count, "sent": push.sent},
    }


def snapshot() -> Dict[str, Any]:
    return {
        "version": config.VERSION,
        **live_status(),
        "threats": [t.model_dump() for t in list(STATE.threats)[:60]] or [
            t.model_dump() for t in store.recent_threats(200)
            if config.SIMULATION_ENABLED or t.source != "simulation"][:60],
        "radar": [b.model_dump() for b in STATE.radar],
        "rules": [r.model_dump() for r in store.rules()[:150]],
        "categories": CATEGORY_LABELS,
    }


# --------------------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(_: FastAPI):
    global agent
    for row in await sync.restore_rules():
        try:
            row["created_at"] = str(row.get("created_at", ""))
            store.add_rule(Rule(**{k: v for k, v in row.items() if k in Rule.model_fields}))
        except Exception:
            continue
    ENGINE.load_rules(store.rules())
    agent = ThreatAgent(store, on_rule_learned)
    tasks = [asyncio.create_task(agent.run()), asyncio.create_task(radar_loop()),
             asyncio.create_task(stats_loop()), asyncio.create_task(hits_flush_loop()),
             asyncio.create_task(product3.daily_push_loop()), asyncio.create_task(intel_center.intel_loop()),
             asyncio.create_task(cloud_backup.backup_loop(config.DATA_DIR))]
    if config.SIMULATION_ENABLED:
        tasks.append(asyncio.create_task(simulation_loop()))
    if config.INTEL_FEEDS_ENABLED:
        tasks.append(asyncio.create_task(intel_loop()))
        tasks.append(asyncio.create_task(intel_stream_loop()))
    if not config.SIMULATION_ENABLED:
        HUB.virtual_nodes = []  # real devices only
    log.info("ProblemHunt %s online · agent=%s · push=%s", config.VERSION, agent.provider, push.enabled)
    yield
    for t in tasks:
        t.cancel()
    for t in tasks:
        with suppress(asyncio.CancelledError, Exception):
            await t


app = FastAPI(title="ProblemHunt API", version=config.VERSION, lifespan=lifespan,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Token", "Authorization"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self)")
    path = request.url.path
    if path.startswith("/api/docs"):  # Swagger UI loads its assets from cdn.jsdelivr.net
        csp = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
               "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com; "
               "connect-src 'self'; frame-ancestors 'none'")
        h["Content-Security-Policy"] = csp
    h.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://checkout.razorpay.com https://pagead2.googlesyndication.com "
        "https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' https: blob:; "
        "connect-src 'self' ws: wss: http: https:; worker-src 'self'; "
        "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.youtube-nocookie.com https://www.youtube.com "
        "https://player.vimeo.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com",
    )
    path = request.url.path
    if path in ("/sw.js", "/manifest.json") or path.endswith(".html") or path == "/":
        h["Cache-Control"] = "no-cache"
    elif path.startswith("/_next/static/"):
        h["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


# -- auth & rate limiting -----------------------------------------------------
def require_admin(authorization: Optional[str] = Header(default=None),
                  x_admin_token: Optional[str] = Header(default=None)) -> None:
    """Admin = valid PH_ADMIN_TOKEN header, or a logged-in admin user.
    Local installs without a token and without any admin account stay open (single-user mode)."""
    if not config.ADMIN_TOKEN and not product.PDB.scalar("SELECT 1 FROM users WHERE role='admin'"):
        return
    auth.require_admin_user(authorization, x_admin_token)


_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "?"
    q, now = _buckets[ip], time.monotonic()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= config.SCAN_RATE_PER_MIN:
        raise HTTPException(status_code=429, detail="Too many scans - slow down")
    q.append(now)
    if len(_buckets) > 10000:
        _buckets.clear()


# -- REST ---------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": config.VERSION, "uptime_s": STATE.stats()["uptime_s"]}


@app.get("/api/snapshot")
async def get_snapshot():
    return snapshot()


@app.post("/api/scan", response_model=ScanResult, dependencies=[Depends(rate_limit)])
async def scan(req: ScanRequest):
    kind = req.kind
    vector = {"url": "Web", "qr": "QR", "audio_transcript": "Voice", "message": "Message"}.get(kind, "Scanner")
    result, _ = await process(req.content, kind, title=None, vector=vector, region="Your device",
                              node_name=req.node_id, source="scan", use_llm=True)
    return result


@app.get("/api/threats")
async def threats(limit: int = 100):
    return [t.model_dump() for t in store.recent_threats(max(1, min(limit, 500)))]


@app.get("/api/rules")
async def rules():
    return [r.model_dump() for r in store.rules()]


@app.delete("/api/rules/{rule_id}", dependencies=[Depends(require_admin)])
async def delete_rule(rule_id: str):
    if not store.delete_rule(rule_id):
        raise HTTPException(404, "Rule not found")
    ENGINE.remove_rule(rule_id)
    await HUB.broadcast("rules_changed", {"deleted": rule_id})
    return {"deleted": rule_id}


@app.post("/api/lockdown", dependencies=[Depends(require_admin), Depends(rate_limit)])
async def lockdown(req: LockdownRequest):
    STATE.set_lockdown(req.engaged)
    payload = {"engaged": STATE.lockdown, "since": STATE.lockdown_since}
    await HUB.broadcast("lockdown", payload)
    await push.notify(
        "🚨 EMERGENCY LOCKDOWN ENGAGED" if req.engaged else "✅ Lockdown lifted",
        "All nodes now block anything suspicious. Payments, links & QR codes are quarantined."
        if req.engaged else "Defense grid returned to adaptive autopilot.",
        tag="lockdown", force=True, severity="critical" if req.engaged else "low",
    )
    log.warning("Emergency lockdown %s", "ENGAGED" if req.engaged else "released")
    return payload


@app.get("/api/push/public-key")
async def push_key():
    return {"enabled": push.enabled, "publicKey": push.public_key}


@app.post("/api/push/subscribe")
async def push_subscribe(sub: PushSubscriptionIn):
    if not push.enabled:
        raise HTTPException(503, "Web Push not available on this server")
    if not sub.endpoint.startswith("https://"):
        raise HTTPException(400, "Invalid push endpoint")
    push.subscribe(sub.model_dump())
    return {"subscribed": True, "subscribers": push.subscriber_count}


@app.post("/api/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscriptionIn):
    push.unsubscribe(sub.endpoint)
    return {"subscribed": False}


@app.post("/api/push/test", dependencies=[Depends(require_admin), Depends(rate_limit)])
async def push_test():
    n = await push.notify("🛡️ ProblemHunt is guarding you", "Push alerts are live on this device.",
                          tag="test", force=True, severity="low")
    return {"delivered": n}


# -- WebSocket ----------------------------------------------------------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    if HUB.client_count >= config.MAX_WS_CLIENTS:
        await ws.close(code=1013)
        return
    await HUB.connect(ws)
    try:
        await ws.send_json({"type": "hello", "data": snapshot()})
        while True:
            msg = await ws.receive_json()
            if not isinstance(msg, dict):
                continue
            HUB.touch(ws)
            kind = msg.get("type")
            if kind == "register" and isinstance(msg.get("node"), dict):
                node = HUB.register(ws, msg["node"])
                await ws.send_json({"type": "registered", "data": node.public()})
                await HUB.broadcast("nodes", HUB.nodes())
            elif kind == "ping":
                await ws.send_json({"type": "pong", "data": {"t": time.time()}})
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    except Exception:
        log.debug("ws error", exc_info=True)
    finally:
        await HUB.disconnect(ws)
        await HUB.broadcast("nodes", HUB.nodes())


# -- Product API (accounts, check, CMS, ads, affiliates, payments, reports, admin) --
product.bind(process=process, decide_action=decide_action, store=store, push=push, rate_limit=rate_limit)
app.include_router(product.router)
app.include_router(product.admin)


# -- Screenshot-reading engine (served once from backend/static, kept out of the frontend build) --
_OCR_DIR = config.ROOT_DIR / "backend" / "static" / "tesseract"
if _OCR_DIR.exists():
    app.mount("/tesseract", StaticFiles(directory=str(_OCR_DIR)), name="tesseract")

# -- Frontend (static Next.js export) -------------------------------------------
if (config.FRONTEND_DIST / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(config.FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    async def no_frontend():
        return (
            "<html><body style='background:#05070d;color:#7df9ff;font-family:monospace;padding:40px'>"
            "<h1>ProblemHunt API is running</h1><p>The dashboard build was not found at "
            f"<code>{config.FRONTEND_DIST}</code>.</p><p>Run <code>python start_problemhunt.py --rebuild-frontend</code> "
            "(needs Node.js) or download the release that ships with the prebuilt dashboard.</p>"
            "<p>API docs: <a style='color:#fff' href='/api/docs'>/api/docs</a></p></body></html>"
        )


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse({"detail": "Internal error"}, status_code=500)

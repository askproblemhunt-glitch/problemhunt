"""Multi-provider threat data.

Two kinds of providers, all managed from the Admin panel (enable/disable,
paste API key, test):

* FEEDS - free, key-less lists downloaded every 30 minutes and loaded into the
  engine's blocklist (OpenPhish, URLhaus, Phishing.Database, Phishing Army).
* LOOKUPS - per-check APIs with free tiers, called live when a user checks a
  link / phone / email / IP (Google Safe Browsing, VirusTotal, IPQualityScore,
  AbuseIPDB, AlienVault OTX).

Every lookup has a timeout, a per-provider rate limit and a 6-hour cache so
free quotas last. Results are normalised to:
    {provider, label, status: malicious|suspicious|clean|unknown|error|skipped, detail}
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

log = logging.getLogger("problemhunt.providers")

FEEDS: Dict[str, Dict[str, Any]] = {
    "openphish": {"label": "OpenPhish community feed", "url": "https://openphish.com/feed.txt",
                  "site": "https://openphish.com", "default": True},
    "urlhaus": {"label": "abuse.ch URLhaus (malware URLs)", "url": "https://urlhaus.abuse.ch/downloads/text_online/",
                "site": "https://urlhaus.abuse.ch", "default": True},
    "phishing_database": {"label": "Phishing.Database (active links)",
                          "url": "https://phish.co.za/latest/phishing-links-ACTIVE.txt",
                          "site": "https://github.com/Phishing-Database/Phishing.Database", "default": False,
                          "note": "Large list (100k+ links). Enable on servers with enough memory."},
    "phishing_army": {"label": "Phishing Army (domains)", "url": "https://phishing.army/download/phishing-army-domains.txt",
                      "site": "https://phishing.army", "default": True},
}

LOOKUPS: Dict[str, Dict[str, Any]] = {
    "google_safe_browsing": {"label": "Google Safe Browsing", "types": ["url"], "min_interval": 0.2,
                             "signup": "https://developers.google.com/safe-browsing/v4/get-started",
                             "free": "Free (non-commercial use; check Google's terms)"},
    "virustotal": {"label": "VirusTotal", "types": ["url"], "min_interval": 15.5,
                   "signup": "https://www.virustotal.com/gui/join-us", "free": "Free public API: 4 lookups/min"},
    "ipqs": {"label": "IPQualityScore", "types": ["url", "phone", "email"], "min_interval": 0.5,
             "signup": "https://www.ipqualityscore.com/create-account", "free": "Free tier with monthly lookups"},
    "abuseipdb": {"label": "AbuseIPDB", "types": ["ip"], "min_interval": 0.5,
                  "signup": "https://www.abuseipdb.com/register", "free": "Free tier: 1,000 checks/day"},
    "otx": {"label": "AlienVault OTX", "types": ["url"], "min_interval": 0.5,
            "signup": "https://otx.alienvault.com/", "free": "Free with account"},
}

CACHE_TTL = 6 * 3600
TIMEOUT = 7
_cache: Dict[str, tuple] = {}
_last_call: Dict[str, float] = {}


def _http(url: str, *, method: str = "GET", headers: Optional[Dict[str, str]] = None,
          data: Optional[bytes] = None) -> tuple:
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"User-Agent": "ProblemHunt/2.0", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # noqa: S310 - fixed provider hosts
            return r.status, r.read(2_000_000)
    except urllib.error.HTTPError as e:
        return e.code, e.read(200_000) if e.fp else b""


def _host(url: str) -> str:
    u = url if "://" in url else "http://" + url
    try:
        return (urllib.parse.urlsplit(u).hostname or "").lower()
    except ValueError:
        return ""


# --------------------------------------------------------------------------- provider calls
def gsb(key: str, value: str, kind: str) -> Dict[str, Any]:
    body = json.dumps({
        "client": {"clientId": "problemhunt", "clientVersion": "2.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": value if "://" in value else "http://" + value}],
        },
    }).encode()
    st, raw = _http(f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={urllib.parse.quote(key)}",
                    method="POST", headers={"Content-Type": "application/json"}, data=body)
    if st != 200:
        return {"status": "error", "detail": f"HTTP {st}"}
    matches = json.loads(raw or b"{}").get("matches", [])
    if matches:
        types = sorted({m.get("threatType", "") for m in matches})
        return {"status": "malicious", "detail": "Listed by Google: " + ", ".join(types).replace("_", " ").lower()}
    return {"status": "clean", "detail": "Not on Google's unsafe list"}


def virustotal(key: str, value: str, kind: str) -> Dict[str, Any]:
    url = value if "://" in value else "http://" + value
    vid = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
    st, raw = _http(f"https://www.virustotal.com/api/v3/urls/{vid}", headers={"x-apikey": key})
    if st == 404:
        host = _host(url)
        st, raw = _http(f"https://www.virustotal.com/api/v3/domains/{urllib.parse.quote(host)}", headers={"x-apikey": key})
        if st == 404:
            return {"status": "unknown", "detail": "Never seen by VirusTotal"}
    if st != 200:
        return {"status": "error", "detail": f"HTTP {st}"}
    stats = json.loads(raw).get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
    mal, sus = int(stats.get("malicious", 0)), int(stats.get("suspicious", 0))
    total = sum(int(v) for v in stats.values() if isinstance(v, int)) or 0
    detail = f"{mal} of {total} security vendors flag it" if total else "No vendor verdicts"
    if mal >= 2:
        return {"status": "malicious", "detail": detail}
    if mal == 1 or sus >= 1:
        return {"status": "suspicious", "detail": detail}
    return {"status": "clean", "detail": detail}


def ipqs(key: str, value: str, kind: str) -> Dict[str, Any]:
    k = urllib.parse.quote(key, safe="")
    if kind == "url":
        st, raw = _http(f"https://www.ipqualityscore.com/api/json/url/{k}/{urllib.parse.quote(value, safe='')}?strictness=0")
    elif kind == "phone":
        digits = "".join(ch for ch in value if ch.isdigit() or ch == "+")
        st, raw = _http(f"https://www.ipqualityscore.com/api/json/phone/{k}/{urllib.parse.quote(digits)}?country[]=IN&country[]=US")
    elif kind == "email":
        st, raw = _http(f"https://www.ipqualityscore.com/api/json/email/{k}/{urllib.parse.quote(value, safe='')}")
    else:
        return {"status": "skipped", "detail": "type not supported"}
    if st != 200:
        return {"status": "error", "detail": f"HTTP {st}"}
    d = json.loads(raw or b"{}")
    if not d.get("success", False):
        return {"status": "error", "detail": str(d.get("message", "lookup failed"))[:120]}
    if kind == "url":
        score = int(d.get("risk_score", 0))
        flags = [f for f in ("phishing", "malware", "suspicious", "spamming") if d.get(f)]
        status = "malicious" if d.get("unsafe") or d.get("phishing") or d.get("malware") or score >= 85 else \
                 "suspicious" if score >= 60 or flags else "clean"
        return {"status": status, "detail": f"Risk {score}/100" + (f" · {', '.join(flags)}" if flags else "")}
    score = int(d.get("fraud_score", 0))
    bits = []
    if kind == "phone":
        for f, label in (("recent_abuse", "recent abuse"), ("spammer", "spammer"), ("VOIP", "internet/VoIP number"),
                         ("risky", "risky")):
            if d.get(f):
                bits.append(label)
        if d.get("valid") is False:
            bits.append("invalid number")
        meta = " · ".join(x for x in [d.get("carrier") or "", d.get("line_type") or "", d.get("country") or ""] if x)
    else:
        for f, label in (("recent_abuse", "recent abuse"), ("disposable", "disposable mailbox"), ("leaked", "leaked")):
            if d.get(f):
                bits.append(label)
        if d.get("valid") is False:
            bits.append("mailbox not valid")
        meta = ""
    status = "malicious" if score >= 85 or d.get("recent_abuse") else "suspicious" if score >= 60 or bits else "clean"
    detail = f"Fraud score {score}/100" + (f" · {', '.join(bits)}" if bits else "") + (f" · {meta}" if meta else "")
    return {"status": status, "detail": detail}


def abuseipdb(key: str, value: str, kind: str) -> Dict[str, Any]:
    st, raw = _http(f"https://api.abuseipdb.com/api/v2/check?ipAddress={urllib.parse.quote(value)}&maxAgeInDays=90",
                    headers={"Key": key, "Accept": "application/json"})
    if st != 200:
        return {"status": "error", "detail": f"HTTP {st}"}
    d = json.loads(raw).get("data", {})
    score = int(d.get("abuseConfidenceScore", 0))
    reports = int(d.get("totalReports", 0))
    status = "malicious" if score >= 75 else "suspicious" if score >= 25 else "clean"
    return {"status": status, "detail": f"Abuse confidence {score}% · {reports} reports"}


def otx(key: str, value: str, kind: str) -> Dict[str, Any]:
    host = _host(value)
    if not host:
        return {"status": "skipped", "detail": "no domain"}
    st, raw = _http(f"https://otx.alienvault.com/api/v1/indicators/domain/{urllib.parse.quote(host)}/general",
                    headers={"X-OTX-API-KEY": key})
    if st != 200:
        return {"status": "error", "detail": f"HTTP {st}"}
    pulses = int(json.loads(raw).get("pulse_info", {}).get("count", 0))
    status = "malicious" if pulses >= 3 else "suspicious" if pulses >= 1 else "clean"
    return {"status": status, "detail": f"In {pulses} threat-intel pulses" if pulses else "No threat pulses"}


CALLS = {"google_safe_browsing": gsb, "virustotal": virustotal, "ipqs": ipqs, "abuseipdb": abuseipdb, "otx": otx}


# --------------------------------------------------------------------------- orchestration
def _one(name: str, key: str, value: str, kind: str) -> Dict[str, Any]:
    ck = f"{name}|{kind}|{value}"
    hit = _cache.get(ck)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return {**hit[1], "cached": True}
    gap = LOOKUPS[name]["min_interval"]
    if time.time() - _last_call.get(name, 0) < gap:
        return {"status": "skipped", "detail": "free-tier rate limit, try again shortly"}
    _last_call[name] = time.time()
    try:
        res = CALLS[name](key, value, kind)
    except Exception as exc:  # network down, bad JSON...
        log.info("provider %s failed: %s", name, exc)
        res = {"status": "error", "detail": "provider unreachable"}
    if res["status"] not in ("error", "skipped"):
        _cache[ck] = (time.time(), res)
        if len(_cache) > 20000:
            _cache.clear()
    return res


async def lookup_all(pdb, value: str, kind: str, deep: bool = True) -> List[Dict[str, Any]]:
    """Call every enabled provider that supports this kind, in parallel."""
    jobs = []
    for name, meta in LOOKUPS.items():
        if kind not in meta["types"]:
            continue
        cfg = pdb.provider_cfg(name)
        if not cfg.get("enabled") or not cfg.get("api_key"):
            continue
        if not deep and name == "virustotal":  # VT quota is tiny: premium/deep checks only
            continue
        jobs.append((name, asyncio.to_thread(_one, name, cfg["api_key"], value, kind)))
    if not jobs:
        return []
    results = await asyncio.gather(*(j for _, j in jobs), return_exceptions=True)
    out = []
    for (name, _), r in zip(jobs, results):
        r = r if isinstance(r, dict) else {"status": "error", "detail": "failed"}
        out.append({"provider": name, "label": LOOKUPS[name]["label"], **r})
    return out


async def test_provider(name: str, key: str) -> Dict[str, Any]:
    sample = {"url": "http://testsafebrowsing.appspot.com/s/phishing.html", "phone": "+18007132618",
              "email": "test@example.com", "ip": "118.25.6.39"}
    kind = LOOKUPS[name]["types"][0]
    _last_call.pop(name, None)
    res = await asyncio.to_thread(CALLS[name], key, sample[kind], kind)
    return {"ok": res["status"] not in ("error",), **res}


def enabled_feed_urls(pdb) -> List[str]:
    urls = []
    for name, meta in FEEDS.items():
        cfg = pdb.provider_cfg(name)
        on = cfg.get("enabled", meta["default"])
        if on:
            urls.append(meta["url"])
    return urls

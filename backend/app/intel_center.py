"""Threat Intelligence Center (v5).

Free, public, government-published sources only:
* CISA Known Exploited Vulnerabilities (KEV) catalogue  — JSON
* FIRST EPSS exploit-prediction scores                  — JSON API
* NIST NVD API 2.0 (recent critical CVEs; optional API key)
* Government / CERT / vendor advisories via RSS/Atom (admin-editable list)
* MITRE ATT&CK techniques (built-in core list; full STIX bundle can be loaded on demand)
* Fraud Intelligence Center: the fraud guide enriched with risk, impact, channels,
  affected countries, ATT&CK techniques and official advisories.

Nothing is scraped from criminal forums; every advisory links to its original source.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import logging
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel

from . import config, platform_db, product, product2
from .platform_db import TABLE_FIELDS, now_iso
from .product import PDB, admin, router

log = logging.getLogger("problemhunt.intelcenter")

KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
EPSS_URL = "https://api.first.org/data/v1/epss?cve="
NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
ATTACK_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

DEFAULT_FEEDS = [
    {"name": "CISA advisories", "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml", "region": "US"},
    {"name": "NCSC UK", "url": "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", "region": "UK"},
    {"name": "CERT-EU", "url": "https://cert.europa.eu/publications/security-advisories-rss", "region": "EU"},
    {"name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews", "region": "Global"},
    {"name": "BleepingComputer", "url": "https://www.bleepingcomputer.com/feed/", "region": "Global"},
]
platform_db.DEFAULT_SETTINGS.setdefault("intel_feeds", DEFAULT_FEEDS)
platform_db.DEFAULT_SETTINGS.setdefault("intel_enabled", True)
platform_db.DEFAULT_SETTINGS.setdefault("nvd_api_key", "")
platform_db.SECRET_SETTINGS.add("nvd_api_key")

DDL = """
CREATE TABLE IF NOT EXISTS intel_cves (
  cve TEXT PRIMARY KEY, vendor TEXT DEFAULT '', product TEXT DEFAULT '', name TEXT DEFAULT '', description TEXT DEFAULT '',
  date_added TEXT DEFAULT '', due_date TEXT DEFAULT '', required_action TEXT DEFAULT '', ransomware TEXT DEFAULT '',
  cvss REAL, severity TEXT DEFAULT '', epss REAL, percentile REAL, kev INTEGER DEFAULT 0, published TEXT DEFAULT '', updated_at TEXT);
CREATE INDEX IF NOT EXISTS idx_cves_added ON intel_cves(date_added);
CREATE TABLE IF NOT EXISTS intel_advisories (
  id TEXT PRIMARY KEY, source TEXT, region TEXT DEFAULT '', title TEXT, link TEXT, published TEXT, summary TEXT DEFAULT '',
  cves TEXT DEFAULT '', created_at TEXT);
CREATE INDEX IF NOT EXISTS idx_adv_pub ON intel_advisories(published);
CREATE TABLE IF NOT EXISTS intel_attack (
  id TEXT PRIMARY KEY, name TEXT, tactic TEXT, description TEXT DEFAULT '', url TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS intel_runs (source TEXT PRIMARY KEY, last_ok TEXT, last_try TEXT, count INTEGER DEFAULT 0, error TEXT DEFAULT '');
"""
with PDB._lock:
    PDB.db.executescript(DDL)
    PDB.db.commit()
    for _t in ("intel_cves", "intel_advisories", "intel_attack"):
        TABLE_FIELDS[_t] = [r["name"] for r in PDB.db.execute(f"PRAGMA table_info({_t})")]

# --------------------------------------------------------------- MITRE ATT&CK core techniques (enterprise)
ATTACK_CORE = [
    ("T1566", "Phishing", "Initial Access", "Messages with malicious links or attachments to gain access."),
    ("T1566.001", "Spearphishing Attachment", "Initial Access", "Targeted email carrying a malicious file."),
    ("T1566.002", "Spearphishing Link", "Initial Access", "Targeted message with a malicious link."),
    ("T1566.004", "Spearphishing Voice", "Initial Access", "Phone calls (vishing) that lead victims to act."),
    ("T1598", "Phishing for Information", "Reconnaissance", "Messages that trick people into revealing data."),
    ("T1190", "Exploit Public-Facing Application", "Initial Access", "Abusing a flaw in an internet-facing system."),
    ("T1133", "External Remote Services", "Initial Access", "Using VPN, RDP or other remote services to get in."),
    ("T1078", "Valid Accounts", "Initial Access", "Using stolen or guessed real credentials."),
    ("T1204", "User Execution", "Execution", "Relying on a person to open a file or click a link."),
    ("T1059", "Command and Scripting Interpreter", "Execution", "Running commands or scripts (PowerShell, shell)."),
    ("T1053", "Scheduled Task/Job", "Persistence", "Scheduling code to run again later."),
    ("T1547", "Boot or Logon Autostart Execution", "Persistence", "Making malware start automatically."),
    ("T1110", "Brute Force", "Credential Access", "Guessing or spraying passwords."),
    ("T1003", "OS Credential Dumping", "Credential Access", "Extracting stored passwords and hashes."),
    ("T1111", "Multi-Factor Authentication Interception", "Credential Access", "Stealing one-time codes (e.g. SMS OTP)."),
    ("T1621", "Multi-Factor Authentication Request Generation", "Credential Access", "Flooding a user with MFA prompts until one is approved."),
    ("T1539", "Steal Web Session Cookie", "Credential Access", "Taking session cookies to skip login."),
    ("T1027", "Obfuscated Files or Information", "Defense Evasion", "Hiding malicious code to avoid detection."),
    ("T1562", "Impair Defenses", "Defense Evasion", "Turning off antivirus or logging."),
    ("T1070", "Indicator Removal", "Defense Evasion", "Deleting logs and traces."),
    ("T1082", "System Information Discovery", "Discovery", "Learning about the infected system."),
    ("T1046", "Network Service Discovery", "Discovery", "Scanning for services on the network."),
    ("T1021", "Remote Services", "Lateral Movement", "Moving to other machines with RDP, SSH, SMB."),
    ("T1219", "Remote Access Tools", "Command and Control", "Abusing remote desktop apps such as AnyDesk."),
    ("T1071", "Application Layer Protocol", "Command and Control", "Hiding control traffic in normal web traffic."),
    ("T1105", "Ingress Tool Transfer", "Command and Control", "Downloading more tools into the victim."),
    ("T1041", "Exfiltration Over C2 Channel", "Exfiltration", "Sending stolen data over the control channel."),
    ("T1567", "Exfiltration Over Web Service", "Exfiltration", "Uploading stolen data to cloud services."),
    ("T1486", "Data Encrypted for Impact", "Impact", "Ransomware encrypting files."),
    ("T1490", "Inhibit System Recovery", "Impact", "Deleting backups and shadow copies."),
    ("T1657", "Financial Theft", "Impact", "Stealing money through fraud, extortion or theft."),
    ("T1656", "Impersonation", "Defense Evasion", "Pretending to be a trusted person or organisation."),
    ("T1585", "Establish Accounts", "Resource Development", "Creating fake social, email or payment accounts."),
    ("T1583", "Acquire Infrastructure", "Resource Development", "Buying domains and servers for attacks."),
]


def _seed_attack() -> None:
    if PDB.scalar("SELECT COUNT(*) FROM intel_attack") == 0:
        for tid, name, tactic, desc in ATTACK_CORE:
            url = "https://attack.mitre.org/techniques/" + tid.replace(".", "/") + "/"
            PDB.execute("INSERT OR IGNORE INTO intel_attack VALUES (?,?,?,?,?)", (tid, name, tactic, desc, url))


_seed_attack()

# --------------------------------------------------------------- Fraud Intelligence Center enrichment
EXTRA_FRAUDS = [
    {"id": "crypto", "category": "investment_scam", "title": "Crypto investment and 'pig-butchering' scams",
     "how": "A friendly stranger or a group promotes a crypto trading app showing huge profits; withdrawals are blocked until you pay 'tax' or 'fees'.",
     "flags": ["Guaranteed or very high returns", "Private app or website, not a regulated exchange", "Pressure to invest more before you can withdraw"],
     "stop": ["Use only regulated exchanges and brokers", "Never pay to unlock a withdrawal", "Search the app name with 'scam' first"],
     "victim": ["Stop paying immediately", "Call 1930 and report at cybercrime.gov.in", "Save chats, wallet addresses and transaction IDs"]},
    {"id": "deepfake", "category": "deepfake_audio", "title": "Deepfake video calls and celebrity endorsements",
     "how": "AI-made videos of celebrities, officials or your boss promote schemes or ask for urgent payments; live video calls can be faked too.",
     "flags": ["Famous person promoting a 'secret' investment", "Lip movement or lighting looks odd", "Request for money or secrecy on a video call"],
     "stop": ["Verify through an official channel", "Agree a code word with family and finance teams", "Never pay because of a video alone"],
     "victim": ["Report the video to the platform", "Call 1930 if money moved", "Warn contacts who may get the same video"]},
    {"id": "ai_generated", "category": "impersonation", "title": "AI-written phishing and chatbot scams",
     "how": "AI writes perfect, personalised messages in any language and runs fake support chatbots that collect card details and OTPs.",
     "flags": ["Flawless but urgent message from a 'bank' or 'company'", "Chatbot asks for OTP, PIN or card number", "Link to a look-alike website"],
     "stop": ["Good grammar is no longer a sign of safety — check the link and the request", "Never share codes with a chatbot", "Use official apps"],
     "victim": ["Change passwords and block cards", "Call 1930", "Report the site to the brand and to cybercrime.gov.in"]},
    {"id": "identity_theft", "category": "impersonation", "title": "Identity theft (Aadhaar, PAN, SIM in your name)",
     "how": "Criminals use leaked or photographed ID documents to open SIMs, bank accounts or loans in your name.",
     "flags": ["OTPs or loan messages you never requested", "Unknown SIMs listed under your name", "Calls from lenders about loans you didn't take"],
     "stop": ["Check SIMs in your name on Sanchar Saathi", "Lock Aadhaar biometrics on myaadhaar.uidai.gov.in", "Mask Aadhaar copies and write the purpose on them"],
     "victim": ["Report unknown SIMs on Sanchar Saathi", "Inform your bank and credit bureaus", "File a complaint on cybercrime.gov.in"]},
    {"id": "whatsapp_takeover", "category": "otp_theft", "title": "WhatsApp account takeover",
     "how": "A 'friend' asks you to forward a 6-digit code sent 'by mistake'. It is your WhatsApp registration code; they take over your account and message your contacts for money.",
     "flags": ["Someone asks for a code you didn't request", "Contacts suddenly ask you for money", "You are logged out of WhatsApp"],
     "stop": ["Never share WhatsApp codes", "Turn on two-step verification in WhatsApp settings", "Verify money requests by calling"],
     "victim": ["Re-register WhatsApp with your number", "Email support@whatsapp.com to deactivate", "Tell contacts not to pay"]},
    {"id": "sim_swap", "category": "otp_theft", "title": "SIM swap",
     "how": "Fraudsters get a duplicate of your SIM from the operator, receive your OTPs and empty your bank account.",
     "flags": ["Your phone suddenly shows 'No service' for a long time", "Bank alerts stop arriving", "Calls asking you to 'upgrade to 5G' by sending an SMS"],
     "stop": ["Never send SIM-upgrade SMS on request", "Use app-based authentication where possible", "Set a SIM lock PIN"],
     "victim": ["Call your operator immediately", "Ask your bank to freeze accounts", "Call 1930"]},
]
_existing = {g["id"] for g in product2.FRAUD_GUIDE}
for _g in EXTRA_FRAUDS:
    if _g["id"] not in _existing:
        product2.FRAUD_GUIDE.append(_g)

ADV = {
    "in_ncrp": {"name": "cybercrime.gov.in (I4C)", "url": "https://cybercrime.gov.in"},
    "in_chakshu": {"name": "Chakshu, Sanchar Saathi (DoT)", "url": "https://sancharsaathi.gov.in/sfc/"},
    "in_rbi": {"name": "RBI Kehta Hai", "url": "https://rbikehtahai.rbi.org.in/"},
    "in_npci": {"name": "NPCI safety tips", "url": "https://www.npci.org.in/"},
    "in_sebi": {"name": "SEBI investor alerts", "url": "https://www.sebi.gov.in/"},
    "in_uidai": {"name": "UIDAI (Aadhaar lock)", "url": "https://myaadhaar.uidai.gov.in/"},
    "us_ftc": {"name": "FTC consumer alerts (US)", "url": "https://consumer.ftc.gov/"},
    "us_ic3": {"name": "FBI IC3 (US)", "url": "https://www.ic3.gov/"},
    "uk_af": {"name": "Action Fraud (UK)", "url": "https://www.actionfraud.police.uk/"},
    "eu_europol": {"name": "Europol crime prevention", "url": "https://www.europol.europa.eu/"},
}
# risk (likelihood) and impact are 0–100 analyst baselines; live report volume moves risk up to +15
FRAUD_META: Dict[str, Dict[str, Any]] = {
    "upi_qr": {"risk": 85, "impact": 50, "channels": ["UPI", "QR", "Marketplace apps"], "countries": ["India"], "attack": ["T1656", "T1657"], "adv": ["in_ncrp", "in_npci", "in_rbi"]},
    "kyc": {"risk": 80, "impact": 60, "channels": ["SMS", "WhatsApp", "Calls"], "countries": ["India", "Bangladesh", "Pakistan"], "attack": ["T1566.002", "T1598"], "adv": ["in_rbi", "in_chakshu", "in_ncrp"]},
    "otp": {"risk": 80, "impact": 65, "channels": ["Calls", "SMS"], "countries": ["India", "Global"], "attack": ["T1111", "T1566.004"], "adv": ["in_rbi", "in_ncrp"]},
    "jobs": {"risk": 75, "impact": 60, "channels": ["WhatsApp", "Telegram", "Job sites"], "countries": ["India", "Southeast Asia", "Global"], "attack": ["T1656", "T1585"], "adv": ["in_ncrp", "us_ftc"]},
    "digital_arrest": {"risk": 70, "impact": 90, "channels": ["Video calls", "Calls"], "countries": ["India"], "attack": ["T1656", "T1566.004", "T1657"], "adv": ["in_ncrp", "in_chakshu"]},
    "voice_clone": {"risk": 55, "impact": 75, "channels": ["Calls", "WhatsApp voice"], "countries": ["Global"], "attack": ["T1656", "T1566.004"], "adv": ["in_ncrp", "us_ftc"]},
    "investment": {"risk": 75, "impact": 95, "channels": ["WhatsApp groups", "Telegram", "Social ads", "Fake apps"], "countries": ["India", "Global"], "attack": ["T1656", "T1585", "T1657"], "adv": ["in_sebi", "in_ncrp", "us_ic3"]},
    "phishing": {"risk": 85, "impact": 60, "channels": ["Email", "SMS", "Social media"], "countries": ["Global"], "attack": ["T1566", "T1566.002", "T1598"], "adv": ["in_ncrp", "uk_af", "us_ftc"]},
    "malware_apk": {"risk": 70, "impact": 80, "channels": ["WhatsApp", "SMS"], "countries": ["India", "Southeast Asia"], "attack": ["T1204", "T1111", "T1219"], "adv": ["in_ncrp", "in_chakshu"]},
    "loan_app": {"risk": 60, "impact": 70, "channels": ["Apps", "Social ads"], "countries": ["India", "Kenya", "Nigeria", "Philippines"], "attack": ["T1656", "T1657"], "adv": ["in_rbi", "in_ncrp"]},
    "sextortion": {"risk": 60, "impact": 70, "channels": ["Video calls", "Social media"], "countries": ["Global"], "attack": ["T1656", "T1657"], "adv": ["in_ncrp", "us_ic3"]},
    "electricity": {"risk": 65, "impact": 50, "channels": ["SMS", "Calls"], "countries": ["India"], "attack": ["T1566.004", "T1219"], "adv": ["in_chakshu", "in_ncrp"]},
    "crypto": {"risk": 65, "impact": 95, "channels": ["Social media", "Dating apps", "Telegram"], "countries": ["Global"], "attack": ["T1656", "T1585", "T1657"], "adv": ["in_sebi", "us_ic3", "eu_europol"]},
    "deepfake": {"risk": 50, "impact": 85, "channels": ["Video ads", "Video calls"], "countries": ["Global"], "attack": ["T1656"], "adv": ["in_ncrp", "us_ftc", "eu_europol"]},
    "ai_generated": {"risk": 70, "impact": 65, "channels": ["Email", "Chatbots", "SMS"], "countries": ["Global"], "attack": ["T1566", "T1598", "T1656"], "adv": ["in_ncrp", "uk_af", "us_ftc"]},
    "identity_theft": {"risk": 55, "impact": 80, "channels": ["Leaked ID copies", "SIM shops", "Loan apps"], "countries": ["India", "Global"], "attack": ["T1585", "T1078"], "adv": ["in_chakshu", "in_uidai", "in_ncrp"]},
    "whatsapp_takeover": {"risk": 70, "impact": 55, "channels": ["WhatsApp"], "countries": ["India", "Brazil", "Global"], "attack": ["T1111", "T1656"], "adv": ["in_ncrp", "uk_af"]},
    "sim_swap": {"risk": 40, "impact": 90, "channels": ["Telecom", "SMS"], "countries": ["India", "Nigeria", "Global"], "attack": ["T1111"], "adv": ["in_chakshu", "in_rbi", "in_ncrp"]},
}


@router.get("/api/fraud-center")
async def fraud_center():
    base = await product2.fraud_guide()
    attack = {r["id"]: r for r in PDB.query("SELECT * FROM intel_attack")}
    out = []
    for g in base["items"]:
        m = FRAUD_META.get(g["id"], {"risk": 50, "impact": 50, "channels": [], "countries": [], "attack": [], "adv": ["in_ncrp"]})
        boost = min(15, g["week_count"] * 2) + (5 if g.get("trend") == "up" else 0)
        risk = min(100, m["risk"] + boost)
        out.append({**g, "risk": risk, "impact": m["impact"], "score": round((risk * m["impact"]) / 100),
                    "channels": m["channels"], "countries": m["countries"],
                    "attack": [{"id": t, "name": attack.get(t, {}).get("name", t), "url": attack.get(t, {}).get("url", "")} for t in m["attack"]],
                    "advisories": [ADV[a] for a in m["adv"] if a in ADV]})
    out.sort(key=lambda x: -x["score"])
    return {"items": out, "since": base["since"], "reports_by_kind": base["reports_by_kind"]}


# --------------------------------------------------------------- fetching
def _get(url: str, headers: Optional[Dict[str, str]] = None, limit: int = 30 * 1024 * 1024) -> Optional[bytes]:
    if not url.lower().startswith("https://"):
        return None
    req = urllib.request.Request(url, headers={"User-Agent": f"ProblemHunt/{config.VERSION} (+threat-intel)", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:  # noqa: S310 - admin/government https feeds
            return r.read(limit)
    except Exception as exc:
        log.info("intel source unavailable %s: %s", url[:80], exc)
        return None


def _run(source: str, ok: bool, count: int = 0, error: str = "") -> None:
    now = now_iso()
    PDB.execute("INSERT INTO intel_runs(source, last_ok, last_try, count, error) VALUES (?,?,?,?,?) "
                "ON CONFLICT(source) DO UPDATE SET last_try=excluded.last_try, count=CASE WHEN ? THEN excluded.count ELSE count END, "
                "last_ok=CASE WHEN ? THEN excluded.last_try ELSE last_ok END, error=excluded.error",
                (source, now if ok else "", now, count, error, int(ok), int(ok)))


def ingest_kev(data: Dict[str, Any]) -> int:
    n = 0
    for v in data.get("vulnerabilities", []):
        cve = str(v.get("cveID", "")).strip()
        if not re.fullmatch(r"CVE-\d{4}-\d{4,7}", cve):
            continue
        PDB.execute(
            "INSERT INTO intel_cves(cve, vendor, product, name, description, date_added, due_date, required_action, ransomware, kev, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(cve) DO UPDATE SET vendor=excluded.vendor, product=excluded.product, name=excluded.name, "
            "description=excluded.description, date_added=excluded.date_added, due_date=excluded.due_date, "
            "required_action=excluded.required_action, ransomware=excluded.ransomware, kev=1, updated_at=excluded.updated_at",
            (cve, str(v.get("vendorProject", ""))[:120], str(v.get("product", ""))[:120], str(v.get("vulnerabilityName", ""))[:300],
             str(v.get("shortDescription", ""))[:2000], str(v.get("dateAdded", ""))[:10], str(v.get("dueDate", ""))[:10],
             str(v.get("requiredAction", ""))[:600], str(v.get("knownRansomwareCampaignUse", ""))[:20], now_iso()))
        n += 1
    return n


def ingest_epss(data: Dict[str, Any]) -> int:
    n = 0
    for d in data.get("data", []):
        try:
            PDB.execute("UPDATE intel_cves SET epss=?, percentile=? WHERE cve=?", (float(d["epss"]), float(d["percentile"]), d["cve"]))
            n += 1
        except (KeyError, ValueError):
            continue
    return n


def ingest_nvd(data: Dict[str, Any]) -> int:
    n = 0
    for item in data.get("vulnerabilities", []):
        c = item.get("cve", {})
        cve = c.get("id", "")
        if not re.fullmatch(r"CVE-\d{4}-\d{4,7}", cve):
            continue
        desc = next((d.get("value", "") for d in c.get("descriptions", []) if d.get("lang") == "en"), "")
        score, sev = None, ""
        for key in ("cvssMetricV40", "cvssMetricV31", "cvssMetricV30"):
            ms = c.get("metrics", {}).get(key) or []
            if ms:
                cd = ms[0].get("cvssData", {})
                score, sev = cd.get("baseScore"), cd.get("baseSeverity", "")
                break
        PDB.execute("INSERT INTO intel_cves(cve, description, cvss, severity, published, updated_at) VALUES (?,?,?,?,?,?) "
                    "ON CONFLICT(cve) DO UPDATE SET cvss=COALESCE(excluded.cvss, cvss), severity=excluded.severity, "
                    "published=excluded.published, description=CASE WHEN description='' THEN excluded.description ELSE description END",
                    (cve, desc[:2000], score, sev, str(c.get("published", ""))[:10], now_iso()))
        n += 1
    return n


_TAG = re.compile(r"<[^>]+>")


def _clean(s: str, n: int) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", s or ""))).strip()[:n]


def parse_rss(raw: bytes, source: str, region: str) -> List[Dict[str, Any]]:
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    out = []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    items = root.findall(".//item") or root.findall(".//a:entry", ns)
    for it in items[:60]:
        title = _clean(it.findtext("title") or it.findtext("a:title", namespaces=ns) or "", 300)
        link = (it.findtext("link") or "").strip()
        if not link:
            le = it.find("a:link", ns)
            link = le.get("href", "") if le is not None else ""
        if not title or not link.lower().startswith(("https://", "http://")):
            continue
        pub = it.findtext("pubDate") or it.findtext("a:updated", namespaces=ns) or it.findtext("a:published", namespaces=ns) or ""
        try:
            from email.utils import parsedate_to_datetime  # noqa: PLC0415
            pub_iso = parsedate_to_datetime(pub).astimezone(timezone.utc).isoformat() if "," in pub else pub[:25]
        except Exception:
            pub_iso = pub[:25]
        summ = _clean(it.findtext("description") or it.findtext("a:summary", namespaces=ns) or "", 600)
        cves = sorted(set(re.findall(r"CVE-\d{4}-\d{4,7}", title + " " + summ)))
        out.append({"id": hashlib.sha1(link.encode()).hexdigest()[:20], "source": source[:60], "region": region[:20], "title": title,
                    "link": link[:600], "published": pub_iso or now_iso(), "summary": summ, "cves": ",".join(cves[:20]), "created_at": now_iso()})
    return out


def ingest_advisories(rows: List[Dict[str, Any]]) -> int:
    n = 0
    for r in rows:
        if not PDB.get("intel_advisories", r["id"]):
            PDB.insert("intel_advisories", r)
            n += 1
    return n


async def refresh_all() -> Dict[str, Any]:
    s = PDB.settings()
    res: Dict[str, Any] = {}
    raw = await asyncio.to_thread(_get, KEV_URL)
    if raw:
        try:
            n = ingest_kev(json.loads(raw))
            _run("cisa_kev", True, n)
            res["kev"] = n
        except ValueError as exc:
            _run("cisa_kev", False, error=str(exc)[:200])
    else:
        _run("cisa_kev", False, error="unreachable")
    since = (datetime.now(timezone.utc) - timedelta(days=120)).strftime("%Y-%m-%d")
    cves = [r["cve"] for r in PDB.query("SELECT cve FROM intel_cves WHERE kev=1 AND (date_added>=? OR epss IS NULL) ORDER BY date_added DESC LIMIT 600", (since,))]
    got = 0
    for i in range(0, len(cves), 80):
        raw = await asyncio.to_thread(_get, EPSS_URL + ",".join(cves[i:i + 80]))
        if raw:
            try:
                got += ingest_epss(json.loads(raw))
            except ValueError:
                pass
    _run("first_epss", got > 0 or not cves, got)
    res["epss"] = got
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    q = f"{NVD_URL}?pubStartDate={start.strftime('%Y-%m-%dT%H:%M:%S.000')}&pubEndDate={end.strftime('%Y-%m-%dT%H:%M:%S.000')}&cvssV3Severity=CRITICAL&resultsPerPage=200"
    raw = await asyncio.to_thread(_get, q, {"apiKey": s["nvd_api_key"]} if s.get("nvd_api_key") else None)
    if raw:
        try:
            n = ingest_nvd(json.loads(raw))
            _run("nist_nvd", True, n)
            res["nvd"] = n
        except ValueError as exc:
            _run("nist_nvd", False, error=str(exc)[:200])
    else:
        _run("nist_nvd", False, error="unreachable")
    total = 0
    for f in (s.get("intel_feeds") or [])[:30]:
        url = str(f.get("url", ""))
        raw = await asyncio.to_thread(_get, url, None, 5 * 1024 * 1024)
        rows = parse_rss(raw, f.get("name", url), f.get("region", "")) if raw else []
        total += ingest_advisories(rows)
        _run("rss:" + f.get("name", url)[:40], bool(raw), len(rows), "" if raw else "unreachable")
    res["advisories"] = total
    return res


async def intel_loop() -> None:
    await asyncio.sleep(20)
    while True:
        try:
            if PDB.settings().get("intel_enabled", True):
                r = await refresh_all()
                log.info("threat intel refreshed: %s", r)
        except Exception as exc:  # never crash the server
            log.warning("intel refresh failed: %s", exc)
        await asyncio.sleep(6 * 3600)


# --------------------------------------------------------------- read APIs
@router.get("/api/intel/summary")
async def intel_summary():
    since = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    return {
        "kev_total": PDB.scalar("SELECT COUNT(*) FROM intel_cves WHERE kev=1"),
        "kev_30d": PDB.scalar("SELECT COUNT(*) FROM intel_cves WHERE kev=1 AND date_added>=?", (since,)),
        "ransomware": PDB.scalar("SELECT COUNT(*) FROM intel_cves WHERE kev=1 AND ransomware='Known'"),
        "critical_7d": PDB.scalar("SELECT COUNT(*) FROM intel_cves WHERE severity='CRITICAL' AND published>=?",
                                  ((datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d"),)),
        "advisories_7d": PDB.scalar("SELECT COUNT(*) FROM intel_advisories WHERE created_at>=?",
                                    ((datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),)),
        "techniques": PDB.scalar("SELECT COUNT(*) FROM intel_attack"),
        "latest_kev": PDB.query("SELECT cve, vendor, product, name, date_added, epss FROM intel_cves WHERE kev=1 ORDER BY date_added DESC LIMIT 6"),
        "latest_advisories": PDB.query("SELECT source, title, link, published FROM intel_advisories ORDER BY published DESC LIMIT 6"),
        "runs": PDB.query("SELECT * FROM intel_runs ORDER BY source"),
    }


@router.get("/api/intel/cves")
async def intel_cves(q: str = "", kev: bool = True, sort: str = "date", ransomware: bool = False, limit: int = 100):
    where, params = ["1=1"], []
    if kev:
        where.append("kev=1")
    if ransomware:
        where.append("ransomware='Known'")
    if q.strip():
        where.append("(cve LIKE ? OR vendor LIKE ? OR product LIKE ? OR name LIKE ?)")
        params += [f"%{q.strip()}%"] * 4
    order = {"epss": "COALESCE(epss,0) DESC", "cvss": "COALESCE(cvss,0) DESC"}.get(sort, "COALESCE(NULLIF(date_added,''), published) DESC")
    return PDB.query(f"SELECT * FROM intel_cves WHERE {' AND '.join(where)} ORDER BY {order} LIMIT ?", (*params, max(1, min(limit, 500))))


@router.get("/api/intel/cves/{cve}")
async def intel_cve(cve: str):
    r = (PDB.query("SELECT * FROM intel_cves WHERE cve=?", (cve.upper(),)) or [None])[0]
    if not r:
        raise HTTPException(404, "Not in the local database yet")
    r["advisories"] = PDB.query("SELECT source, title, link, published FROM intel_advisories WHERE cves LIKE ? ORDER BY published DESC LIMIT 10",
                                (f"%{cve.upper()}%",))
    r["links"] = {"nvd": f"https://nvd.nist.gov/vuln/detail/{cve.upper()}", "cve_org": f"https://www.cve.org/CVERecord?id={cve.upper()}"}
    return r


@router.get("/api/intel/advisories")
async def intel_advisories(q: str = "", source: str = "", limit: int = 60):
    where, params = ["1=1"], []
    if q.strip():
        where.append("(title LIKE ? OR summary LIKE ?)")
        params += [f"%{q.strip()}%"] * 2
    if source:
        where.append("source=?")
        params.append(source)
    return {"items": PDB.query(f"SELECT * FROM intel_advisories WHERE {' AND '.join(where)} ORDER BY published DESC LIMIT ?",
                               (*params, max(1, min(limit, 300)))),
            "sources": [r["source"] for r in PDB.query("SELECT DISTINCT source FROM intel_advisories ORDER BY source")]}


@router.get("/api/intel/attack")
async def intel_attack(q: str = "", tactic: str = ""):
    where, params = ["1=1"], []
    if q.strip():
        where.append("(id LIKE ? OR name LIKE ? OR description LIKE ?)")
        params += [f"%{q.strip()}%"] * 3
    if tactic:
        where.append("tactic=?")
        params.append(tactic)
    rows = PDB.query(f"SELECT * FROM intel_attack WHERE {' AND '.join(where)} ORDER BY id LIMIT 400", params)
    return {"items": rows, "tactics": [r["tactic"] for r in PDB.query("SELECT DISTINCT tactic FROM intel_attack ORDER BY tactic")]}


@admin.post("/intel/refresh")
async def admin_intel_refresh():
    return await refresh_all()


@admin.post("/intel/attack/full")
async def admin_attack_full():
    """Download the full MITRE ATT&CK enterprise bundle (~40 MB) and load every technique."""
    raw = await asyncio.to_thread(_get, ATTACK_URL, None, 80 * 1024 * 1024)
    if not raw:
        raise HTTPException(502, "Could not download MITRE ATT&CK (check internet access)")
    try:
        bundle = json.loads(raw)
    except ValueError:
        raise HTTPException(502, "Downloaded file was not valid JSON")
    n = 0
    for o in bundle.get("objects", []):
        if o.get("type") != "attack-pattern" or o.get("revoked") or o.get("x_mitre_deprecated"):
            continue
        ref = next((e for e in o.get("external_references", []) if e.get("source_name") == "mitre-attack"), None)
        if not ref:
            continue
        tactic = ", ".join(p.get("phase_name", "").replace("-", " ").title() for p in o.get("kill_chain_phases", []))
        desc = _clean((o.get("description") or "").split("\n")[0], 400)
        PDB.execute("INSERT OR REPLACE INTO intel_attack VALUES (?,?,?,?,?)", (ref["external_id"], o.get("name", ""), tactic, desc, ref.get("url", "")))
        n += 1
    return {"loaded": n}

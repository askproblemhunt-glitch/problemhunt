"""Deterministic, explainable threat-detection engine.

Runs in microseconds, never touches the network (scanned URLs are analysed
statically - we never fetch attacker-controlled links, which avoids SSRF and
drive-by risks), and is continuously extended by rules the AI agent learns.
"""
from __future__ import annotations

import re
import threading
import time
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import unquote, urlsplit

from .models import CATEGORY_LABELS, Rule

# ---------------------------------------------------------------------------
# Static knowledge
# ---------------------------------------------------------------------------
URL_RE = re.compile(
    r"""(?ix)
    \b(
        (?:https?://|hxxps?://|www\.)[^\s<>"'`]{2,2000}
        |
        (?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,30})(?![a-z0-9@-])(?:/[^\s<>"'`]*)?
    )""",
)

SUSPICIOUS_TLDS = {
    "zip", "mov", "xyz", "top", "click", "tk", "ml", "ga", "cf", "gq", "cam", "rest",
    "sbs", "cfd", "lol", "icu", "buzz", "monster", "quest", "bond", "work", "support",
    "loan", "win", "bid", "country", "kim", "men", "date", "review", "live", "shop",
}
SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "rb.gy", "shorturl.at", "tiny.cc",
    "ow.ly", "buff.ly", "rebrand.ly", "t.ly", "s.id", "v.gd", "goo.su", "qrco.de", "shorturl.gg",
}
MULTI_PART_SUFFIXES = {
    "co.in", "co.uk", "com.au", "co.jp", "com.br", "co.za", "org.in", "net.in", "gov.in",
    "ac.in", "org.uk", "com.sg", "com.my", "com.ng", "com.pk", "co.id", "com.mx",
}
# brand keyword -> legitimate registered domains
BRANDS: Dict[str, Set[str]] = {
    "paypal": {"paypal.com", "paypal.me"},
    "amazon": {"amazon.com", "amazon.in", "amazon.co.uk", "amazon.de", "amazonaws.com"},
    "apple": {"apple.com", "icloud.com"},
    "icloud": {"icloud.com", "apple.com"},
    "microsoft": {"microsoft.com", "live.com", "office.com", "microsoftonline.com"},
    "office365": {"office.com", "microsoft.com"},
    "outlook": {"outlook.com", "live.com", "office.com"},
    "google": {"google.com", "google.co.in", "googleusercontent.com", "gstatic.com"},
    "gmail": {"gmail.com", "google.com"},
    "netflix": {"netflix.com"},
    "whatsapp": {"whatsapp.com", "whatsapp.net", "wa.me"},
    "facebook": {"facebook.com", "fb.com"},
    "instagram": {"instagram.com"},
    "linkedin": {"linkedin.com"},
    "sbi": {"sbi.co.in", "onlinesbi.sbi", "sbi"},
    "hdfc": {"hdfcbank.com", "hdfc.com"},
    "icici": {"icicibank.com"},
    "axis": {"axisbank.com"},
    "paytm": {"paytm.com"},
    "phonepe": {"phonepe.com"},
    "dhl": {"dhl.com"},
    "fedex": {"fedex.com"},
    "indiapost": {"indiapost.gov.in"},
    "usps": {"usps.com"},
    "irs": {"irs.gov"},
    "incometax": {"incometax.gov.in"},
    "binance": {"binance.com"},
    "coinbase": {"coinbase.com"},
    "metamask": {"metamask.io"},
    "aol": {"aol.com"},
    "yahoo": {"yahoo.com"},
    "chase": {"chase.com"},
    "wellsfargo": {"wellsfargo.com"},
    "bankofamerica": {"bankofamerica.com"},
    "docusign": {"docusign.com", "docusign.net"},
    "adobe": {"adobe.com"},
    "dropbox": {"dropbox.com"},
    "ebay": {"ebay.com", "ebay.in"},
    "steam": {"steampowered.com", "steamcommunity.com"},
    "roblox": {"roblox.com"},
    "telegram": {"telegram.org", "t.me"},
    "sharepoint": {"sharepoint.com", "microsoft.com"},
    "onedrive": {"live.com", "onedrive.com", "microsoft.com"},
    "office": {"office.com", "microsoft.com"},
    "att": {"att.com"},
    "usps": {"usps.com"},
    "spotify": {"spotify.com"},
    "airtel": {"airtel.in"},
    "jio": {"jio.com"},
    "flipkart": {"flipkart.com"},
}
BRAND_DISPLAY = {
    "paypal": "PayPal", "sbi": "SBI", "hdfc": "HDFC", "icici": "ICICI", "dhl": "DHL", "irs": "IRS", "usps": "USPS",
    "fedex": "FedEx", "phonepe": "PhonePe", "whatsapp": "WhatsApp", "linkedin": "LinkedIn", "icloud": "iCloud",
    "office365": "Office365", "metamask": "MetaMask", "indiapost": "IndiaPost", "incometax": "IncomeTax",
    "aol": "AOL", "att": "AT&T", "wellsfargo": "Wells Fargo", "bankofamerica": "Bank of America",
    "docusign": "DocuSign", "ebay": "eBay", "sharepoint": "SharePoint", "onedrive": "OneDrive",
}
CREDENTIAL_WORDS = ("login", "signin", "verify", "secure", "update", "account", "wallet",
                    "kyc", "unlock", "confirm", "billing", "auth", "recover", "reward", "claim")
DANGEROUS_EXT = re.compile(r"\.(apk|exe|scr|msi|bat|cmd|js|vbs|jar|ps1|hta|iso|img|dmg|lnk)(\?|$)", re.I)
LEET = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})

# Seed linguistic signatures: (phrase-regex, category, weight, indicator label)
SEED_SIGNATURES: List[Tuple[str, str, int, str]] = [
    # job / task scams
    (r"work\s*from\s*home", "job_scam", 12, "Work-from-home lure"),
    (r"part[\s-]*time\s*(job|work|opportunit)", "job_scam", 16, "Unsolicited part-time job offer"),
    (r"(earn|income|salary)[^.\n]{0,25}(₹|rs\.?|inr|\$|usd)\s?\d", "job_scam", 14, "Quick-money income promise"),
    (r"(daily|per\s*day)\s*(income|earning|payout|salary)", "job_scam", 14, "Daily payout promise"),
    (r"(like|subscribe|rate|review)[^.\n]{0,20}(youtube|videos?|hotels?|products?|google\s*maps)", "job_scam", 22, "Like/review task scheme"),
    (r"telegram[^.\n]{0,30}(task|mentor|group|receptionist|hr)", "job_scam", 20, "Move-to-Telegram task funnel"),
    (r"(registration|joining|security|processing)\s*(fee|deposit|charge)", "job_scam", 22, "Upfront fee demanded"),
    (r"(prepaid|merchant|vip)\s*task", "job_scam", 25, "Prepaid task (deposit) scheme"),
    (r"no\s*(interview|experience)\s*(needed|required)", "job_scam", 12, "No-interview hiring"),
    # OTP theft
    (r"(share|send|tell|forward|read\s*out)[^.\n]{0,25}(otp|one[\s-]*time\s*pass(word|code)|verification\s*code|6[\s-]*digit\s*code)", "otp_theft", 38, "Asks you to share an OTP/code"),
    (r"(otp|code)[^.\n]{0,25}(sent\s*by\s*mistake|wrongly\s*sent|by\s*mistake)", "otp_theft", 30, "'OTP sent by mistake' trick"),
    # payment / KYC fraud
    (r"\bkyc\b[^.\n]{0,40}(expire|pending|update|suspend|block|incomplete)", "payment_fraud", 28, "Fake KYC-expiry pressure"),
    (r"(account|card|wallet|sim|number)[^.\n]{0,30}(will\s*be\s*)?(blocked|suspended|deactivated|frozen|closed)", "payment_fraud", 20, "Account-block threat"),
    (r"(electricity|power|gas)[^.\n]{0,30}(disconnect|cut)", "payment_fraud", 26, "Utility disconnection scare"),
    (r"upi\s*pin", "payment_fraud", 30, "Requests UPI PIN"),
    (r"(confirm|verify|share|update|tell|provide)[^.\n]{0,30}(card\s*(details|number)|cvv|expiry\s*date|atm\s*pin|net[\s-]*banking|password)", "payment_fraud", 34, "Asks for card / banking credentials"),
    (r"(bank|branch|account)\s*(manager|officer|executive)", "impersonation", 12, "Claims to be bank staff"),
    (r"(collect|payment)\s*request[^.\n]{0,30}(accept|approve)", "payment_fraud", 22, "Approve-collect-request trick"),
    (r"(refund|cashback|prize|lottery|reward)[^.\n]{0,40}(claim|receive|credited|pending|won)", "payment_fraud", 18, "Unexpected refund/prize"),
    (r"(gift\s*card|itunes\s*card|google\s*play\s*card|steam\s*card)", "payment_fraud", 18, "Gift-card payment request"),
    # investment
    (r"(guaranteed|assured|fixed)\s*(returns?|profit)", "investment_scam", 26, "Guaranteed returns claim"),
    (r"(double|triple|10x)\s*(your)?\s*(money|investment|crypto)", "investment_scam", 28, "Money-multiplier promise"),
    (r"\d{2,3}\s*%\s*(daily|weekly|monthly)?\s*(profit|returns?|roi)", "investment_scam", 22, "Unrealistic ROI"),
    (r"(trading|stock|ipo)\s*(tips|signals|group)[^.\n]{0,30}(whatsapp|telegram|vip)", "investment_scam", 20, "VIP trading-tips group"),
    (r"(usdt|bitcoin|btc|crypto)[^.\n]{0,30}(deposit|wallet\s*address|send)", "investment_scam", 16, "Crypto deposit request"),
    # deepfake voice / family-emergency
    (r"(this\s*is\s*your|it'?s\s*(me|your))\s*(son|daughter|mom|mum|dad|grandson|granddaughter|boss)", "deepfake_audio", 22, "Claims to be family/boss"),
    (r"(i'?m|i\s*am)\s*in\s*(trouble|jail|hospital|police\s*custody)", "deepfake_audio", 24, "Staged emergency"),
    (r"(don'?t|do\s*not)\s*tell\s*(anyone|mom|dad|the\s*police|your\s*family)", "deepfake_audio", 22, "Secrecy demand"),
    (r"(kidnapped|ransom|accident)[^.\n]{0,40}(money|transfer|pay)", "deepfake_audio", 30, "Ransom / accident money demand"),
    (r"(new|different)\s*(number|phone)[^.\n]{0,30}(save|lost|broke)", "deepfake_audio", 14, "'New number' pretext"),
    # impersonation / digital arrest
    (r"digital\s*arrest", "impersonation", 40, "'Digital arrest' extortion"),
    (r"(cbi|police|customs|narcotics|ed\b|income\s*tax|fbi|irs)[^.\n]{0,40}(parcel|case|warrant|arrest|summon|illegal)", "impersonation", 30, "Fake law-enforcement threat"),
    (r"(parcel|package|courier|shipment)[^.\n]{0,40}(held|seized|on\s*hold|customs|undeliver|address\s*incomplete)", "impersonation", 20, "Parcel-held lure"),
    (r"dear\s*(customer|user|valued\s*member)", "impersonation", 6, "Generic greeting"),
    (r"(remote|screen)[\s-]*(access|share)|anydesk|teamviewer|rustdesk|quick\s*support", "impersonation", 30, "Remote-access app request"),
    (r"(share|send|tell)[^.\n]{0,20}(access|anydesk|teamviewer)\s*(code|id)", "impersonation", 22, "Asks for a remote-access code"),
    # fake QR
    (r"scan[^.\n]{0,30}(qr|code)[^.\n]{0,40}(receive|get|claim|refund|credited|payment)", "fake_qr", 34, "'Scan QR to receive money' trap"),
    (r"(receive|get)[^.\n]{0,25}(money|payment|amount)[^.\n]{0,25}scan", "fake_qr", 28, "Receiving money never needs a scan"),
    # malware delivery
    (r"(download|install)[^.\n]{0,30}\.?(apk|app)[^.\n]{0,30}(link|now|below|update)", "malware", 26, "Sideload-app request"),
    (r"(wedding\s*invitation|invoice|challan|traffic\s*fine)[^.\n]{0,30}\.(apk|exe|zip|scr)", "malware", 40, "Malicious attachment lure"),
]
URGENCY = re.compile(
    r"(urgent(ly)?|immediately|within\s*\d+\s*(hours?|hrs|minutes?|mins)|last\s*(warning|chance|reminder)|act\s*now|expires?\s*today|right\s*now|asap|final\s*notice)",
    re.I,
)
FREE_EMAIL_REPLY = re.compile(r"[\w.+-]+@(gmail|yahoo|outlook|hotmail|proton)\.", re.I)


def is_ip(host: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host))


def registered_domain(host: str) -> str:
    host = host.lower().strip(".")
    if is_ip(host):
        return host
    parts = host.split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in MULTI_PART_SUFFIXES:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    return text.replace("​", "").replace("‌", "").replace("‍", "")


def severity_for(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


@dataclass
class Analysis:
    score: int
    category: str
    severity: str
    verdict: str
    indicators: List[str]
    matched_rules: List[str]
    matched_rule_ids: List[str]
    urls: List[str]
    hosts: List[str]
    category_weights: Dict[str, int] = field(default_factory=dict)

    @property
    def label(self) -> str:
        return CATEGORY_LABELS.get(self.category, self.category)


class DetectionEngine:
    """Signature + heuristic engine. Thread-safe; learned rules hot-reload."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._seed = [(re.compile(p, re.I), c, w, label) for p, c, w, label in SEED_SIGNATURES]
        self._keyword_rules: List[Tuple[str, Rule]] = []
        self._domain_rules: Dict[str, Rule] = {}
        self._regex_rules: List[Tuple[re.Pattern, Rule]] = []
        self._intel_urls: Set[str] = set()
        self._intel_hosts: Set[str] = set()
        self.hit_counter: Dict[str, int] = defaultdict(int)

    # ------------------------------------------------------------------ rules
    def load_rules(self, rules: Iterable[Rule]) -> None:
        kw, dom, rx = [], {}, []
        for r in rules:
            if r.kind == "keyword":
                kw.append((r.pattern.lower(), r))
            elif r.kind == "domain":
                dom[r.pattern.lower()] = r
            elif r.kind == "regex" and r.origin == "seed":  # only trusted regexes
                try:
                    rx.append((re.compile(r.pattern, re.I), r))
                except re.error:
                    continue
        with self._lock:
            self._keyword_rules, self._domain_rules, self._regex_rules = kw, dom, rx

    def add_rule(self, r: Rule) -> None:
        with self._lock:
            if r.kind == "keyword":
                self._keyword_rules.append((r.pattern.lower(), r))
            elif r.kind == "domain":
                self._domain_rules[r.pattern.lower()] = r

    def remove_rule(self, rule_id: str) -> None:
        with self._lock:
            self._keyword_rules = [(p, r) for p, r in self._keyword_rules if r.id != rule_id]
            self._domain_rules = {k: r for k, r in self._domain_rules.items() if r.id != rule_id}

    def load_intel(self, items: Iterable[Tuple[str, str]]) -> None:
        urls, hosts = set(), set()
        for value, kind in items:
            (urls if kind == "url" else hosts).add(value)
        with self._lock:
            self._intel_urls |= urls
            self._intel_hosts |= hosts

    @property
    def intel_size(self) -> int:
        return len(self._intel_urls) + len(self._intel_hosts)

    @property
    def rule_count(self) -> int:
        return len(self._keyword_rules) + len(self._domain_rules) + len(self._regex_rules) + len(self._seed)

    # --------------------------------------------------------------- analysis
    def analyse(self, raw: str, kind: str = "auto") -> Analysis:
        text = _normalise(raw)[:8000]
        lower = text.lower()
        weights: Dict[str, int] = defaultdict(int)
        indicators: List[str] = []
        matched: List[str] = []
        matched_ids: List[str] = []

        def hit(cat: str, w: int, label: str) -> None:
            weights[cat] += w
            if label not in indicators:
                indicators.append(label)

        # ---- URLs / hosts
        urls = self._extract_urls(text)
        hosts: List[str] = []
        for url in urls:
            host = self._analyse_url(url, hit)
            if host:
                hosts.append(host)

        # ---- QR payloads
        if kind == "qr" or lower.startswith("upi://"):
            if lower.startswith("upi://pay"):
                if re.search(r"[?&]am=\d", lower):
                    hit("fake_qr", 30, "QR pre-fills a payment amount (you would PAY, not receive)")
                if re.search(r"[?&]pn=[^&]*(refund|prize|reward|cashback|support|helpdesk)", lower):
                    hit("fake_qr", 30, "QR payee name impersonates a refund/support desk")
            elif urls:
                hit("fake_qr", 8, "QR code redirects to a web link")

        # ---- linguistic signatures
        for rx, cat, w, label in self._seed:
            if rx.search(text):
                hit(cat, w, label)

        urgency = len(URGENCY.findall(text))
        if urgency:
            hit(max(weights, key=weights.get) if weights else "impersonation", min(18, 8 * urgency), "Artificial urgency")
        if FREE_EMAIL_REPLY.search(text) and any(w in lower for w in ("bank", "hr", "official", "department")):
            hit("impersonation", 12, "Official-sounding sender using free email")
        if kind == "audio_transcript":
            hit(max(weights, key=weights.get) if weights else "deepfake_audio", 4, "Voice channel (deepfake-capable)")

        # ---- learned rules (hot path)
        with self._lock:
            kw_rules = list(self._keyword_rules)
            dom_rules = dict(self._domain_rules)
            rx_rules = list(self._regex_rules)
            intel_urls, intel_hosts = self._intel_urls, self._intel_hosts
        learned_budget = 50  # learned phrases reinforce, they never dominate
        for pat, r in kw_rules:
            if pat and pat in lower and learned_budget > 0:
                w = min(r.weight, learned_budget)
                learned_budget -= w
                hit(r.category, w, f"Learned signature: “{r.pattern}”")
                matched.append(r.pattern)
                matched_ids.append(r.id)
        for rx, r in rx_rules:
            if rx.search(text):
                hit(r.category, r.weight, r.note or f"Rule {r.id}")
                matched.append(r.pattern)
                matched_ids.append(r.id)
        for host in hosts:
            rd = registered_domain(host)
            r = dom_rules.get(host) or dom_rules.get(rd)
            if r:
                hit(r.category, r.weight, f"Domain on learned blocklist: {r.pattern}")
                matched.append(r.pattern)
                matched_ids.append(r.id)
            if host in intel_hosts:
                hit("phishing_link", 70, f"Host listed in live threat-intel feed: {host}")
                matched.append(f"intel:{host}")
        for url in urls:
            if url.rstrip("/") in intel_urls:
                hit("phishing_link", 85, "Exact URL listed in live threat-intel feed")
                matched.append("intel:url")

        for rid in matched_ids:
            self.hit_counter[rid] += 1

        # ---- score
        total = sum(weights.values())
        score = int(min(100, round(total)))
        category = max(weights, key=weights.get) if weights and score >= 15 else "safe"
        verdict = "malicious" if score >= 60 else "suspicious" if score >= 30 else "safe"
        return Analysis(
            score=score,
            category=category,
            severity=severity_for(score),
            verdict=verdict,
            indicators=indicators[:12],
            matched_rules=matched[:12],
            matched_rule_ids=matched_ids,
            urls=urls[:10],
            hosts=hosts[:10],
            category_weights=dict(weights),
        )

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def _extract_urls(text: str) -> List[str]:
        out: List[str] = []
        for m in URL_RE.finditer(text):
            u = m.group(1).rstrip(".,);:!?]'\"")
            if "." not in u:
                continue
            # skip things like "e.g" / "i.e" / decimals
            if re.fullmatch(r"[a-z]\.[a-z]", u, re.I) or re.fullmatch(r"[\d.]+", u):
                continue
            out.append(u)
            if len(out) >= 25:
                break
        return out

    def _analyse_url(self, url: str, hit) -> Optional[str]:
        u = url
        if u.lower().startswith("hxxp"):
            u = "http" + u[4:]
        if not re.match(r"^[a-z][a-z0-9+.-]*://", u, re.I):
            u = "http://" + u
        try:
            parts = urlsplit(u)
        except ValueError:
            return None
        host = (parts.hostname or "").lower()
        if not host:
            return None
        path = unquote(parts.path + ("?" + parts.query if parts.query else "")).lower()
        rd = registered_domain(host)
        tld = host.rsplit(".", 1)[-1]

        if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):
            hit("phishing_link", 28, f"Raw IP address instead of a domain ({host})")
        if "xn--" in host:
            hit("phishing_link", 30, "Punycode/homoglyph domain (look-alike characters)")
        if tld in SUSPICIOUS_TLDS:
            hit("phishing_link", 16, f"High-abuse top-level domain (.{tld})")
        if rd in SHORTENERS or host in SHORTENERS:
            hit("phishing_link", 12, f"Link shortener hides real destination ({host})")
        if "@" in (parts.netloc or ""):
            hit("phishing_link", 25, "'@' trick in URL hides the real host")
        if host.count(".") >= 4:
            hit("phishing_link", 10, "Excessive sub-domains")
        if host.count("-") >= 3:
            hit("phishing_link", 8, "Hyphen-stuffed domain")
        if parts.scheme == "http" and any(w in host + path for w in CREDENTIAL_WORDS):
            hit("phishing_link", 10, "Credential page served without HTTPS")
        if any(w in host for w in CREDENTIAL_WORDS):
            hit("phishing_link", 10, "Credential bait words in domain")
        if DANGEROUS_EXT.search(parts.path or ""):
            hit("malware", 40, "Link downloads an executable/APK")
        if len(url) > 140:
            hit("phishing_link", 5, "Unusually long URL")

        raw_tokens = [t for t in re.split(r"[.-]", host) if t]
        tokens = [t.translate(LEET) for t in raw_tokens]
        for brand, legit in BRANDS.items():
            if rd in legit or host in legit:
                continue
            found = any(t == brand or (len(brand) >= 5 and t.startswith(brand)) for t in tokens)
            if found:
                leet = not any(t == brand or (len(brand) >= 5 and t.startswith(brand)) for t in raw_tokens)
                hit(
                    "phishing_link",
                    46 if leet else 30,
                    f"Impersonates {BRAND_DISPLAY.get(brand, brand.title())} {'with look-alike characters ' if leet else ''}on unofficial domain {rd}",
                )
                break
        return host


ENGINE = DetectionEngine()
_started = time.time()

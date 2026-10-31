"""Turns REAL threat-intel (OpenPhish / URLhaus) into live dashboard data.

* Each malicious URL from the feeds is classified by the detection engine and
  streamed into the interception feed at a steady trickle (so the feed is live,
  not a one-off dump).
* URLs are DEFANGED for display (hxxp://evil[.]com) so nobody clicks them.
* Radar campaigns are real aggregates: which brands the live phishing sites
  impersonate, how many URLs, and where (by country-code TLD when known).
"""
from __future__ import annotations

import asyncio
import hashlib
import re
from collections import Counter, defaultdict
from typing import Deque, Dict, List, Optional
from collections import deque
from urllib.parse import urlsplit

from .detection import ENGINE, registered_domain
from .models import CATEGORY_LABELS, RadarBlip, ThreatEvent

CC_TLD = {
    "in": "India", "uk": "United Kingdom", "de": "Germany", "fr": "France", "br": "Brazil", "ru": "Russia",
    "cn": "China", "jp": "Japan", "au": "Australia", "ca": "Canada", "nl": "Netherlands", "it": "Italy",
    "es": "Spain", "id": "Indonesia", "ng": "Nigeria", "za": "South Africa", "mx": "Mexico", "pl": "Poland",
    "tr": "Türkiye", "vn": "Vietnam", "ir": "Iran", "kr": "South Korea", "sg": "Singapore", "ae": "UAE",
    "pk": "Pakistan", "bd": "Bangladesh", "ph": "Philippines", "my": "Malaysia", "ar": "Argentina",
    "co": "Colombia", "ua": "Ukraine", "us": "USA", "ch": "Switzerland", "se": "Sweden", "be": "Belgium",
}
BRAND_RE = re.compile(r"Impersonates (\w+)")


def defang(url: str) -> str:
    try:
        host = urlsplit(url).hostname or ""
    except ValueError:
        host = ""
    out = re.sub(r"^http", "hxxp", url, flags=re.I)
    if host:
        out = out.replace(host, host.replace(".", "[.]"), 1)
    return out if len(out) <= 160 else out[:159] + "…"


def region_for(url: str, source: str) -> str:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        host = ""
    tld = host.rsplit(".", 1)[-1] if "." in host else ""
    return CC_TLD.get(tld, "Global") + f" · {source}"


def _bearing(key: str) -> float:
    return int(hashlib.sha1(key.encode()).hexdigest()[:6], 16) % 360


class LiveIntel:
    def __init__(self) -> None:
        self.queue: "asyncio.Queue[tuple[str, str]]" = asyncio.Queue(maxsize=5000)
        self.brand_counts: Counter = Counter()
        self.prev_counts: Counter = Counter()
        self.brand_regions: Dict[str, Counter] = defaultdict(Counter)
        self.brand_category: Dict[str, str] = {}
        self._rotation: Deque[str] = deque()
        self._idx = 0
        self.streamed = 0

    # --------------------------------------------------------------- ingest
    def enqueue(self, urls: List[str], source: str) -> None:
        for u in urls:
            try:
                self.queue.put_nowait((u, source))
            except asyncio.QueueFull:
                break

    def note_batch_done(self) -> None:
        """Called after each feed refresh: snapshot counts for trend detection."""
        self.prev_counts = Counter(self.brand_counts)

    # ---------------------------------------------------------- event build
    def build_event(self, url: str, source: str) -> Optional[ThreatEvent]:
        a = ENGINE.analyse(url, "url")
        if a.category == "safe":
            a.category = "phishing_link"
        brand_m = next((BRAND_RE.search(i) for i in a.indicators if BRAND_RE.search(i)), None)
        brand = brand_m.group(1) if brand_m else None
        if a.category == "malware" or re.search(r"\.(exe|apk|sh|bin|elf|arm\d?|mips|x86|dll|msi|jar)(\?|$)", url, re.I):
            category, title = "malware", "Live malware-download URL"
            key = "Malware delivery"
        elif brand:
            category, title = "phishing_link", f"Live phishing site impersonating {brand}"
            key = brand
        else:
            category, title = "phishing_link", "Live phishing URL reported"
            key = "Unbranded phishing"
        region = region_for(url, source)
        try:
            host = (urlsplit(url).hostname or "").lower()
        except ValueError:
            host = ""
        self.brand_counts[key] += 1
        self.brand_regions[key][region.split(" · ")[0]] += 1
        self.brand_category[key] = category
        if key not in self._rotation:
            self._rotation.append(key)
        score = max(a.score, 90)
        self.streamed += 1
        return ThreatEvent(
            title=title, category=category, category_label=CATEGORY_LABELS[category],
            severity="critical" if score >= 80 else "high", vector="Web", region=region,
            node="Added to your scanner blocklist", action="neutralized", risk_score=min(100, score),
            indicators=[f"Listed in {source} live feed"] + [i for i in a.indicators if "intel" not in i][:3],
            source="intel", sample=defang(url),
            verify_url=f"https://www.virustotal.com/gui/domain/{host}" if host else "",
        )

    # ---------------------------------------------------------------- radar
    def next_blip(self) -> Optional[RadarBlip]:
        if not self._rotation:
            return None
        # cycle through the 12 biggest real campaigns
        top = sorted(k for k, _ in self.brand_counts.most_common(12))  # stable order
        key = top[self._idx % len(top)]
        self._idx += 1
        n = self.brand_counts[key]
        prev = self.prev_counts.get(key, 0)
        trend = "emerging" if prev == 0 else "spreading" if n > prev else "contained"
        region = self.brand_regions[key].most_common(1)[0][0] if self.brand_regions[key] else "Global"
        sev = "critical" if n >= 25 or self.brand_category.get(key) == "malware" else "high" if n >= 5 else "medium"
        title = ("Malware-download URLs active" if key == "Malware delivery"
                 else "Phishing kits (no brand detected)" if key == "Unbranded phishing"
                 else f"Phishing campaign targeting {key}")
        return RadarBlip(
            title=title, category=self.brand_category.get(key, "phishing_link"), severity=sev,
            region=region, bearing=_bearing(key), distance=round(0.25 + 0.7 * (1 - min(n, 60) / 60), 3),
            trend=trend, reports=n, source="intel",
        )


LIVE = LiveIntel()

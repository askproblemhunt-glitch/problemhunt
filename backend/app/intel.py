"""Free, key-less threat-intel ingestion (OpenPhish community feed + abuse.ch URLhaus).

Pulls live malicious URLs on a timer and hot-loads them into the detection
engine. Fails silently and keeps the last good copy when offline.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.request
from typing import List, Optional, Tuple
from urllib.parse import urlsplit

from . import config
from .models import now_iso

log = logging.getLogger("problemhunt.intel")

# Shared-hosting / platform hosts: only exact URLs are blocked, never the whole host.
SHARED_HOSTS = {
    "github.com", "raw.githubusercontent.com", "drive.google.com", "docs.google.com", "sites.google.com",
    "storage.googleapis.com", "dropbox.com", "www.dropbox.com", "dl.dropboxusercontent.com",
    "onedrive.live.com", "1drv.ms", "bit.ly", "t.co", "forms.gle", "pastebin.com", "cdn.discordapp.com",
    "firebasestorage.googleapis.com", "ipfs.io", "web.app", "pages.dev", "vercel.app", "netlify.app",
    "github.io", "weebly.com", "wixsite.com", "blogspot.com", "glitch.me", "000webhostapp.com",
}
MAX_BYTES = 4 * 1024 * 1024
MAX_PER_FEED = 60000


def _fetch(url: str) -> Optional[str]:
    req = urllib.request.Request(url, headers={"User-Agent": f"ProblemHunt/{config.VERSION} (+threat-intel)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 - fixed https feed URLs
            return resp.read(MAX_BYTES).decode("utf-8", "replace")
    except Exception as exc:
        log.info("intel feed unavailable %s: %s", url, exc)
        return None


def parse_feed(text: str) -> List[Tuple[str, str]]:
    items: List[Tuple[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "!", "[")):
            continue
        if not line.lower().startswith(("http://", "https://")):
            # domain-only lists (e.g. Phishing Army): block the whole domain
            dom = line.split()[-1].lower().strip(".")
            if re.fullmatch(r"(?:[a-z0-9-]{1,63}\.)+[a-z]{2,24}", dom) and dom not in SHARED_HOSTS:
                items.append((dom, "host"))
                if len(items) >= MAX_PER_FEED:
                    break
            continue
        try:
            host = (urlsplit(line).hostname or "").lower()
        except ValueError:
            continue
        if not host:
            continue
        items.append((line.rstrip("/"), "url"))
        if host not in SHARED_HOSTS and not any(host.endswith("." + s) for s in SHARED_HOSTS):
            items.append((host, "host"))
        if len(items) >= MAX_PER_FEED:
            break
    return items


FEED_NAMES = {"openphish": "OpenPhish", "urlhaus": "URLhaus", "phish.co.za": "Phishing.Database",
              "phishing.army": "Phishing Army"}


async def refresh(store, engine, feed_urls=None) -> Tuple[int, List[str], List[Tuple[str, List[str]]]]:
    """Returns (new_count, sources_ok, [(source_name, [new_urls...]), ...])."""
    total_new, sources, fresh = 0, [], []
    for url in (feed_urls if feed_urls is not None else config.INTEL_FEEDS):
        text = await asyncio.to_thread(_fetch, url)
        if not text:
            continue
        items = parse_feed(text)
        known = set(engine._intel_urls)
        name = next((v for k, v in FEED_NAMES.items() if k in url), urlsplit(url).hostname or url)
        new_urls = [v for v, k in items if k == "url" and v not in known]
        if not any(k == "url" for _, k in items):  # domain-only feed
            known_h = set(engine._intel_hosts)
            new_urls = ["http://" + v for v, k in items if k == "host" and v not in known_h][:500]
        fresh.append((name, new_urls))
        new = await asyncio.to_thread(store.add_intel, items, url, now_iso())
        engine.load_intel(items)
        total_new += new
        sources.append(name)
        log.info("intel: %s -> %d indicators (%d new)", url, len(items), new)
    return total_new, sources, fresh

"""Standards-based Web Push (VAPID). Delivers OS notifications even when the
dashboard tab is closed. 100% free: no Firebase, no third-party account."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional

from . import config

log = logging.getLogger("problemhunt.push")


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


class PushService:
    def __init__(self, store, data_dir: Path):
        self.store = store
        self.key_path = data_dir / "vapid_private.pem"
        self.public_key: Optional[str] = None
        self.enabled = False
        self._last_sent = 0.0
        self.sent = 0
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import ec
            import pywebpush  # noqa: F401
        except Exception as exc:
            log.warning("Web Push disabled (install pywebpush): %s", exc)
            return
        if not self.key_path.exists():
            key = ec.generate_private_key(ec.SECP256R1())
            self.key_path.write_bytes(
                key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption())
            )
            try:
                self.key_path.chmod(0o600)
            except OSError:
                pass
        key = serialization.load_pem_private_key(self.key_path.read_bytes(), password=None)
        raw = key.public_key().public_bytes(serialization.Encoding.X962,
                                            serialization.PublicFormat.UncompressedPoint)
        self.public_key = _b64url(raw)
        self.enabled = True

    def subscribe(self, sub: Dict[str, Any]) -> None:
        self.store.add_push_sub(sub)

    def unsubscribe(self, endpoint: str) -> None:
        self.store.remove_push_sub(endpoint)

    @property
    def subscriber_count(self) -> int:
        return len(self.store.push_subs())

    async def notify(self, title: str, body: str, *, tag: str = "threat", url: str = "/",
                     force: bool = False, severity: str = "high") -> int:
        if not self.enabled:
            return 0
        now = time.monotonic()
        if not force and now - self._last_sent < config.PUSH_MIN_INTERVAL:
            return 0
        subs = self.store.push_subs()
        if not subs:
            return 0
        self._last_sent = now
        payload = json.dumps({"title": title, "body": body, "tag": tag, "url": url, "severity": severity})
        return await asyncio.to_thread(self._send_all, subs, payload)

    async def notify_endpoints(self, endpoints, title: str, body: str, severity: str = "critical") -> int:
        """Targeted push (e.g. family alerts) to specific subscriptions, no throttle."""
        if not self.enabled or not endpoints:
            return 0
        wanted = set(endpoints)
        subs = [s for s in self.store.push_subs() if s.get("endpoint") in wanted]
        payload = json.dumps({"title": title, "body": body, "tag": "family", "url": "/", "severity": severity})
        return await asyncio.to_thread(self._send_all, subs, payload) if subs else 0

    def _send_all(self, subs, payload: str) -> int:
        from pywebpush import WebPushException, webpush

        ok = 0
        for sub in subs:
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=str(self.key_path),
                    vapid_claims={"sub": config.VAPID_SUBJECT},
                    ttl=300,
                    timeout=10,
                )
                ok += 1
            except WebPushException as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if status in (404, 410):  # subscription expired / revoked
                    self.store.remove_push_sub(sub.get("endpoint", ""))
                log.debug("push failed (%s): %s", status, exc)
            except Exception as exc:
                log.debug("push failed: %s", exc)
        self.sent += ok
        return ok

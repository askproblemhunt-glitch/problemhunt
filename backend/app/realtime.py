"""WebSocket hub: tracks connected defense nodes and fans out events."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List

from fastapi import WebSocket

from .models import new_id

log = logging.getLogger("problemhunt.ws")


@dataclass
class Node:
    id: str
    name: str
    kind: str  # browser | mobile | laptop | virtual
    platform: str
    live: bool
    connected_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    intercepted: int = 0

    def public(self) -> Dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "kind": self.kind, "platform": self.platform,
            "live": self.live, "status": "online" if self.live else "virtual",
            "intercepted": self.intercepted,
            "uptime_s": int(time.time() - self.connected_at),
            "last_seen_s": int(time.time() - self.last_seen),
        }


class Hub:
    def __init__(self) -> None:
        self._sockets: Dict[WebSocket, Node] = {}
        self._lock = asyncio.Lock()
        self.virtual_nodes: List[Node] = [
            Node(new_id("node"), "Workstation-Alpha", "laptop", "Windows 11 · Edge", False),
            Node(new_id("node"), "Shield-Chrome", "browser", "Chrome extension sim", False),
            Node(new_id("node"), "Pixel-Guardian", "mobile", "Android 15 · SMS/WhatsApp", False),
            Node(new_id("node"), "iPhone-Sentinel", "mobile", "iOS 19 · iMessage", False),
            Node(new_id("node"), "MacBook-Ops", "laptop", "macOS · Safari", False),
        ]

    @property
    def client_count(self) -> int:
        return len(self._sockets)

    async def connect(self, ws: WebSocket) -> Node:
        await ws.accept()
        node = Node(new_id("node"), "Unregistered device", "browser", "unknown", True)
        async with self._lock:
            self._sockets[ws] = node
        return node

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets.pop(ws, None)

    def register(self, ws: WebSocket, info: Dict[str, Any]) -> Node:
        node = self._sockets[ws]
        node.name = str(info.get("name", node.name))[:40]
        node.kind = info.get("kind") if info.get("kind") in {"browser", "mobile", "laptop"} else "browser"
        node.platform = str(info.get("platform", ""))[:60]
        node.last_seen = time.time()
        return node

    def touch(self, ws: WebSocket) -> None:
        if ws in self._sockets:
            self._sockets[ws].last_seen = time.time()

    def nodes(self) -> List[Dict[str, Any]]:
        live = [n.public() for n in self._sockets.values()]
        return live + [n.public() for n in self.virtual_nodes]

    def all_node_objs(self) -> List[Node]:
        return list(self._sockets.values()) + self.virtual_nodes

    async def broadcast(self, kind: str, data: Any) -> None:
        if not self._sockets:
            return
        msg = json.dumps({"type": kind, "data": data}, default=str)
        async with self._lock:
            targets = list(self._sockets.keys())
        results = await asyncio.gather(*(self._send(ws, msg) for ws in targets), return_exceptions=True)
        dead = [ws for ws, ok in zip(targets, results) if ok is not True]
        if dead:
            async with self._lock:
                for ws in dead:
                    self._sockets.pop(ws, None)

    @staticmethod
    async def _send(ws: WebSocket, msg: str) -> bool:
        try:
            await asyncio.wait_for(ws.send_text(msg), timeout=5)
            return True
        except Exception:
            return False


HUB = Hub()

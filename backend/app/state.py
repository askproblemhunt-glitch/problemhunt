"""Live runtime state: counters, timelines, lockdown and the Digital Immunity Score."""
from __future__ import annotations

import time
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List

from .models import RadarBlip, ThreatEvent

SEVERITIES = ("low", "medium", "high", "critical")
TIMELINE_MINUTES = 30


class RuntimeState:
    def __init__(self) -> None:
        self.started = time.time()
        self.lockdown = False
        self.lockdown_since: float | None = None
        self.scanned = 0
        self.actions: Counter = Counter()
        self.by_category: Counter = Counter()
        self.by_severity: Counter = Counter()
        self.by_vector: Counter = Counter()
        self.threats: Deque[ThreatEvent] = deque(maxlen=200)
        self.radar: Deque[RadarBlip] = deque(maxlen=40)
        self._recent: Deque[tuple[float, str, str]] = deque(maxlen=2000)  # (t, severity, action)
        self._timeline: Dict[int, Counter] = {}
        self._score_history: Deque[Dict[str, Any]] = deque(maxlen=60)

    # ----------------------------------------------------------- recording
    def record(self, ev: ThreatEvent) -> None:
        self.scanned += 1
        self.actions[ev.action] += 1
        if ev.category != "safe":
            self.by_category[ev.category] += 1
            self.by_severity[ev.severity] += 1
            self.by_vector[ev.vector] += 1
            self.threats.appendleft(ev)
            minute = int(time.time() // 60)
            self._timeline.setdefault(minute, Counter())[ev.severity] += 1
            for m in [m for m in self._timeline if m < minute - TIMELINE_MINUTES]:
                del self._timeline[m]
        self._recent.append((time.time(), ev.severity, ev.action))

    def add_blip(self, blip: RadarBlip) -> None:
        # one row per campaign: replace the older entry for the same campaign
        for old in [b for b in self.radar if b.title == blip.title]:
            self.radar.remove(old)
        self.radar.appendleft(blip)

    def set_lockdown(self, engaged: bool) -> None:
        self.lockdown = engaged
        self.lockdown_since = time.time() if engaged else None

    # ------------------------------------------------------------- derived
    def timeline(self) -> List[Dict[str, Any]]:
        now_min = int(time.time() // 60)
        out = []
        for m in range(now_min - TIMELINE_MINUTES + 1, now_min + 1):
            c = self._timeline.get(m, Counter())
            label = datetime.fromtimestamp(m * 60, tz=timezone.utc).strftime("%H:%M")
            out.append({"t": label, "ts": m * 60, **{s: c.get(s, 0) for s in SEVERITIES}})
        return out

    def immunity(self, rule_count: int, intel_size: int, nodes: int, live_nodes: int, llm: bool) -> Dict[str, Any]:
        """Digital Immunity Score (0-100). Transparent, component-based."""
        now = time.time()
        window = [r for r in self._recent if now - r[0] <= 600]
        threats = [r for r in window if r[2] != "allowed"]
        neutralized = sum(1 for r in threats if r[2] == "neutralized")
        exposed_high = sum(1 for r in threats if r[2] == "flagged" and r[1] in ("high", "critical"))
        exposed_med = sum(1 for r in threats if r[2] == "flagged" and r[1] == "medium")
        rate = neutralized / len(threats) if threats else 1.0

        components = {
            "interception": round(30 * rate, 1),
            "coverage": round(min(20.0, rule_count / 4 + min(6.0, intel_size / 2000)), 1),
            "mesh": round(min(15.0, 2 * nodes + 3 * live_nodes), 1),
            "ai_brain": 15.0 if llm else 10.0,
            "posture": 20.0 if self.lockdown else 14.0,
        }
        penalty = min(30.0, exposed_high * 4 + exposed_med * 1.5)
        score = max(0, min(100, round(sum(components.values()) - penalty)))
        grade = "A+" if score >= 95 else "A" if score >= 88 else "B" if score >= 75 else "C" if score >= 60 else "D"
        self._score_history.append({"t": datetime.now(timezone.utc).strftime("%H:%M:%S"), "score": score})
        return {
            "score": score,
            "grade": grade,
            "components": components,
            "penalty": round(penalty, 1),
            "neutralize_rate": round(rate * 100, 1),
            "window_threats": len(threats),
            "history": list(self._score_history)[-30:],
        }

    def stats(self) -> Dict[str, Any]:
        return {
            "uptime_s": int(time.time() - self.started),
            "scanned": self.scanned,
            "neutralized": self.actions["neutralized"],
            "flagged": self.actions["flagged"],
            "allowed": self.actions["allowed"],
            "by_category": dict(self.by_category),
            "by_severity": dict(self.by_severity),
            "by_vector": dict(self.by_vector),
            "timeline": self.timeline(),
            "lockdown": self.lockdown,
            "lockdown_since": self.lockdown_since,
        }


STATE = RuntimeState()

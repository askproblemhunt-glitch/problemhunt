"""Tiny SQLite persistence layer (zero-cost, zero-config, file based)."""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from .models import Rule, ThreatEvent

SCHEMA = """
CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    weight INTEGER NOT NULL,
    origin TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    UNIQUE(kind, pattern)
);
CREATE TABLE IF NOT EXISTS threats (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS threats_ts ON threats(ts);
CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intel (
    value TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
);
"""

MAX_THREATS = 5000


class Store:
    def __init__(self, path: Path):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.executescript(SCHEMA)
        self._db.commit()

    # -- rules --------------------------------------------------------------
    def add_rule(self, rule: Rule) -> bool:
        """Insert a rule; returns False if an identical (kind, pattern) exists."""
        with self._lock:
            cur = self._db.execute(
                "INSERT OR IGNORE INTO rules VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    rule.id, rule.kind, rule.pattern, rule.category, rule.severity,
                    rule.weight, rule.origin, rule.hits, rule.created_at, rule.note,
                ),
            )
            self._db.commit()
            return cur.rowcount > 0

    def rules(self) -> List[Rule]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM rules ORDER BY created_at DESC").fetchall()
        return [Rule(**dict(r)) for r in rows]

    def delete_rule(self, rule_id: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM rules WHERE id=? AND origin!='seed'", (rule_id,))
            self._db.commit()
            return cur.rowcount > 0

    def bump_hits(self, counts: Dict[str, int]) -> None:
        if not counts:
            return
        with self._lock:
            self._db.executemany(
                "UPDATE rules SET hits = hits + ? WHERE id = ?",
                [(n, rid) for rid, n in counts.items()],
            )
            self._db.commit()

    # -- threats ------------------------------------------------------------
    def add_threat(self, ev: ThreatEvent) -> None:
        with self._lock:
            self._db.execute(
                "INSERT OR REPLACE INTO threats VALUES (?,?,?)",
                (ev.id, ev.ts, ev.model_dump_json()),
            )
            self._db.execute(
                "DELETE FROM threats WHERE id IN (SELECT id FROM threats ORDER BY ts DESC LIMIT -1 OFFSET ?)",
                (MAX_THREATS,),
            )
            self._db.commit()

    def recent_threats(self, limit: int = 100) -> List[ThreatEvent]:
        with self._lock:
            rows = self._db.execute(
                "SELECT payload FROM threats ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
        return [ThreatEvent(**json.loads(r["payload"])) for r in rows]

    # -- push subscriptions -------------------------------------------------
    def add_push_sub(self, sub: Dict[str, Any]) -> None:
        with self._lock:
            self._db.execute(
                "INSERT OR REPLACE INTO push_subs VALUES (?,?)", (sub["endpoint"], json.dumps(sub))
            )
            self._db.commit()

    def remove_push_sub(self, endpoint: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM push_subs WHERE endpoint=?", (endpoint,))
            self._db.commit()

    def push_subs(self) -> List[Dict[str, Any]]:
        with self._lock:
            rows = self._db.execute("SELECT payload FROM push_subs").fetchall()
        return [json.loads(r["payload"]) for r in rows]

    # -- intel IOCs ---------------------------------------------------------
    def add_intel(self, items: Iterable[tuple], source: str, ts: str) -> int:
        with self._lock:
            before = self._db.total_changes
            self._db.executemany(
                "INSERT OR IGNORE INTO intel VALUES (?,?,?,?)",
                [(v, k, source, ts) for v, k in items],
            )
            self._db.commit()
            return self._db.total_changes - before

    def recent_intel_urls(self, limit: int = 60) -> List[tuple]:
        with self._lock:
            rows = self._db.execute(
                "SELECT value, source FROM intel WHERE kind='url' ORDER BY added_at DESC, rowid DESC LIMIT ?", (limit,)
            ).fetchall()
        return [(r["value"], r["source"]) for r in rows]

    def intel(self) -> List[tuple]:
        with self._lock:
            rows = self._db.execute("SELECT value, kind FROM intel").fetchall()
        return [(r["value"], r["kind"]) for r in rows]

    # -- key/value ----------------------------------------------------------
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        with self._lock:
            row = self._db.execute("SELECT v FROM kv WHERE k=?", (key,)).fetchone()
        return row["v"] if row else default

    def set(self, key: str, value: str) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO kv VALUES (?,?)", (key, value))
            self._db.commit()

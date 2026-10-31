"""Keep your data safe on free hosts whose disk is wiped on restart (e.g. Render free).

Set SUPABASE_URL + SUPABASE_SERVICE_KEY (free Supabase project, no card) and
PH_CLOUD_BACKUP=1. Then:
  * on start-up the latest snapshot of the data folder is downloaded and restored;
  * every PH_BACKUP_MINUTES (default 5) the data folder is uploaded if it changed;
  * a final upload happens on shutdown.
The snapshot is one private file in a private Supabase Storage bucket (no history growth).
Only the standard library is used.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import sqlite3
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

log = logging.getLogger("problemhunt.backup")

URL = os.getenv("SUPABASE_URL", "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")
BUCKET = os.getenv("PH_BACKUP_BUCKET", "problemhunt-backups")
OBJECT = os.getenv("PH_BACKUP_OBJECT", "data-latest.tgz")
MINUTES = max(1.0, float(os.getenv("PH_BACKUP_MINUTES", "5")))
SKIP_SUFFIX = ("-wal", "-shm", "-journal", ".tmp")
MAX_BYTES = 45 * 1024 * 1024  # Supabase free per-file limit is 50 MB

_last_sig: str = ""
_last_upload: float = time.time()


def enabled() -> bool:
    return os.getenv("PH_CLOUD_BACKUP", "").strip().lower() in ("1", "true", "yes", "on") and bool(URL and KEY)


def _req(method: str, path: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 60):
    h = {"apikey": KEY}
    if not KEY.startswith("sb_"):  # legacy service_role JWT; new sb_secret_ keys go in apikey only
        h["Authorization"] = f"Bearer {KEY}"
    h.update(headers or {})
    req = urllib.request.Request(f"{URL}{path}", data=data, method=method, headers=h)
    return urllib.request.urlopen(req, timeout=timeout)  # noqa: S310 (fixed https Supabase URL from env)


def _ensure_bucket() -> None:
    body = json.dumps({"id": BUCKET, "name": BUCKET, "public": False}).encode()
    try:
        _req("POST", "/storage/v1/bucket", body, {"Content-Type": "application/json"}).close()
    except urllib.error.HTTPError as exc:
        if exc.code not in (400, 409):  # already exists
            raise


def _signature(data_dir: Path) -> str:
    parts = []
    for p in sorted(data_dir.rglob("*")):
        if p.is_file() and not p.name.endswith(SKIP_SUFFIX):
            st = p.stat()
            parts.append(f"{p.relative_to(data_dir)}:{st.st_size}:{int(st.st_mtime)}")
    return "|".join(parts)


def _snapshot(data_dir: Path) -> bytes:
    buf = io.BytesIO()
    total = 0
    with tarfile.open(fileobj=buf, mode="w:gz") as tar, tempfile.TemporaryDirectory() as tmp:
        files = sorted(p for p in data_dir.rglob("*") if p.is_file() and not p.name.endswith(SKIP_SUFFIX))
        # databases first, uploads last (dropped first if the snapshot gets too big)
        files.sort(key=lambda p: (p.relative_to(data_dir).parts[0] == "uploads", str(p)))
        for p in files:
            rel = str(p.relative_to(data_dir))
            src = p
            if p.suffix == ".db":  # consistent copy even while the app is writing
                src = Path(tmp) / (p.name + ".copy")
                with sqlite3.connect(str(p)) as a, sqlite3.connect(str(src)) as b:
                    a.backup(b)
            size = src.stat().st_size
            if total + size > MAX_BYTES and rel.startswith("uploads"):
                continue
            total += size
            tar.add(str(src), arcname=rel)
    return buf.getvalue()


def restore(data_dir: Path) -> None:
    """Called once at start-up, before any database is opened."""
    global _last_sig
    if not enabled():
        return
    data_dir.mkdir(parents=True, exist_ok=True)
    if (data_dir / "platform.db").exists() and os.getenv("PH_BACKUP_FORCE_RESTORE") != "1":
        log.info("cloud backup: local data present, not restoring")
        return
    try:
        with _req("GET", f"/storage/v1/object/{BUCKET}/{OBJECT}", timeout=90) as r:
            blob = r.read()
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 404):
            log.warning("cloud backup: no snapshot yet — starting fresh")
            return
        log.error("cloud backup: restore failed (%s) — starting without old data", exc)
        return
    except Exception as exc:  # network etc.
        log.error("cloud backup: restore failed (%s) — starting without old data", exc)
        return
    base = data_dir.resolve()
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        for m in tar.getmembers():
            target = (base / m.name).resolve()
            if not m.isfile() or not str(target).startswith(str(base) + os.sep):
                continue  # ignore anything odd (links, paths outside the folder)
            target.parent.mkdir(parents=True, exist_ok=True)
            f = tar.extractfile(m)
            if f:
                target.write_bytes(f.read())
    _last_sig = _signature(data_dir)
    print(f"[ProblemHunt] Restored data from cloud backup ({len(blob)//1024} KB)", flush=True)


def backup_now(data_dir: Path, force: bool = False) -> bool:
    global _last_sig, _last_upload
    if not enabled() or not data_dir.exists():
        return False
    sig = _signature(data_dir)
    if not force and sig == _last_sig:
        return False
    blob = _snapshot(data_dir)
    _ensure_bucket()
    _req("POST", f"/storage/v1/object/{BUCKET}/{OBJECT}", blob,
         {"Content-Type": "application/gzip", "x-upsert": "true"}, timeout=120).close()
    _last_sig = sig
    _last_upload = time.time()
    log.info("cloud backup: uploaded %d KB", len(blob) // 1024)
    return True


async def backup_loop(data_dir: Path) -> None:
    if not enabled():
        return
    log.info("cloud backup: every %.0f min to Supabase bucket %s", MINUTES, BUCKET)
    try:
        while True:
            await asyncio.sleep(MINUTES * 60)
            try:
                # upload when data changed, and at least once a day (keeps the free Supabase project active)
                daily = time.time() - _last_upload > 20 * 3600
                await asyncio.to_thread(backup_now, data_dir, daily)
            except Exception as exc:
                log.error("cloud backup failed: %s", exc)
    except asyncio.CancelledError:
        try:
            backup_now(data_dir)  # final upload on shutdown / restart
        except Exception as exc:
            log.error("cloud backup on shutdown failed: %s", exc)
        raise


def status() -> dict:
    return {"enabled": enabled(), "bucket": BUCKET, "every_minutes": MINUTES, "time": int(time.time())}

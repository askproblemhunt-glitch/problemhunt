"""Optional Supabase mirror (free tier). Set SUPABASE_URL + SUPABASE_SERVICE_KEY.

Mirrors learned rules and real (non-simulated) interceptions into Postgres so
they survive redeploys on ephemeral free hosts. See supabase/schema.sql.
"""
from __future__ import annotations

import asyncio
import json
import logging
import urllib.request

from . import config

log = logging.getLogger("problemhunt.sync")


def enabled() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_KEY)


def _post(table: str, row: dict) -> None:
    req = urllib.request.Request(
        f"{config.SUPABASE_URL}/rest/v1/{table}",
        data=json.dumps(row, default=str).encode(),
        method="POST",
        headers={
            "apikey": config.SUPABASE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        urllib.request.urlopen(req, timeout=10).close()  # noqa: S310
    except Exception as exc:
        log.debug("supabase mirror failed: %s", exc)


async def mirror(table: str, row: dict) -> None:
    if enabled():
        await asyncio.to_thread(_post, table, row)


def _get(path: str) -> list:
    req = urllib.request.Request(
        f"{config.SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": config.SUPABASE_KEY, "Authorization": f"Bearer {config.SUPABASE_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
            data = json.loads(resp.read())
            return data if isinstance(data, list) else []
    except Exception as exc:
        log.info("supabase restore failed: %s", exc)
        return []


async def restore_rules() -> list:
    """Pull previously learned rules back after a redeploy (free hosts wipe local disk)."""
    if not enabled():
        return []
    return await asyncio.to_thread(_get, "rules?select=*&order=created_at.desc&limit=5000")

"""Runtime configuration. Everything has a safe zero-config default; override with env vars."""
from __future__ import annotations

import os
from pathlib import Path


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

DATA_DIR = Path(os.getenv("PH_DATA_DIR", str(BACKEND_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "problemhunt.db"

FRONTEND_DIST = Path(os.getenv("PH_FRONTEND_DIST", str(ROOT_DIR / "frontend" / "out")))

# --- Behaviour -------------------------------------------------------------
# Demo drill traffic (synthetic scams + virtual devices). OFF by default: the dashboard shows only
# real data (live OpenPhish/URLhaus intel, your own scans, your real connected devices).
SIMULATION_ENABLED = _bool("PH_SIMULATION", False)
INTEL_STREAM_MIN = float(os.getenv("PH_INTEL_STREAM_MIN", "2.5"))
INTEL_STREAM_MAX = float(os.getenv("PH_INTEL_STREAM_MAX", "6.0"))
SIM_MIN_INTERVAL = float(os.getenv("PH_SIM_MIN_INTERVAL", "2.5"))
SIM_MAX_INTERVAL = float(os.getenv("PH_SIM_MAX_INTERVAL", "6.0"))

# Free, key-less public threat-intel feeds (OpenPhish community + URLhaus).
INTEL_FEEDS_ENABLED = _bool("PH_INTEL_FEEDS", True)
INTEL_REFRESH_SECONDS = int(os.getenv("PH_INTEL_REFRESH_SECONDS", "1800"))
INTEL_FEEDS = [
    u.strip()
    for u in os.getenv(
        "PH_INTEL_FEED_URLS",
        "https://openphish.com/feed.txt,https://urlhaus.abuse.ch/downloads/text_online/",
    ).split(",")
    if u.strip()
]

# --- Security --------------------------------------------------------------
CORS_ORIGINS = [o.strip() for o in os.getenv("PH_CORS_ORIGINS", "*").split(",") if o.strip()]
ADMIN_TOKEN = os.getenv("PH_ADMIN_TOKEN", "")  # empty = local single-user mode
SCAN_RATE_PER_MIN = int(os.getenv("PH_SCAN_RATE_PER_MIN", "40"))
MAX_WS_CLIENTS = int(os.getenv("PH_MAX_WS_CLIENTS", "500"))

# --- AI brain (all optional, all have free tiers) --------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("PH_GROQ_MODEL", "llama-3.1-8b-instant")
HF_TOKEN = os.getenv("HUGGINGFACEHUB_API_TOKEN", "") or os.getenv("HF_TOKEN", "")
HF_REPO_ID = os.getenv("PH_HF_REPO_ID", "meta-llama/Llama-3.1-8B-Instruct")
OLLAMA_MODEL = os.getenv("PH_OLLAMA_MODEL", "")  # e.g. "llama3.2" -> uses local Ollama
OLLAMA_BASE_URL = os.getenv("PH_OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MAX_CALLS_PER_MIN = int(os.getenv("PH_LLM_MAX_CALLS_PER_MIN", "8"))
LLM_TIMEOUT_SECONDS = float(os.getenv("PH_LLM_TIMEOUT", "8"))

# --- Web Push --------------------------------------------------------------
VAPID_SUBJECT = os.getenv("PH_VAPID_SUBJECT", "mailto:security@problemhunt.local")
PUSH_MIN_INTERVAL = float(os.getenv("PH_PUSH_MIN_INTERVAL", "45"))
PUSH_SIMULATED = _bool("PH_PUSH_SIMULATED", True)

# --- Optional Supabase mirror ---------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")

VERSION = "1.0.0"

# Public mode: set PH_PUBLIC_MODE=1 when the site is on the internet (tunnel / reverse proxy).
# Then nobody gets "this computer" shortcuts (auto-admin, on-screen login codes, email previews).
PUBLIC_MODE = os.getenv("PH_PUBLIC_MODE", "").strip().lower() in ("1", "true", "yes", "on")


def is_local_request(request) -> bool:
    """True only for a browser on the server's own computer, never for proxied/tunnelled visitors."""
    if PUBLIC_MODE or request is None:
        return False
    h = request.headers
    if h.get("cf-connecting-ip") or h.get("x-forwarded-for") or h.get("x-real-ip") or h.get("forwarded"):
        return False
    client = request.client.host if request.client else ""
    return client in ("127.0.0.1", "::1", "localhost")

# Free hosts with wiped disks (Render free): restore the data folder from the cloud backup before
# any database opens. Does nothing unless PH_CLOUD_BACKUP=1 and Supabase keys are set.
from . import cloud_backup as _cloud_backup  # noqa: E402
_cloud_backup.restore(DATA_DIR)

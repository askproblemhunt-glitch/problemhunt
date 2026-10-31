#!/usr/bin/env python3
"""
ProblemHunt one-click launcher
==============================

Double-click this file (or run `python start_problemhunt.py`). It will:

  1. create a private virtual environment in ./.venv (keeps your system Python clean)
  2. auto-install every missing backend dependency (FastAPI, Uvicorn, WebSockets, LangChain, Web Push)
  3. load optional settings from a .env file (e.g. a free GROQ_API_KEY)
  4. start the ProblemHunt defense grid on a free port
  5. open the command-center dashboard in your default browser

Options:  --port 8000   --lan (let phones on your Wi-Fi connect)   --no-browser
          --demo (add simulated drill traffic)   --reset (wipe local data, start fresh)
          --make-admin you@email.com   (or a mobile number) — turn an existing account into the admin
          --rebuild-frontend (needs Node.js)   --no-venv
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / ".venv"
FRONTEND = ROOT / "frontend"
FRONTEND_OUT = FRONTEND / "out"
CHILD_FLAG = "PH_LAUNCHER_CHILD"

REQUIRED = {  # import name -> pip spec
    "fastapi": "fastapi>=0.110",
    "uvicorn": "uvicorn[standard]>=0.29",
    "websockets": "websockets>=12.0",
    "pydantic": "pydantic>=2.6",
}
OPTIONAL = {
    "langchain_core": "langchain-core>=0.3",
    "langchain_groq": "langchain-groq>=0.2",
    "pywebpush": "pywebpush>=2.0",
}

C = {"cyan": "\033[96m", "green": "\033[92m", "yellow": "\033[93m", "red": "\033[91m", "dim": "\033[2m", "end": "\033[0m"}
if os.name == "nt":
    os.system("")  # enable ANSI colours on Windows 10+
if not sys.stdout.isatty():
    C = {k: "" for k in C}


def say(msg: str, color: str = "cyan") -> None:
    print(f"{C[color]}{msg}{C['end']}", flush=True)


BANNER = r"""
   ____            _     _                _   _             _
  |  _ \ _ __ ___ | |__ | | ___ _ __ ___ | | | |_   _ _ __ | |_
  | |_) | '__/ _ \| '_ \| |/ _ \ '_ ` _ \| |_| | | | | '_ \| __|
  |  __/| | | (_) | |_) | |  __/ | | | | |  _  | |_| | | | | |_
  |_|   |_|  \___/|_.__/|_|\___|_| |_| |_|_| |_|\__,_|_| |_|\__|
            Autonomous Defense Grid  ·  one-click launcher
"""


# --------------------------------------------------------------------------- environment
def venv_python() -> Path:
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def in_our_venv() -> bool:
    try:
        return Path(sys.prefix).resolve() == VENV_DIR.resolve()
    except OSError:
        return False


def ensure_venv() -> bool:
    """Create ./.venv once. Returns False if the platform can't create venvs."""
    if venv_python().exists():
        return True
    say("• Creating a private Python environment (.venv) — first run only…")
    try:
        import venv

        venv.EnvBuilder(with_pip=True, clear=False, upgrade_deps=False).create(VENV_DIR)
        return venv_python().exists()
    except Exception as exc:  # e.g. Debian without python3-venv
        say(f"  ! Could not create a virtual environment ({exc}). Using this Python instead.", "yellow")
        shutil.rmtree(VENV_DIR, ignore_errors=True)
        return False


def missing(mods: dict) -> list[str]:
    return [spec for mod, spec in mods.items() if importlib.util.find_spec(mod) is None]


def pip_install(specs: list[str], required: bool) -> bool:
    if not specs:
        return True
    base = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-q"]
    say(f"• Installing: {', '.join(specs)}")
    attempts = [base + specs]
    if not in_our_venv() and sys.prefix == sys.base_prefix:  # system Python fallback
        attempts.append(base + ["--user"] + specs)
        attempts.append(base + ["--user", "--break-system-packages"] + specs)
    for cmd in attempts:
        if subprocess.call(cmd) == 0:
            importlib.invalidate_caches()
            return True
    if required:
        say("✗ Could not install required packages. Check your internet connection and try again.", "red")
    else:
        say("  ! Optional extras unavailable — ProblemHunt will run in offline AI mode.", "yellow")
    return False


def ensure_dependencies() -> None:
    try:
        import pip  # noqa: F401
    except ImportError:
        say("• Bootstrapping pip…")
        subprocess.call([sys.executable, "-m", "ensurepip", "--upgrade"])
    if not pip_install(missing(REQUIRED), required=True):
        sys.exit(1)
    for spec in missing(OPTIONAL):  # one by one so a single failure doesn't block the rest
        pip_install([spec], required=False)
    extra = []
    if os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HF_TOKEN"):
        extra.append(("langchain_huggingface", "langchain-huggingface>=0.1"))
    if os.getenv("PH_OLLAMA_MODEL"):
        extra.append(("langchain_ollama", "langchain-ollama>=0.2"))
    for mod, spec in extra:
        if importlib.util.find_spec(mod) is None:
            pip_install([spec], required=False)
    say("✓ Dependencies ready", "green")


def load_dotenv() -> None:
    for name in (".env", "backend/.env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        say(f"• Loaded settings from {name}", "dim")


def ensure_frontend(rebuild: bool) -> None:
    if (FRONTEND_OUT / "index.html").exists() and not rebuild:
        return
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        say("  ! Dashboard build not found and Node.js isn't installed.", "yellow")
        say("    Install Node.js 18+ from https://nodejs.org and re-run, or use the release zip (prebuilt).", "yellow")
        return
    say("• Building the dashboard (one-time, ~1 minute)…")
    if subprocess.call([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND) != 0 or \
       subprocess.call([npm, "run", "build"], cwd=FRONTEND, env={**os.environ, "NEXT_TELEMETRY_DISABLED": "1"}) != 0:
        say("  ! Dashboard build failed — the API will still run.", "yellow")
    else:
        say("✓ Dashboard built", "green")


# --------------------------------------------------------------------------- server
def free_port(preferred: int, host: str) -> int:
    for port in [preferred] + list(range(preferred + 1, preferred + 50)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    with socket.socket() as s:
        s.bind((host, 0))
        return s.getsockname()[1]


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def wait_healthy(url: str, proc: subprocess.Popen, timeout: float = 60) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def run_server(args: argparse.Namespace) -> int:
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    port = free_port(args.port, host)
    local_url = f"http://localhost:{port}"
    cmd = [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", host, "--port", str(port),
           "--log-level", "warning", "--no-server-header"]
    say(f"• Starting defense grid on {local_url} …")
    proc = subprocess.Popen(cmd, cwd=str(ROOT))
    try:
        if not wait_healthy(f"http://127.0.0.1:{port}/api/health", proc):
            say("✗ Server failed to start — see the messages above.", "red")
            proc.terminate()
            return 1
        say("\n✓ ProblemHunt is LIVE and defending on auto-pilot.", "green")
        say(f"  Dashboard : {local_url}", "green")
        say(f"  API docs  : {local_url}/api/docs", "dim")
        if args.lan:
            say(f"  On your phone (same Wi-Fi): http://{lan_ip()}:{port}", "green")
            say("  (Install-as-app & push alerts on phones need HTTPS — see README › Deploy for free.)", "dim")
        say("  Press Ctrl+C to stop.\n", "dim")
        if not args.no_browser:
            webbrowser.open(local_url)
        return proc.wait()
    except KeyboardInterrupt:
        say("\n• Shutting down the defense grid…", "yellow")
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        say("✓ Stopped. Stay safe!", "green")
        return 0


def make_admin(ident: str) -> None:
    """Promote an existing account to admin directly in the local database (no server needed)."""
    import re
    import sqlite3
    db_path = ROOT / "backend" / "data" / "platform.db"
    if not db_path.exists():
        say("✗ No accounts yet. Start ProblemHunt, create your account in the browser, then run this again.", "red")
        sys.exit(1)
    ident = ident.strip()
    con = sqlite3.connect(str(db_path))
    if "@" in ident:
        cur = con.execute("UPDATE users SET role='admin', status='active' WHERE lower(email)=?", (ident.lower(),))
    else:
        digits = re.sub(r"\D", "", ident)[-10:]
        cur = con.execute("UPDATE users SET role='admin', status='active' WHERE replace(phone,'+','') LIKE ?", (f"%{digits}",))
    con.commit()
    if cur.rowcount:
        say(f"✓ {ident} is now an ADMIN. Log in again in the browser to see the Admin button.", "green")
    else:
        emails = [r[0] for r in con.execute("SELECT email FROM users ORDER BY created_at LIMIT 10")]
        say(f"✗ No account found for {ident}. Existing accounts: {', '.join(emails) or 'none'}", "red")
        sys.exit(1)


# --------------------------------------------------------------------------- main
def main() -> int:
    parser = argparse.ArgumentParser(description="ProblemHunt one-click launcher")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    parser.add_argument("--lan", action="store_true", help="listen on your local network so phones can join")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--rebuild-frontend", action="store_true")
    parser.add_argument("--no-venv", action="store_true", help="install into the current Python instead of ./.venv")
    parser.add_argument("--demo", action="store_true", help="add simulated drill traffic and virtual devices")
    parser.add_argument("--reset", action="store_true", help="delete local data (threat history, learned rules)")
    parser.add_argument("--make-admin", metavar="EMAIL_OR_MOBILE", help="make an existing account the admin, then start")
    args = parser.parse_args()

    if sys.version_info < (3, 9):
        say("✗ Python 3.9 or newer is required — download it from https://python.org", "red")
        return 1

    if not os.getenv(CHILD_FLAG):
        say(BANNER)

    # Re-launch inside the private venv (once).
    if not args.no_venv and not in_our_venv() and not os.getenv(CHILD_FLAG) and ensure_venv():
        env = {**os.environ, CHILD_FLAG: "1"}
        try:
            return subprocess.call([str(venv_python()), str(Path(__file__).resolve()), *sys.argv[1:]], env=env)
        except KeyboardInterrupt:
            return 0

    os.chdir(ROOT)
    if args.reset:
        shutil.rmtree(ROOT / "backend" / "data", ignore_errors=True)
        say("• Local data wiped — starting fresh", "yellow")
    if args.make_admin:
        make_admin(args.make_admin)
    if args.demo:
        os.environ["PH_SIMULATION"] = "1"
        say("• Demo mode: simulated drill traffic ON (labelled 'sim drill')", "yellow")
    load_dotenv()
    ensure_dependencies()
    ensure_frontend(args.rebuild_frontend)
    return run_server(args)


if __name__ == "__main__":
    try:
        code = main()
    except KeyboardInterrupt:
        code = 0
    if os.name == "nt" and not os.getenv(CHILD_FLAG) and code != 0:
        input("Press Enter to close…")  # keep the window open when double-clicked on Windows
    sys.exit(code)

"""Pydantic schemas shared by the API, WebSocket protocol and engines."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]
Category = Literal[
    "phishing_link",
    "fake_qr",
    "job_scam",
    "deepfake_audio",
    "payment_fraud",
    "otp_theft",
    "investment_scam",
    "impersonation",
    "malware",
    "safe",
]
Action = Literal["allowed", "flagged", "neutralized"]
Verdict = Literal["safe", "suspicious", "malicious"]

CATEGORY_LABELS: Dict[str, str] = {
    "phishing_link": "Phishing Link",
    "fake_qr": "Fake QR Code",
    "job_scam": "Job / Task Scam",
    "deepfake_audio": "Deepfake Voice Trap",
    "payment_fraud": "Payment / KYC Fraud",
    "otp_theft": "OTP Theft",
    "investment_scam": "Investment Scam",
    "impersonation": "Impersonation",
    "malware": "Malware Delivery",
    "safe": "Safe",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class ScanRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)
    kind: Literal["auto", "url", "message", "qr", "audio_transcript"] = "auto"
    node_id: Optional[str] = Field(default=None, max_length=64)


class ScanResult(BaseModel):
    id: str = Field(default_factory=lambda: new_id("scan"))
    ts: str = Field(default_factory=now_iso)
    verdict: Verdict
    category: Category
    category_label: str
    severity: Severity
    risk_score: int
    confidence: float
    indicators: List[str]
    matched_rules: List[str]
    action: Action
    explanation: str
    engine: str
    elapsed_ms: float


class ThreatEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("thr"))
    ts: str = Field(default_factory=now_iso)
    title: str
    category: Category
    category_label: str
    severity: Severity
    vector: str
    region: str
    node: str
    action: Action
    risk_score: int
    indicators: List[str] = []
    source: Literal["simulation", "scan", "intel"] = "simulation"
    sample: str = ""
    verify_url: str = ""  # independent public lookup (VirusTotal) for live-intel items


class RadarBlip(BaseModel):
    id: str = Field(default_factory=lambda: new_id("rdr"))
    ts: str = Field(default_factory=now_iso)
    title: str
    category: Category
    severity: Severity
    region: str
    bearing: float  # 0-360 degrees on the radar
    distance: float  # 0..1 from centre
    trend: Literal["emerging", "spreading", "contained"]
    reports: int
    source: Literal["simulation", "intel"] = "simulation"


class Rule(BaseModel):
    id: str = Field(default_factory=lambda: new_id("rule"))
    kind: Literal["keyword", "domain", "regex"]
    pattern: str
    category: Category
    severity: Severity
    weight: int = 20
    origin: Literal["seed", "agent-llm", "agent-miner", "intel-feed"] = "agent-miner"
    hits: int = 0
    created_at: str = Field(default_factory=now_iso)
    note: str = ""


class LockdownRequest(BaseModel):
    engaged: bool


class PushKeys(BaseModel):
    p256dh: str = Field(..., max_length=256)
    auth: str = Field(..., max_length=64)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(..., max_length=1024)
    keys: PushKeys
    expirationTime: Optional[float] = None

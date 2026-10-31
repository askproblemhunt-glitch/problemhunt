"""Automated threat-simulation engine.

Generates realistic, randomised scam traffic (SMS, WhatsApp, email, web, QR,
voice) and pushes every sample through the REAL detection pipeline, so the
dashboard, immunity score, AI rule-learning and push notifications all run on
autopilot. All domains/names are synthetic. Every simulated event is labelled
`source="simulation"` in the API and UI so drills are never mistaken for real
interceptions. Disable with PH_SIMULATION=0.
"""
from __future__ import annotations

import random
from typing import Dict, List

REGIONS = [
    "India · Mumbai", "India · Delhi NCR", "India · Bengaluru", "USA · Texas", "USA · California",
    "UK · London", "Brazil · São Paulo", "Nigeria · Lagos", "Singapore", "Germany · Berlin",
    "UAE · Dubai", "Indonesia · Jakarta", "Australia · Sydney", "Philippines · Manila", "Canada · Toronto",
]
TLDS = ["top", "xyz", "click", "sbs", "cfd", "icu", "buzz", "live", "shop", "online", "site", "info"]
BANKS = ["SBI", "HDFC", "ICICI", "Axis", "PNB", "Kotak"]
BRANDS = ["paypal", "amazon", "netflix", "apple", "microsoft", "dhl", "fedex", "indiapost", "paytm", "phonepe"]
NAMES = ["Priya", "Rahul", "Ananya", "Arjun", "Meera", "Vikram", "Sara", "David", "Fatima", "Chen"]
WORDS = ["secure", "verify", "update", "kyc", "support", "alert", "help", "login", "refund", "care"]


def _domain(brand: str | None = None) -> str:
    brand = brand or random.choice(BRANDS)
    style = random.random()
    if style < 0.25:
        brand = brand.replace("a", "4", 1).replace("o", "0", 1).replace("l", "1", 1)
    return f"{brand}-{random.choice(WORDS)}{random.randint(1, 99) if random.random() < .4 else ''}.{random.choice(TLDS)}"


def _amt() -> str:
    return f"{random.choice(['Rs ', '₹', '$'])}{random.choice([499, 999, 1500, 2500, 4999, 9999, 25000])}"


TEMPLATES: List[Dict] = [
    {"vector": "SMS", "title": "Fake {bank} KYC-expiry SMS",
     "text": "Dear customer, your {bank} KYC is pending and your account will be blocked within 24 hours. Update now: http://{bank_l}-kyc-{w}.{tld}/login"},
    {"vector": "SMS", "title": "Electricity disconnection scam",
     "text": "Dear consumer your electricity power will be disconnected tonight at 9:30pm because previous month bill was not updated. Call officer {phone} immediately"},
    {"vector": "WhatsApp", "title": "WhatsApp part-time 'like videos' job trap",
     "text": "Hello! I am {name} from HR team. Part time job available, earn {amt} daily income by liking YouTube videos. No interview needed. Contact our Telegram task mentor to start"},
    {"vector": "WhatsApp", "title": "Prepaid 'merchant task' deposit scam",
     "text": "Congratulations you completed 3 free tasks. Next is a prepaid task: pay {amt} registration fee and receive 30% profit commission today. Telegram receptionist will guide you"},
    {"vector": "WhatsApp", "title": "Hotel-review task scam",
     "text": "Hi, we are hiring part-time workers to rate hotels on Google Maps. Earn {amt} per day, work from home, salary paid daily. Reply YES to join"},
    {"vector": "Email", "title": "{Brand} account-suspended phishing",
     "text": "Your {Brand} account has been suspended due to unusual activity. Verify your identity within 24 hours to avoid permanent closure: https://{domain}/account/verify"},
    {"vector": "Email", "title": "Fake invoice with malicious attachment",
     "text": "Please find attached invoice #{n} for immediate payment. Download the invoice viewer: http://{ip}/files/invoice_{n}.exe"},
    {"vector": "Web", "title": "Look-alike {Brand} login page",
     "text": "https://{domain}/signin?session={n}&redirect=secure"},
    {"vector": "Web", "title": "Shortened link to credential harvester",
     "text": "Your parcel delivery failed, address incomplete. Reschedule here: https://bit.ly/{short}"},
    {"vector": "QR", "title": "'Scan QR to receive refund' trap", "kind": "qr",
     "text": "upi://pay?pa=refund.desk{n}@ybl&pn=Refund%20Helpdesk&am={amt_n}&cu=INR"},
    {"vector": "QR", "title": "Parking-meter QR sticker swap", "kind": "qr",
     "text": "https://{city}-parking-pay.{tld}/meter/{n}"},
    {"vector": "SMS", "title": "Scan QR to receive cashback",
     "text": "You have won cashback of {amt}! Scan the QR code sent to your WhatsApp to receive payment in your account now"},
    {"vector": "Voice", "title": "Deepfake 'family emergency' voice call", "kind": "audio_transcript",
     "text": "Mom it's me, I'm in trouble, I had an accident and police took my phone. Please don't tell dad, send money urgently to this new number"},
    {"vector": "Voice", "title": "AI-cloned CEO wire-transfer request", "kind": "audio_transcript",
     "text": "Hi {name}, it's your boss. I'm in a confidential meeting, don't tell anyone. I need you to buy gift cards worth {amt} right now and send me the codes"},
    {"vector": "Voice", "title": "'Digital arrest' video-call extortion", "kind": "audio_transcript",
     "text": "This is CBI officer. A parcel in your name with illegal drugs was seized at customs. You are under digital arrest, do not disconnect, transfer {amt} for verification"},
    {"vector": "SMS", "title": "OTP 'sent by mistake' takeover",
     "text": "Hi, I sent an OTP to your number by mistake. Please share the 6 digit code with me, it's urgent"},
    {"vector": "Telegram", "title": "Crypto 'guaranteed returns' group",
     "text": "Join our VIP trading signals group on Telegram. Guaranteed returns of 40% weekly profit. Double your money with USDT deposit to our wallet address"},
    {"vector": "SMS", "title": "Fake traffic e-challan APK",
     "text": "Your vehicle has an unpaid traffic challan of {amt}. Download the eChallan app now: http://echallan-{w}.{tld}/eChallan.apk"},
    {"vector": "Email", "title": "Remote-access 'refund' support scam",
     "text": "Your refund of {amt} is pending. Our support executive will help you claim it. Install AnyDesk and share the access code immediately"},
]

EMERGING = [
    ("AI-cloned voice 'stuck at airport' calls", "deepfake_audio"),
    ("Fake e-challan APK spreading on WhatsApp", "malware"),
    ("Parking-meter QR sticker swaps", "fake_qr"),
    ("Telegram hotel-review task scams", "job_scam"),
    ("Fake IPO allotment VIP groups", "investment_scam"),
    ("'Digital arrest' video-call extortion", "impersonation"),
    ("Fake recruiter PDFs with info-stealer", "malware"),
    ("Electricity disconnection smishing wave", "payment_fraud"),
    ("Crypto 'recovery service' re-victimisation", "investment_scam"),
    ("Deepfake CEO payment-approval calls", "deepfake_audio"),
    ("Unpaid toll-fee smishing", "phishing_link"),
    ("Courier 'address incomplete' links", "phishing_link"),
    ("OTP 'sent by mistake' account takeovers", "otp_theft"),
    ("Fake KYC update links (banking)", "payment_fraud"),
    ("Look-alike Microsoft 365 login kits", "phishing_link"),
]
SEVERITY_FOR_CAT = {
    "deepfake_audio": "critical", "malware": "critical", "impersonation": "high", "fake_qr": "high",
    "phishing_link": "high", "payment_fraud": "high", "job_scam": "medium", "investment_scam": "medium",
    "otp_theft": "critical",
}


def generate_sample() -> Dict:
    t = random.choice(TEMPLATES)
    brand = random.choice(BRANDS)
    bank = random.choice(BANKS)
    amt = _amt()
    fill = {
        "bank": bank, "bank_l": bank.lower(), "w": random.choice(WORDS), "tld": random.choice(TLDS),
        "phone": f"+91 9{random.randint(100000000, 999999999)}", "name": random.choice(NAMES),
        "amt": amt, "amt_n": "".join(ch for ch in amt if ch.isdigit()), "n": random.randint(1000, 99999),
        "Brand": brand.title(), "domain": _domain(brand),
        "ip": f"{random.randint(23, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
        "short": "".join(random.choices("abcdefghijkmnpqrstuvwxyz23456789", k=7)),
        "city": random.choice(["mumbai", "pune", "london", "austin", "delhi"]),
    }
    return {
        "text": t["text"].format(**fill),
        "title": t["title"].format(**fill),
        "vector": t["vector"],
        "kind": t.get("kind", "auto"),
        "region": random.choice(REGIONS),
    }


def generate_blip() -> Dict:
    title, cat = random.choice(EMERGING)
    region = random.choice(REGIONS)
    idx = REGIONS.index(region)
    return {
        "title": title,
        "category": cat,
        "severity": SEVERITY_FOR_CAT.get(cat, "medium") if random.random() > .25 else random.choice(["medium", "high", "critical"]),
        "region": region,
        "bearing": (idx * (360 / len(REGIONS)) + random.uniform(-10, 10)) % 360,
        "distance": round(random.uniform(0.22, 0.95), 3),
        "trend": random.choices(["emerging", "spreading", "contained"], weights=[4, 3, 2])[0],
        "reports": random.randint(12, 4800),
    }

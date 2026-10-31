"""ProblemHunt v4 — daily-habit features.

* "Scam or Safe?" daily challenge (3 real-style messages a day), points, streaks,
  badges and a weekly leaderboard (all-India or by city)
* Personal Safety Score (security checkup, 0–100)
* Scam map: where scams are being reported (by city, last 30 days)
* Daily "challenge is ready" push notification
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from . import product
from .auth import require_user
from .platform_db import new_id, now_iso
from .product import PDB, _optional_user, _rl, admin, router

log = logging.getLogger("problemhunt.play")
IST = timezone(timedelta(hours=5, minutes=30))


def ist_day(offset: int = 0) -> str:
    return (datetime.now(IST) + timedelta(days=offset)).strftime("%Y-%m-%d")


# ====================================================================== challenge bank
# Built-in challenges (English + Hindi). Admin can add more, in any language, from the admin panel.
BANK: List[Dict[str, Any]] = [
    {"id": "b01", "channel": "sms", "answer": "scam",
     "en": "Dear customer, your SBI YONO account will be blocked today. Update PAN now: http://sbi-kyc-update.in/login",
     "hi": "प्रिय ग्राहक, आपका SBI YONO खाता आज ब्लॉक हो जाएगा। अभी PAN अपडेट करें: http://sbi-kyc-update.in/login",
     "why_en": "Banks never send KYC links by SMS. The link is not sbi.co.in and it threatens you with a deadline.",
     "why_hi": "बैंक SMS में KYC लिंक नहीं भेजते। लिंक sbi.co.in नहीं है और डेडलाइन का डर दिखाया गया है।"},
    {"id": "b02", "channel": "sms", "answer": "safe",
     "en": "Rs 499.00 debited from A/c XX4521 on 29-10 to AMAZON PAY. Not you? Call 1800 1234 (number on your card). -HDFC Bank",
     "hi": "A/c XX4521 से 29-10 को AMAZON PAY को Rs 499.00 डेबिट। आपने नहीं किया? कार्ड पर लिखे नंबर 1800 1234 पर कॉल करें। -HDFC Bank",
     "why_en": "A normal transaction alert: no link, no request for OTP, and it tells you to use the number printed on your card.",
     "why_hi": "यह सामान्य ट्रांज़ैक्शन अलर्ट है: कोई लिंक नहीं, OTP नहीं मांगा, और कार्ड पर लिखे नंबर पर कॉल करने को कहा है।"},
    {"id": "b03", "channel": "call", "answer": "scam",
     "en": "Caller: 'This is CBI. A parcel with drugs in your name was caught. You are under digital arrest. Stay on video call and transfer money for verification.'",
     "hi": "कॉलर: 'मैं CBI से बोल रहा हूँ। आपके नाम का ड्रग्स वाला पार्सल पकड़ा गया है। आप डिजिटल अरेस्ट में हैं। वीडियो कॉल पर रहें और वेरिफिकेशन के लिए पैसे भेजें।'",
     "why_en": "There is no such thing as 'digital arrest'. Police never ask for money on video calls. Hang up and call 1930.",
     "why_hi": "'डिजिटल अरेस्ट' जैसी कोई चीज़ नहीं होती। पुलिस वीडियो कॉल पर पैसे नहीं मांगती। फ़ोन काटें और 1930 पर कॉल करें।"},
    {"id": "b04", "channel": "whatsapp", "answer": "scam",
     "en": "Part-time job! Like YouTube videos and earn ₹3,000/day. First task pays ₹150. Join our Telegram: t.me/earn_daily_job",
     "hi": "पार्ट-टाइम जॉब! YouTube वीडियो लाइक करें और रोज़ ₹3,000 कमाएँ। पहले टास्क पर ₹150। हमारे Telegram से जुड़ें: t.me/earn_daily_job",
     "why_en": "Classic task scam: small payouts first, then they ask you to 'invest' to unlock bigger tasks and the money disappears.",
     "why_hi": "यह टास्क स्कैम है: पहले थोड़े पैसे देते हैं, फिर बड़े टास्क के लिए 'निवेश' करवाते हैं और पैसा गायब।"},
    {"id": "b05", "channel": "upi", "answer": "scam",
     "en": "OLX buyer: 'I am sending ₹12,000 for your sofa. Scan this QR and enter your UPI PIN to receive the money.'",
     "hi": "OLX खरीदार: 'मैं आपके सोफ़े के ₹12,000 भेज रहा हूँ। पैसे पाने के लिए यह QR स्कैन करें और UPI PIN डालें।'",
     "why_en": "You never need to scan a QR or enter your PIN to RECEIVE money. PIN is only for sending.",
     "why_hi": "पैसे पाने के लिए कभी QR स्कैन या PIN डालने की ज़रूरत नहीं होती। PIN सिर्फ़ पैसे भेजने के लिए है।"},
    {"id": "b06", "channel": "sms", "answer": "safe",
     "en": "Your OTP for login to DigiLocker is 482913. Do not share it with anyone. -DigiLocker",
     "hi": "DigiLocker लॉगिन के लिए आपका OTP 482913 है। इसे किसी के साथ साझा न करें। -DigiLocker",
     "why_en": "A normal OTP message for a login YOU started. It's safe as long as you don't share the code with anyone.",
     "why_hi": "यह आपके खुद के लॉगिन का सामान्य OTP है। जब तक आप कोड किसी को न बताएँ, सुरक्षित है।"},
    {"id": "b07", "channel": "sms", "answer": "scam",
     "en": "Dear consumer your electricity power will be disconnected tonight at 9.30 pm because previous month bill was not update. Call officer 98XXXXXX21",
     "hi": "प्रिय उपभोक्ता, पिछले महीने का बिल अपडेट न होने से आज रात 9.30 बजे आपकी बिजली कट जाएगी। अधिकारी को कॉल करें 98XXXXXX21",
     "why_en": "Electricity boards don't send threats from personal mobile numbers. The 'officer' will ask you to install a remote-access app.",
     "why_hi": "बिजली विभाग निजी मोबाइल नंबर से धमकी नहीं भेजता। 'अधिकारी' आपसे रिमोट-एक्सेस ऐप इंस्टॉल करवाएगा।"},
    {"id": "b08", "channel": "whatsapp", "answer": "scam",
     "en": "Hi Mom, this is my new number, old phone broke. Urgent: please pay ₹18,500 to this UPI for my exam fee, I'll explain later 🙏",
     "hi": "माँ, यह मेरा नया नंबर है, पुराना फ़ोन टूट गया। ज़रूरी: परीक्षा फ़ीस के लिए इस UPI पर ₹18,500 भेज दो, बाद में बताऊँगा 🙏",
     "why_en": "'New number + urgent money' is a family-impersonation scam. Call the person on their OLD number before paying.",
     "why_hi": "'नया नंबर + तुरंत पैसे' परिवार का रूप धरकर ठगी है। पैसे भेजने से पहले पुराने नंबर पर कॉल करें।"},
    {"id": "b09", "channel": "email", "answer": "safe",
     "en": "From: no-reply@irctc.co.in — Your ticket PNR 4512398760 is CONFIRMED. Train 12951, Coach B3, Seat 41. Happy journey!",
     "hi": "From: no-reply@irctc.co.in — आपका टिकट PNR 4512398760 कन्फ़र्म है। ट्रेन 12951, कोच B3, सीट 41। शुभ यात्रा!",
     "why_en": "Official domain, information only, no link to click or payment asked. This looks like a normal booking confirmation.",
     "why_hi": "आधिकारिक डोमेन, सिर्फ़ जानकारी, न कोई लिंक न पैसे की मांग। यह सामान्य बुकिंग कन्फ़र्मेशन है।"},
    {"id": "b10", "channel": "sms", "answer": "scam",
     "en": "Congratulations! Your mobile number won ₹25,00,000 in KBC Lucky Draw. To claim, pay ₹9,800 GST. WhatsApp Rana Pratap: +92 3XX XXXXXXX",
     "hi": "बधाई! आपके मोबाइल नंबर ने KBC लकी ड्रॉ में ₹25,00,000 जीते। पाने के लिए ₹9,800 GST भरें। WhatsApp राणा प्रताप: +92 3XX XXXXXXX",
     "why_en": "You can't win a lottery you never entered. Paying 'tax' to receive a prize is always a scam. +92 is a Pakistan number.",
     "why_hi": "जिस लॉटरी में आपने भाग नहीं लिया, वह नहीं जीत सकते। इनाम पाने के लिए 'टैक्स' भरना हमेशा ठगी है।"},
    {"id": "b11", "channel": "call", "answer": "scam",
     "en": "Caller: 'Sir, I'm from your bank. Your card reward points ₹4,200 expire today. I've sent an OTP, just read it to me to redeem.'",
     "hi": "कॉलर: 'सर, मैं आपके बैंक से हूँ। आपके कार्ड के ₹4,200 रिवॉर्ड पॉइंट आज ख़त्म हो रहे हैं। मैंने OTP भेजा है, बस पढ़कर बता दीजिए।'",
     "why_en": "No bank employee ever asks for an OTP. Reading it out lets them take money from your card.",
     "why_hi": "कोई बैंक कर्मचारी कभी OTP नहीं मांगता। OTP बताते ही आपके कार्ड से पैसे निकल जाते हैं।"},
    {"id": "b12", "channel": "whatsapp", "answer": "scam",
     "en": "Wedding invitation 💐 Please see the card: Wedding_Card.apk",
     "hi": "शादी का निमंत्रण 💐 कृपया कार्ड देखें: Wedding_Card.apk",
     "why_en": "A wedding card is never an .apk file. Opening it installs malware that reads your SMS and OTPs.",
     "why_hi": "शादी का कार्ड कभी .apk फ़ाइल नहीं होता। इसे खोलने से मैलवेयर इंस्टॉल होता है जो आपके SMS और OTP पढ़ता है।"},
    {"id": "b13", "channel": "sms", "answer": "safe",
     "en": "Your Aadhaar was used for authentication at 10:42 on 29-10 (UIDAI). If not done by you, lock biometrics at myaadhaar.uidai.gov.in",
     "hi": "29-10 को 10:42 पर आपके आधार से प्रमाणीकरण हुआ (UIDAI)। अगर आपने नहीं किया, तो myaadhaar.uidai.gov.in पर बायोमेट्रिक लॉक करें",
     "why_en": "Official UIDAI notification pointing to the real uidai.gov.in site, and it doesn't ask for any code or money.",
     "why_hi": "यह UIDAI की आधिकारिक सूचना है जो असली uidai.gov.in साइट बताती है और कोई कोड या पैसा नहीं मांगती।"},
    {"id": "b14", "channel": "whatsapp", "answer": "scam",
     "en": "Join 'Stock Gurus VIP' group. Our IPO allotment app gives 300% returns guaranteed. Download 'SG Pro' from this link and deposit ₹50,000.",
     "hi": "'Stock Gurus VIP' ग्रुप जॉइन करें। हमारा IPO ऐप 300% रिटर्न की गारंटी देता है। इस लिंक से 'SG Pro' डाउनलोड करें और ₹50,000 जमा करें।",
     "why_en": "Guaranteed high returns + private app outside the Play Store = investment scam. Use only SEBI-registered brokers.",
     "why_hi": "गारंटी वाला भारी रिटर्न + Play Store से बाहर का ऐप = निवेश ठगी। सिर्फ़ SEBI-पंजीकृत ब्रोकर का उपयोग करें।"},
    {"id": "b15", "channel": "call", "answer": "scam",
     "en": "Voice sounds like your nephew, crying: 'Chacha, I had an accident, police took me, send ₹40,000 to this number now, don't tell papa.'",
     "hi": "आवाज़ आपके भतीजे जैसी, रोते हुए: 'चाचा, एक्सीडेंट हो गया, पुलिस ले गई, अभी इस नंबर पर ₹40,000 भेजो, पापा को मत बताना।'",
     "why_en": "AI can clone voices from short clips. Secrecy + panic + money = scam. Hang up and call the person or their parents directly.",
     "why_hi": "AI छोटी क्लिप से आवाज़ की नकल कर लेता है। गोपनीयता + घबराहट + पैसा = ठगी। फ़ोन काटें और उसी व्यक्ति या माता-पिता को सीधे कॉल करें।"},
    {"id": "b16", "channel": "sms", "answer": "safe",
     "en": "Your Swiggy order #8812 is out for delivery. Track: https://www.swiggy.com/track. Delivery partner will NOT ask for OTP unless order is COD.",
     "hi": "आपका Swiggy ऑर्डर #8812 डिलीवरी के लिए निकला है। ट्रैक करें: https://www.swiggy.com/track",
     "why_en": "Normal update with the real swiggy.com domain and no request for payment or personal data.",
     "why_hi": "असली swiggy.com डोमेन के साथ सामान्य अपडेट, कोई पैसा या निजी जानकारी नहीं मांगी गई।"},
    {"id": "b17", "channel": "sms", "answer": "scam",
     "en": "INDIA POST: Your package is held at warehouse due to incomplete address. Update within 12 hrs: https://indiapost-redelivery.top",
     "hi": "INDIA POST: अधूरे पते के कारण आपका पैकेज गोदाम में रुका है। 12 घंटे में अपडेट करें: https://indiapost-redelivery.top",
     "why_en": "India Post's site ends in .gov.in. A '.top' domain with a 12-hour deadline is a phishing trap for card details.",
     "why_hi": "India Post की साइट .gov.in पर होती है। '.top' डोमेन और 12 घंटे की डेडलाइन कार्ड की जानकारी चुराने का जाल है।"},
    {"id": "b18", "channel": "whatsapp", "answer": "scam",
     "en": "Instant loan ₹50,000 in 5 minutes! No CIBIL check. Install 'RupeeFast' app and allow contacts & gallery access.",
     "hi": "5 मिनट में ₹50,000 का लोन! CIBIL चेक नहीं। 'RupeeFast' ऐप इंस्टॉल करें और कॉन्टैक्ट्स व गैलरी की अनुमति दें।",
     "why_en": "Illegal loan apps grab your contacts and photos, then blackmail you. Borrow only from RBI-registered lenders.",
     "why_hi": "अवैध लोन ऐप आपके कॉन्टैक्ट्स और फ़ोटो लेकर ब्लैकमेल करते हैं। सिर्फ़ RBI-पंजीकृत संस्थाओं से लोन लें।"},
    {"id": "b19", "channel": "call", "answer": "safe",
     "en": "You called the number printed on the back of your debit card. The agent asks your name and last transaction, and says they will never ask for PIN or OTP.",
     "hi": "आपने अपने डेबिट कार्ड के पीछे लिखे नंबर पर कॉल किया। एजेंट नाम और पिछला ट्रांज़ैक्शन पूछता है और कहता है कि वे कभी PIN या OTP नहीं मांगेंगे।",
     "why_en": "YOU called the official number from your card, and they didn't ask for PIN/OTP. That's the safe way to contact a bank.",
     "why_hi": "आपने खुद कार्ड पर लिखे आधिकारिक नंबर पर कॉल किया और PIN/OTP नहीं मांगा गया। बैंक से संपर्क का यही सुरक्षित तरीका है।"},
    {"id": "b20", "channel": "email", "answer": "scam",
     "en": "From: incometax-refund@gmail.com — You are eligible for a tax refund of ₹15,490. Submit your debit card details here to receive it.",
     "hi": "From: incometax-refund@gmail.com — आप ₹15,490 के टैक्स रिफ़ंड के पात्र हैं। पाने के लिए यहाँ डेबिट कार्ड की जानकारी दें।",
     "why_en": "The Income Tax department never uses Gmail and refunds go straight to your bank account — no card details needed.",
     "why_hi": "आयकर विभाग Gmail का उपयोग नहीं करता और रिफ़ंड सीधे बैंक खाते में आता है — कार्ड की जानकारी नहीं चाहिए।"},
    {"id": "b21", "channel": "whatsapp", "answer": "scam",
     "en": "Unknown woman video-calls you at night, then sends a recording: 'Pay ₹30,000 or I share this video with your contacts.'",
     "hi": "रात को अनजान महिला वीडियो कॉल करती है, फिर रिकॉर्डिंग भेजकर कहती है: '₹30,000 दो वरना यह वीडियो तुम्हारे कॉन्टैक्ट्स को भेज दूँगी।'",
     "why_en": "Sextortion. Don't pay — paying never stops it. Block, keep screenshots, report at cybercrime.gov.in or call 1930.",
     "why_hi": "यह सेक्सटॉर्शन है। पैसे न दें — देने से रुकता नहीं। ब्लॉक करें, स्क्रीनशॉट रखें, cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें।"},
    {"id": "b22", "channel": "sms", "answer": "scam",
     "en": "Your FASTag KYC is expired. Vehicle will be blacklisted at toll. Update now: bit.ly/fastag-kyc-upd",
     "hi": "आपका FASTag KYC समाप्त हो गया है। टोल पर वाहन ब्लैकलिस्ट होगा। अभी अपडेट करें: bit.ly/fastag-kyc-upd",
     "why_en": "Short links hide the real site. Update FASTag KYC only in your bank's app or the official NHAI site.",
     "why_hi": "शॉर्ट लिंक असली साइट छिपाते हैं। FASTag KYC सिर्फ़ अपने बैंक ऐप या आधिकारिक NHAI साइट पर अपडेट करें।"},
    {"id": "b23", "channel": "upi", "answer": "safe",
     "en": "Your PhonePe shows: 'Collect request from Ramesh Kirana ₹230' — you just bought groceries there and the shop asked you to approve.",
     "hi": "PhonePe में दिखा: 'Ramesh Kirana से ₹230 का कलेक्ट रिक्वेस्ट' — आपने अभी वहीं से सामान ख़रीदा और दुकानदार ने मंज़ूरी देने को कहा।",
     "why_en": "You know the payee and you are paying for something you bought. Approving is fine — just check name and amount.",
     "why_hi": "आप पाने वाले को जानते हैं और ख़रीदे सामान का भुगतान कर रहे हैं। मंज़ूरी देना ठीक है — बस नाम और रकम जाँच लें।"},
    {"id": "b24", "channel": "call", "answer": "scam",
     "en": "Caller: 'Your SIM will be blocked in 2 hours by TRAI because it was used for illegal ads. Press 9 to talk to the officer.'",
     "hi": "कॉलर: 'TRAI 2 घंटे में आपका SIM ब्लॉक कर देगा क्योंकि इससे अवैध विज्ञापन भेजे गए। अधिकारी से बात करने के लिए 9 दबाएँ।'",
     "why_en": "TRAI never calls to block SIMs. Report such calls on Sanchar Saathi → Chakshu.",
     "why_hi": "TRAI कभी SIM ब्लॉक करने के लिए कॉल नहीं करता। ऐसे कॉल की शिकायत संचार साथी → चक्षु पर करें।"},
]
BANK_BY_ID = {b["id"]: b for b in BANK}
PER_DAY = 3


def _pool(lang: str) -> List[Dict[str, Any]]:
    """Admin items in this language first, then built-ins (EN/HI text)."""
    custom = PDB.query("SELECT * FROM challenges WHERE active=1 AND (lang=? OR lang='all')", (lang,))
    if lang != "en" and not custom:
        custom = PDB.query("SELECT * FROM challenges WHERE active=1 AND lang='en'")
    items = [{"id": "c_" + c["id"], "channel": c["channel"] or "sms", "answer": c["answer"],
              "text": c["message"], "why": c["explanation"]} for c in custom]
    use_hi = lang in ("hi", "mr")
    for b in BANK:
        items.append({"id": b["id"], "channel": b["channel"], "answer": b["answer"],
                      "text": b["hi"] if use_hi else b["en"], "why": b["why_hi"] if use_hi else b["why_en"]})
    return items


def _today_items(lang: str, day: str) -> List[Dict[str, Any]]:
    pool = _pool(lang)
    pool.sort(key=lambda x: hashlib.sha256(f"{day}:{x['id']}".encode()).hexdigest())
    custom = [x for x in pool if x["id"].startswith("c_")]
    if custom:  # admin-written items (often in the reader's own language) always get a slot
        pool = custom[:2] + [x for x in pool if x not in custom[:2]]
    picked = pool[:PER_DAY]
    if not any(x["answer"] == "safe" for x in picked):  # keep it fair: at least one safe example most days
        safe = next((x for x in pool[PER_DAY:] if x["answer"] == "safe"), None)
        if safe and int(hashlib.sha256(day.encode()).hexdigest(), 16) % 3:
            picked[-1] = safe
    return picked


def _find_item(item_id: str, lang: str) -> Optional[Dict[str, Any]]:
    for x in _pool(lang):
        if x["id"] == item_id:
            return x
    return None


# =========================================================================== badges
BADGES = {
    "first_play": "First challenge", "sharp_eye": "3/3 in a day", "streak_3": "3-day streak", "streak_7": "7-day streak",
    "streak_30": "30-day streak", "points_100": "100 points", "points_500": "500 points", "safety_80": "Safety score 80+",
    "reporter": "Reported a scam", "guardian": "Family guardian",
}


def _badges(u: Dict[str, Any]) -> List[str]:
    try:
        return list(json.loads(u.get("badges") or "[]"))
    except Exception:
        return []


def _award(uid: str, *names: str) -> List[str]:
    u = PDB.get("users", uid)
    have = _badges(u)
    new = [n for n in names if n in BADGES and n not in have]
    if new:
        PDB.update("users", uid, {"badges": json.dumps(have + new)})
    return new


def _stats(u: Dict[str, Any]) -> Dict[str, Any]:
    today, yday = ist_day(), ist_day(-1)
    streak = u.get("streak") or 0
    if u.get("last_play_day") not in (today, yday):
        streak = 0  # broken
    return {"points": u.get("points") or 0, "streak": streak, "best_streak": u.get("best_streak") or 0,
            "played_today": u.get("last_play_day") == today, "badges": _badges(u), "city": u.get("city") or ""}


# ======================================================================= game routes
@router.get("/api/play/today")
async def play_today(lang: str = "en", user=Depends(_optional_user)):
    day = ist_day()
    items = _today_items(lang, day)
    answered = {}
    if user:
        for a in PDB.query("SELECT item_id, choice, correct FROM play_answers WHERE user_id=? AND day=?", (user["id"], day)):
            it = next((x for x in items if x["id"] == a["item_id"]), None)
            if it:
                answered[a["item_id"]] = {"choice": a["choice"], "correct": bool(a["correct"]), "answer": it["answer"], "why": it["why"]}
    return {"day": day, "items": [{"id": x["id"], "channel": x["channel"], "text": x["text"]} for x in items],
            "answered": answered, "stats": _stats(user) if user else None,
            "players_today": PDB.scalar("SELECT COUNT(DISTINCT user_id) FROM play_answers WHERE day=?", (day,))}


class AnswerIn(BaseModel):
    id: str = Field(..., max_length=60)
    choice: str = Field(..., pattern="^(scam|safe)$")
    lang: str = "en"


@router.post("/api/play/answer")
async def play_answer(body: AnswerIn, request: Request, user=Depends(_optional_user)):
    _rl(request)
    day = ist_day()
    items = _today_items(body.lang, day)
    it = next((x for x in items if x["id"] == body.id), None) or _find_item(body.id, body.lang)
    if not it:
        raise HTTPException(404, "Challenge not found")
    correct = body.choice == it["answer"]
    out: Dict[str, Any] = {"correct": correct, "answer": it["answer"], "why": it["why"], "points": 0, "new_badges": []}
    PDB.bump("play_answers")
    if not user or not any(x["id"] == body.id for x in items):
        return out
    uid = user["id"]
    if PDB.scalar("SELECT COUNT(*) FROM play_answers WHERE user_id=? AND day=? AND item_id=?", (uid, day, body.id)):
        out["already"] = True
        out["stats"] = _stats(PDB.get("users", uid))
        return out
    pts = 10 if correct else 2
    first_today = user.get("last_play_day") != day
    u = PDB.get("users", uid)
    streak = u.get("streak") or 0
    if first_today:
        streak = streak + 1 if u.get("last_play_day") == ist_day(-1) else 1
        pts += min(streak, 10) * 2  # streak bonus once a day
    PDB.insert("play_answers", {"id": new_id("pa"), "user_id": uid, "day": day, "item_id": body.id, "choice": body.choice,
                                "correct": int(correct), "points": pts, "created_at": now_iso()})
    PDB.update("users", uid, {"points": (u.get("points") or 0) + pts, "streak": streak,
                              "best_streak": max(u.get("best_streak") or 0, streak), "last_play_day": day})
    u = PDB.get("users", uid)
    earned = ["first_play"]
    done = PDB.query("SELECT correct FROM play_answers WHERE user_id=? AND day=?", (uid, day))
    if len(done) >= PER_DAY and all(d["correct"] for d in done):
        earned.append("sharp_eye")
    earned += [f"streak_{n}" for n in (3, 7, 30) if streak >= n]
    earned += [f"points_{n}" for n in (100, 500) if (u.get("points") or 0) >= n]
    out.update(points=pts, new_badges=_award(uid, *earned), stats=_stats(PDB.get("users", uid)))
    return out


def _mask(name: str, email: str) -> str:
    n = (name or "").strip() or (email or "").split("@")[0] or "Player"
    parts = n.split()
    return parts[0][:14] + (" " + parts[1][0] + "." if len(parts) > 1 else "")


@router.get("/api/play/leaderboard")
async def leaderboard(city: str = "", user=Depends(_optional_user)):
    now = datetime.now(IST)
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    params: list = [week_start]
    where = ""
    if city:
        where = " AND LOWER(u.city)=LOWER(?)"
        params.append(city.strip()[:40])
    rows = PDB.query("SELECT u.id, u.name, u.email, u.city, u.streak, SUM(p.points) AS pts FROM play_answers p "
                     "JOIN users u ON u.id=p.user_id WHERE p.day>=?" + where +
                     " GROUP BY u.id ORDER BY pts DESC LIMIT 50", params)
    board = [{"rank": i + 1, "name": _mask(r["name"], r["email"]), "city": r["city"] or "", "points": r["pts"],
              "me": bool(user and r["id"] == user["id"])} for i, r in enumerate(rows)]
    return {"week_start": week_start, "board": board[:20], "me": next((b for b in board if b["me"]), None),
            "cities": [r["city"] for r in PDB.query("SELECT city, COUNT(*) n FROM users WHERE city!='' GROUP BY LOWER(city) ORDER BY n DESC LIMIT 15")]}


class CityIn(BaseModel):
    city: str = Field(..., max_length=40)


@router.post("/api/me/city")
async def set_city(body: CityIn, user=Depends(require_user)):
    PDB.update("users", user["id"], {"city": body.city.strip().title()})
    return {"ok": True, "city": body.city.strip().title()}


@router.get("/api/me/stats")
async def my_stats(user=Depends(require_user)):
    return {**_stats(user), "badge_names": BADGES}


# ===================================================================== safety score
CHECKUP = [  # id, weight, auto?
    ("upi_pin", 15, False), ("wa_2step", 12, False), ("sanchar_kym", 12, False), ("password_check", 10, False),
    ("google_2fa", 10, False), ("bank_alerts", 8, False), ("app_lock", 8, False), ("save_1930", 5, False),
    ("phone_linked", 5, True), ("contacts", 8, True), ("family", 7, True),
]


def _checkup(u: Dict[str, Any]) -> Dict[str, Any]:
    try:
        manual = json.loads(u.get("checkup") or "{}")
    except Exception:
        manual = {}
    auto = {"phone_linked": bool(u.get("phone")),
            "contacts": PDB.scalar("SELECT COUNT(*) FROM contacts WHERE user_id=?", (u["id"],)) > 0,
            "family": bool(u.get("family_code"))}
    items, score = [], 0
    for cid, w, is_auto in CHECKUP:
        done = bool(auto.get(cid)) if is_auto else bool(manual.get(cid))
        score += w if done else 0
        items.append({"id": cid, "weight": w, "auto": is_auto, "done": done})
    if auto["family"]:
        _award(u["id"], "guardian")
    return {"score": score, "items": items}


@router.get("/api/checkup")
async def get_checkup(user=Depends(require_user)):
    return _checkup(user)


class CheckupIn(BaseModel):
    item: str = Field(..., max_length=30)
    done: bool


@router.post("/api/checkup")
async def set_checkup(body: CheckupIn, user=Depends(require_user)):
    if body.item not in {c[0] for c in CHECKUP if not c[2]}:
        raise HTTPException(400, "Unknown item")
    try:
        manual = json.loads(user.get("checkup") or "{}")
    except Exception:
        manual = {}
    manual[body.item] = body.done
    PDB.update("users", user["id"], {"checkup": json.dumps(manual)})
    res = _checkup(PDB.get("users", user["id"]))
    res["new_badges"] = _award(user["id"], "safety_80") if res["score"] >= 80 else []
    return res


# ========================================================================= scam map
CITY_COORDS = {
    "delhi": (28.61, 77.21), "new delhi": (28.61, 77.21), "mumbai": (19.08, 72.88), "bengaluru": (12.97, 77.59),
    "bangalore": (12.97, 77.59), "hyderabad": (17.39, 78.49), "chennai": (13.08, 80.27), "kolkata": (22.57, 88.36),
    "pune": (18.52, 73.86), "ahmedabad": (23.02, 72.57), "jaipur": (26.91, 75.79), "lucknow": (26.85, 80.95),
    "kanpur": (26.45, 80.33), "nagpur": (21.15, 79.09), "indore": (22.72, 75.86), "bhopal": (23.26, 77.41),
    "patna": (25.59, 85.14), "surat": (21.17, 72.83), "vadodara": (22.31, 73.18), "ludhiana": (30.90, 75.86),
    "chandigarh": (30.73, 76.78), "amritsar": (31.63, 74.87), "agra": (27.18, 78.01), "varanasi": (25.32, 82.97),
    "noida": (28.54, 77.39), "gurugram": (28.46, 77.03), "gurgaon": (28.46, 77.03), "ghaziabad": (28.67, 77.45),
    "faridabad": (28.41, 77.32), "dehradun": (30.32, 78.03), "ranchi": (23.34, 85.31), "jamshedpur": (22.80, 86.20),
    "bhubaneswar": (20.30, 85.82), "cuttack": (20.46, 85.88), "guwahati": (26.14, 91.74), "kochi": (9.93, 76.27),
    "thiruvananthapuram": (8.52, 76.94), "kozhikode": (11.26, 75.78), "coimbatore": (11.02, 76.96),
    "madurai": (9.93, 78.12), "visakhapatnam": (17.69, 83.22), "vijayawada": (16.51, 80.65), "mysuru": (12.30, 76.64),
    "mysore": (12.30, 76.64), "mangaluru": (12.91, 74.86), "nashik": (19.99, 73.79), "aurangabad": (19.88, 75.34),
    "raipur": (21.25, 81.63), "srinagar": (34.08, 74.80), "jammu": (32.73, 74.86), "jodhpur": (26.24, 73.02),
    "udaipur": (24.59, 73.71), "goa": (15.50, 73.83), "panaji": (15.50, 73.83), "rajkot": (22.30, 70.80),
    "mewat": (28.10, 77.00), "nuh": (28.10, 77.00), "jamtara": (23.96, 86.80), "bharatpur": (27.22, 77.49),
    "shimla": (31.10, 77.17), "meerut": (28.98, 77.71), "prayagraj": (25.44, 81.85), "gwalior": (26.22, 78.18),
}


@router.get("/api/scam-map")
async def scam_map(days: int = 30):
    days = max(1, min(days, 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = PDB.query("SELECT LOWER(TRIM(city)) c, kind, COUNT(*) n, COALESCE(SUM(amount_lost),0) lost FROM reports "
                     "WHERE status!='rejected' AND city!='' AND created_at>=? GROUP BY c, kind", (since,))
    cities: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        c = cities.setdefault(r["c"], {"city": r["c"].title(), "reports": 0, "lost": 0, "kinds": {}})
        c["reports"] += r["n"]
        c["lost"] += r["lost"]
        c["kinds"][r["kind"]] = c["kinds"].get(r["kind"], 0) + r["n"]
    out = []
    for key, c in cities.items():
        lat, lon = CITY_COORDS.get(key, (None, None))
        out.append({**c, "lat": lat, "lon": lon, "top_kind": max(c["kinds"], key=c["kinds"].get)})
    out.sort(key=lambda x: -x["reports"])
    kinds = PDB.query("SELECT kind, COUNT(*) n FROM reports WHERE status!='rejected' AND created_at>=? GROUP BY kind ORDER BY n DESC",
                      (since,))
    return {"days": days, "cities": out[:60], "kinds": kinds,
            "total": PDB.scalar("SELECT COUNT(*) FROM reports WHERE status!='rejected' AND created_at>=?", (since,))}


# ==================================================================== admin + hooks
product.ENTITY_FIELDS["challenges"] = {"message", "answer", "explanation", "channel", "lang", "active"}
product.PREFIX["challenges"] = "chl"
product._make("challenges")  # admin CRUD: /api/admin/challenges


@admin.get("/play/stats")
async def admin_play_stats():
    day = ist_day()
    return {"players_today": PDB.scalar("SELECT COUNT(DISTINCT user_id) FROM play_answers WHERE day=?", (day,)),
            "answers_today": PDB.scalar("SELECT COUNT(*) FROM play_answers WHERE day=?", (day,)),
            "players_7d": PDB.scalar("SELECT COUNT(DISTINCT user_id) FROM play_answers WHERE day>=?", (ist_day(-6),)),
            "avg_score": PDB.scalar("SELECT COALESCE(ROUND(AVG(correct)*100),0) FROM play_answers WHERE day>=?", (ist_day(-6),))}


def on_report_filed(user_id: Optional[str]) -> None:
    if user_id:
        try:
            _award(user_id, "reporter")
        except Exception:
            pass


async def daily_push_loop() -> None:
    """Once a day at ~10:00 IST: 'Today's Scam-or-Safe challenge is ready'."""
    while True:
        try:
            now = datetime.now(IST)
            day = now.strftime("%Y-%m-%d")
            sent = PDB.scalar("SELECT COUNT(*) FROM stats WHERE day=? AND key='daily_push_sent'", (day,))
            if now.hour >= 10 and not sent and product._push is not None:
                PDB.execute("INSERT OR IGNORE INTO stats(day, key, value) VALUES(?, 'daily_push_sent', 1)", (day,))
                await product._push.notify("🎯 Scam or Safe? — today's challenge",
                                           "3 new real-life messages. Can you spot the scam? Keep your streak going!",
                                           tag="daily", url="/play/", force=True, severity="low")
        except Exception as exc:  # never crash the server
            log.debug("daily push: %s", exc)
        await asyncio.sleep(600)

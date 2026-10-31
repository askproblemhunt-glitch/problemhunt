"""Built-in content for ProblemHunt Workplace: awareness courses, phishing-simulation
templates and the compliance control library. Admins can still add their own content.

Framework references are an *indicative* mapping to help small organisations get
started; a qualified auditor must confirm them for any certification.
"""
from __future__ import annotations

from typing import Any, Dict, List

# ------------------------------------------------------------------ COURSES
COURSES: List[Dict[str, Any]] = [
    {"id": "phishing", "title": "Spot phishing in 5 minutes", "title_hi": "5 मिनट में फ़िशिंग पहचानें", "minutes": 6, "level": "beginner",
     "lessons": [
         {"title": "What phishing looks like", "body": "Phishing is a message that pretends to be someone you trust so that you click a link, open a file, pay money or share a code. It arrives by email, SMS, WhatsApp, social media or a phone call.\n\nThree signs appear in almost every phishing message: urgency (\"your account will be blocked today\"), a request (click, pay, share an OTP, install an app) and a small mismatch (a sender address or link that is not quite the real company)."},
         {"title": "Check the link before you click", "body": "Read the link from right to left up to the first single slash. The part just before it is the real owner: in https://sbi.co.in.verify-kyc.top/login the owner is verify-kyc.top, not SBI.\n\nShort links (bit.ly, tinyurl), misspellings (paypa1, amaz0n) and unusual endings (.top, .xyz, .click) are warning signs. When in doubt, open the official app or type the address yourself."},
         {"title": "Attachments and QR codes", "body": "Invoices, wedding cards or 'documents' that arrive as .apk, .exe, .html, .zip or Office files asking you to 'enable content' are the most common way malware gets in.\n\nA QR code is just a link you cannot read. Scanning one to 'receive money' is always a scam: you never need to scan or enter a PIN to receive."},
         {"title": "What to do", "body": "Do not click, reply or forward. Use the Report button (or forward to your security team). If you already clicked or typed a password, change it at once from the real website, turn on 2-step verification and tell IT. If money moved, call 1930 (India) within the first hour."},
     ],
     "quiz": [
         {"q": "Who really owns this link: https://hdfcbank.com.secure-login.xyz/account?", "options": ["HDFC Bank", "secure-login.xyz", "hdfcbank.com"], "answer": 1, "why": "The real domain is the part just before the first single slash: secure-login.xyz."},
         {"q": "A buyer sends a QR code so you can 'receive' ₹5,000. What do you do?", "options": ["Scan and enter UPI PIN", "Scan but don't enter PIN", "Decline — receiving money never needs a scan or PIN"], "answer": 2, "why": "A PIN is only ever needed to send money."},
         {"q": "Which file is most likely malicious when it arrives unexpectedly on WhatsApp?", "options": ["photo.jpg", "Invitation.apk", "notes.txt"], "answer": 1, "why": ".apk files install apps; criminals use them to read your SMS and OTPs."},
         {"q": "You clicked a link and typed your email password. First step?", "options": ["Wait and see", "Change the password from the real site and turn on 2-step verification", "Delete the email"], "answer": 1, "why": "Speed matters: change it before the attacker uses it."},
     ]},
    {"id": "upi", "title": "UPI and payment safety", "title_hi": "UPI और भुगतान सुरक्षा", "minutes": 5, "level": "beginner",
     "lessons": [
         {"title": "The one rule of UPI", "body": "Your UPI PIN is only for sending money. Nobody — bank, buyer, refund desk, police — ever needs your PIN or a QR scan for you to receive money.\n\nCollect requests appear as 'pay' screens. Read the payee name and amount before approving."},
         {"title": "Fake customer care and refund desks", "body": "Searching 'customer care number' online often shows numbers placed by scammers. They ask you to install AnyDesk, TeamViewer or a 'support' app, then watch your screen while you type the PIN.\n\nGet help numbers only from the official app or website. Never install screen-sharing apps at a stranger's request."},
         {"title": "If money is gone", "body": "Call 1930 immediately and file at cybercrime.gov.in; banks can freeze money if they are told fast. Call your bank to block UPI and cards. Keep screenshots, the transaction ID and the scammer's number."},
     ],
     "quiz": [
         {"q": "When do you need to enter your UPI PIN?", "options": ["To receive money", "To send money", "To check a refund"], "answer": 1, "why": "PIN = sending only."},
         {"q": "'Customer care' asks you to install AnyDesk to fix a refund. You…", "options": ["Install it", "Refuse and call the number in the official app", "Share the code they ask for"], "answer": 1, "why": "Screen-sharing lets them see your PIN and OTPs."},
         {"q": "You lost money in a UPI scam 20 minutes ago. Best first call?", "options": ["1930 cyber helpline", "The scammer", "Wait till tomorrow"], "answer": 0, "why": "The first hour gives the best chance to freeze funds."},
     ]},
    {"id": "passwords", "title": "Passwords, passkeys and 2-step verification", "title_hi": "पासवर्ड, पासकी और 2-स्टेप वेरिफ़िकेशन", "minutes": 5, "level": "beginner",
     "lessons": [
         {"title": "Long beats complex", "body": "A password of four random words (river-lamp-orbit-candle) is far harder to guess than P@ssw0rd1 and easier to remember. Aim for 14+ characters. Never reuse a work password anywhere else."},
         {"title": "Use a password manager", "body": "A password manager remembers a different strong password for every site and fills it only on the real site — which also protects you from look-alike phishing pages."},
         {"title": "Turn on 2-step verification and passkeys", "body": "2-step verification (an authenticator app code, or a passkey on your phone) stops most account takeovers even when a password leaks. Turn it on for email first: email can reset every other account. Never read a code out to anyone."},
     ],
     "quiz": [
         {"q": "Which password is strongest?", "options": ["P@ssw0rd!", "Summer2025", "lamp-orbit-river-candle-9"], "answer": 2, "why": "Length and randomness beat symbol tricks."},
         {"q": "Which account should get 2-step verification first?", "options": ["Email", "A shopping site", "A game"], "answer": 0, "why": "Email can reset all your other passwords."},
         {"q": "Someone calls from 'IT' and asks for your 2-step code. You…", "options": ["Read it out", "Refuse and report the call", "Send it by WhatsApp"], "answer": 1, "why": "Real IT never needs your code."},
     ]},
    {"id": "social", "title": "Impersonation, digital arrest and deepfakes", "title_hi": "नकली अधिकारी, डिजिटल अरेस्ट और डीपफ़ेक", "minutes": 6, "level": "intermediate",
     "lessons": [
         {"title": "Authority + fear + secrecy", "body": "Social engineers pretend to be police, CBI, customs, a courier, your boss or a relative. They create fear (arrest, account block, accident), demand secrecy (\"don't tell anyone\") and push you to act now.\n\nThere is no such thing as a 'digital arrest'. No officer collects money over a video call."},
         {"title": "Voice clones and deepfake video", "body": "AI can copy a voice from a few seconds of audio and make a convincing face on video. Agree a family or team code word. If a call asks for money or secrets, hang up and call the person back on the number you already have."},
         {"title": "CEO and vendor fraud at work", "body": "Messages from a 'CEO' asking for urgent gift cards or a payment to a new bank account are a classic business email compromise. Always confirm payment changes by phone using a known number, and follow two-person approval for transfers."},
     ],
     "quiz": [
         {"q": "A 'CBI officer' on video says you are under digital arrest and must transfer money. This is…", "options": ["A legal procedure", "A scam — hang up and call 1930", "Normal for tax issues"], "answer": 1, "why": "Digital arrest does not exist in Indian law."},
         {"q": "Your 'nephew' calls crying for money from a new number. Best step?", "options": ["Pay quickly", "Call him or his parents on the known number", "Ask him to send a selfie"], "answer": 1, "why": "Voice and video can be faked; call back on a known number."},
         {"q": "An email from the CEO asks you to buy gift cards urgently. You…", "options": ["Buy them", "Verify by phone on a known number", "Reply asking for details"], "answer": 1, "why": "Classic business email compromise."},
     ]},
    {"id": "workplace", "title": "Safe work: email, devices and Wi-Fi", "title_hi": "सुरक्षित काम: ईमेल, डिवाइस और Wi-Fi", "minutes": 5, "level": "beginner",
     "lessons": [
         {"title": "Lock, update, back up", "body": "Lock your screen whenever you leave the desk. Install updates promptly — most attacks use flaws that already have a fix. Keep work files in the approved cloud or backed-up drive, not only on your laptop."},
         {"title": "Public Wi-Fi and USB drives", "body": "Avoid logging in to work systems on open public Wi-Fi without the company VPN. Never plug in a USB drive you found; attackers leave them on purpose."},
         {"title": "Report early, without fear", "body": "If something feels wrong — an odd email, a pop-up, a lost phone — report it straight away. Fast reports turn incidents into near-misses. In India, organisations must report certain cyber incidents to CERT-In within 6 hours, so every minute helps."},
     ],
     "quiz": [
         {"q": "You found a USB drive in the parking lot. You…", "options": ["Plug it in to find the owner", "Hand it to IT without plugging it in", "Keep it"], "answer": 1, "why": "Dropped USB drives are a known attack."},
         {"q": "Why install updates quickly?", "options": ["New colours", "They fix flaws attackers already use", "They slow the PC"], "answer": 1, "why": "Most attacks use known, fixed vulnerabilities."},
         {"q": "You think you clicked something bad. When should you report?", "options": ["Now", "If something breaks", "Never — you'll be blamed"], "answer": 0, "why": "Early reports limit the damage."},
     ]},
    {"id": "privacy", "title": "Personal data at work (DPDP and GDPR basics)", "title_hi": "काम पर निजी डेटा (DPDP और GDPR की बुनियादी बातें)", "minutes": 5, "level": "intermediate",
     "lessons": [
         {"title": "What counts as personal data", "body": "Names, phone numbers, Aadhaar or PAN numbers, addresses, photos, health and bank details are personal data. India's Digital Personal Data Protection Act, 2023 and Europe's GDPR require organisations to collect only what they need, protect it and delete it when no longer needed."},
         {"title": "Everyday rules", "body": "Share customer data only through approved systems, never on personal WhatsApp or email. Don't export more than the task needs. Lock spreadsheets with personal data and delete local copies after use."},
         {"title": "If data leaks", "body": "Report immediately to your security or privacy team. The organisation may have to inform the Data Protection Board, CERT-In or regulators within strict deadlines (GDPR: 72 hours)."},
     ],
     "quiz": [
         {"q": "Which is personal data?", "options": ["A customer's phone number", "Office opening hours", "The company logo"], "answer": 0, "why": "It identifies a person."},
         {"q": "A colleague asks you to WhatsApp a customer list. You…", "options": ["Send it", "Use the approved system only", "Email it to your personal address"], "answer": 1, "why": "Personal channels are not approved for customer data."},
         {"q": "Under GDPR, a serious personal-data breach must usually be notified within…", "options": ["72 hours", "30 days", "Never"], "answer": 0, "why": "GDPR Article 33 sets 72 hours."},
     ]},
]
COURSE_BY_ID = {c["id"]: c for c in COURSES}

# ------------------------------------------------------------------ PHISHING SIMULATION TEMPLATES
# Safe training templates only. Links go to ProblemHunt's own training page.
PHISH_TEMPLATES: List[Dict[str, Any]] = [
    {"id": "it_password", "name": "Password expiry (IT)", "difficulty": "easy", "from_name": "IT Helpdesk",
     "subject": "Action required: your password expires today",
     "body": "Hello,\n\nYour network password expires in 2 hours. To avoid losing access, keep your current password here:\n{link}\n\nIT Helpdesk",
     "flags": ["Urgent deadline", "Generic greeting", "IT never asks you to 'keep' a password through a link"]},
    {"id": "hr_payroll", "name": "Payroll / salary update (HR)", "difficulty": "medium", "from_name": "HR Payroll",
     "subject": "Revised salary slip for this month",
     "body": "Dear employee,\n\nDue to the new tax regime your salary slip has been revised. Please review and confirm your bank details before the payroll cut-off:\n{link}\n\nRegards,\nHR Payroll Team",
     "flags": ["Money topic to make you curious", "Asks to confirm bank details", "Sender is not your usual HR contact"]},
    {"id": "courier", "name": "Failed courier delivery", "difficulty": "easy", "from_name": "Delivery Update",
     "subject": "Your parcel could not be delivered",
     "body": "We tried to deliver your parcel today but the address was incomplete. Pay ₹25 re-delivery fee within 12 hours or it will be returned:\n{link}",
     "flags": ["Small fee to collect card details", "12-hour deadline", "You may not be expecting a parcel"]},
    {"id": "shared_doc", "name": "Shared document", "difficulty": "hard", "from_name": "Document Share",
     "subject": "Q3 budget review — shared with you",
     "body": "A document has been shared with you: 'Q3 budget review (final).xlsx'\n\nOpen document: {link}\n\nYou received this because you are on the finance distribution list.",
     "flags": ["Looks like a normal share notification", "Check the sender and the link domain before signing in", "Unexpected 'final' financial file"]},
    {"id": "ceo_giftcards", "name": "CEO urgent request", "difficulty": "medium", "from_name": "CEO (mobile)",
     "subject": "Need a quick favour",
     "body": "Are you at your desk? I'm in a meeting and need you to arrange some gift cards for a client today. I'll reimburse you. Reply here or open the list: {link}",
     "flags": ["Authority + urgency", "Unusual request (gift cards)", "Asks you to keep it quick and quiet"]},
    {"id": "bank_kyc", "name": "Bank KYC pending", "difficulty": "easy", "from_name": "Bank Alerts",
     "subject": "KYC pending — account will be restricted",
     "body": "Dear customer, your KYC is pending. Your account will be restricted within 24 hours. Update PAN and Aadhaar now: {link}",
     "flags": ["Banks don't ask for KYC through links", "Threat of account restriction", "Asks for PAN and Aadhaar"]},
    {"id": "tax_refund", "name": "Income tax refund", "difficulty": "medium", "from_name": "Tax Refund Cell",
     "subject": "You are eligible for a refund of ₹15,490",
     "body": "Your income tax refund of ₹15,490 has been approved. Submit your account details to receive it:\n{link}",
     "flags": ["Refunds go to your registered account automatically", "Too-good-to-be-true amount", "Not from an official .gov.in address"]},
    {"id": "mfa_reset", "name": "2-step verification reset", "difficulty": "hard", "from_name": "Security Team",
     "subject": "Unusual sign-in blocked — confirm it was you",
     "body": "We blocked a sign-in attempt to your account from a new device. If this wasn't you, secure your account now and re-register 2-step verification:\n{link}",
     "flags": ["Uses a real security worry against you", "Go to the account yourself, not through the link", "Re-registering 2-step lets attackers add their device"]},
]
TEMPLATE_BY_ID = {t["id"]: t for t in PHISH_TEMPLATES}

# ------------------------------------------------------------------ COMPLIANCE CONTROL LIBRARY
FRAMEWORKS = [
    {"id": "nist_csf", "name": "NIST CSF 2.0"}, {"id": "iso27001", "name": "ISO/IEC 27001:2022"},
    {"id": "soc2", "name": "SOC 2"}, {"id": "pci_dss", "name": "PCI DSS 4.0"}, {"id": "gdpr", "name": "GDPR"},
    {"id": "hipaa", "name": "HIPAA Security Rule"}, {"id": "dpdp", "name": "India DPDP Act 2023"},
    {"id": "certin", "name": "CERT-In Directions 2022"},
]

CONTROLS: List[Dict[str, Any]] = [
    {"id": "C01", "title": "Information security policy approved and reviewed yearly", "weight": 2,
     "map": {"nist_csf": "GV.PO", "iso27001": "A.5.1", "soc2": "CC5.3", "pci_dss": "Req 12.1", "gdpr": "Art. 24", "hipaa": "164.316", "dpdp": "Sec. 8(5)"}},
    {"id": "C02", "title": "Named security owner and clear responsibilities", "weight": 1,
     "map": {"nist_csf": "GV.RR", "iso27001": "A.5.2", "soc2": "CC1.3", "pci_dss": "Req 12.4", "hipaa": "164.308(a)(2)"}},
    {"id": "C03", "title": "Inventory of devices, software and data", "weight": 2,
     "map": {"nist_csf": "ID.AM", "iso27001": "A.5.9", "soc2": "CC6.1", "pci_dss": "Req 12.5", "hipaa": "164.310(d)"}},
    {"id": "C04", "title": "Risk assessment at least yearly", "weight": 2,
     "map": {"nist_csf": "ID.RA", "iso27001": "Clause 6.1.2", "soc2": "CC3.2", "pci_dss": "Req 12.3", "gdpr": "Art. 32", "hipaa": "164.308(a)(1)"}},
    {"id": "C05", "title": "Multi-factor authentication for email, admin and remote access", "weight": 3,
     "map": {"nist_csf": "PR.AA", "iso27001": "A.8.5", "soc2": "CC6.1", "pci_dss": "Req 8.4", "hipaa": "164.312(d)"}},
    {"id": "C06", "title": "Joiner-mover-leaver process and quarterly access reviews", "weight": 2,
     "map": {"nist_csf": "PR.AA", "iso27001": "A.5.15, A.5.18", "soc2": "CC6.2, CC6.3", "pci_dss": "Req 7.2", "hipaa": "164.312(a)"}},
    {"id": "C07", "title": "Privileged accounts separated and monitored", "weight": 2,
     "map": {"nist_csf": "PR.AA", "iso27001": "A.8.2", "soc2": "CC6.1", "pci_dss": "Req 7.2, 8.2"}},
    {"id": "C08", "title": "Security awareness training for all staff, with phishing tests", "weight": 2, "auto": "training",
     "map": {"nist_csf": "PR.AT", "iso27001": "A.6.3", "soc2": "CC2.2", "pci_dss": "Req 12.6", "hipaa": "164.308(a)(5)", "dpdp": "Sec. 8(5)"}},
    {"id": "C09", "title": "Anti-malware / EDR on all endpoints", "weight": 2,
     "map": {"nist_csf": "DE.CM", "iso27001": "A.8.7", "soc2": "CC6.8", "pci_dss": "Req 5", "hipaa": "164.308(a)(5)"}},
    {"id": "C10", "title": "Critical patches within 14 days; known-exploited (KEV) flaws first", "weight": 3, "auto": "patching",
     "map": {"nist_csf": "ID.RA, PR.PS", "iso27001": "A.8.8", "soc2": "CC7.1", "pci_dss": "Req 6.3"}},
    {"id": "C11", "title": "Encrypted backups with an offline copy and tested restores", "weight": 3,
     "map": {"nist_csf": "PR.DS, RC.RP", "iso27001": "A.8.13", "soc2": "A1.2", "hipaa": "164.308(a)(7)"}},
    {"id": "C12", "title": "Encryption of data at rest and in transit", "weight": 2,
     "map": {"nist_csf": "PR.DS", "iso27001": "A.8.24", "soc2": "CC6.1, CC6.7", "pci_dss": "Req 3, 4", "gdpr": "Art. 32", "hipaa": "164.312(a)(2)(iv), (e)"}},
    {"id": "C13", "title": "Central logs kept 180 days with synchronised clocks (NTP)", "weight": 2,
     "map": {"nist_csf": "DE.CM", "iso27001": "A.8.15, A.8.16, A.8.17", "soc2": "CC7.2", "pci_dss": "Req 10", "hipaa": "164.312(b)", "certin": "Logs 180 days; NTP sync"}},
    {"id": "C14", "title": "Incident response plan incl. CERT-In 6-hour reporting and breach notification", "weight": 3,
     "map": {"nist_csf": "RS.MA, RS.CO", "iso27001": "A.5.24–A.5.26", "soc2": "CC7.3, CC7.4", "pci_dss": "Req 12.10", "gdpr": "Art. 33", "hipaa": "164.308(a)(6)", "dpdp": "Sec. 8(6)", "certin": "Report within 6 hours"}},
    {"id": "C15", "title": "Supplier security review and contract clauses", "weight": 1,
     "map": {"nist_csf": "GV.SC", "iso27001": "A.5.19–A.5.21", "soc2": "CC9.2", "pci_dss": "Req 12.8", "gdpr": "Art. 28", "hipaa": "164.308(b)"}},
    {"id": "C16", "title": "Personal-data inventory, consent, retention and deletion", "weight": 2,
     "map": {"nist_csf": "PR.DS", "iso27001": "A.5.34", "soc2": "Privacy criteria", "gdpr": "Art. 5, 30", "dpdp": "Sec. 6, 8(7)"}},
    {"id": "C17", "title": "Firewall, network segmentation, secure Wi-Fi, no default passwords", "weight": 2,
     "map": {"nist_csf": "PR.IR", "iso27001": "A.8.20, A.8.22", "soc2": "CC6.6", "pci_dss": "Req 1, 2"}},
    {"id": "C18", "title": "Business continuity and disaster recovery plan tested yearly", "weight": 1,
     "map": {"nist_csf": "RC.RP", "iso27001": "A.5.30", "soc2": "A1.3", "pci_dss": "Req 12.10.1", "hipaa": "164.308(a)(7)"}},
]
CONTROL_BY_ID = {c["id"]: c for c in CONTROLS}

# ------------------------------------------------------------------ CAREER PATHS (for the career agent)
CAREER_PATHS = [
    {"role": "SOC analyst", "steps": ["Networking and Linux basics", "Security fundamentals (CompTIA Security+ level)", "SIEM practice with free tools (Wazuh, Elastic)", "Blue-team labs and CTFs", "Incident response basics"],
     "certs": ["CompTIA Security+", "CompTIA CySA+", "Blue Team Level 1"]},
    {"role": "Governance, risk and compliance (GRC)", "steps": ["Security fundamentals", "ISO 27001 and NIST CSF structure", "Risk assessment practice", "Writing policies and running audits", "Privacy law basics (DPDP, GDPR)"],
     "certs": ["ISO/IEC 27001 Lead Implementer or Lead Auditor", "ISACA CISA", "ISC2 CC then CISSP"]},
    {"role": "Penetration tester", "steps": ["Networking, Linux, scripting (Python/Bash)", "Web security (OWASP Top 10) on legal practice labs", "Network and Active Directory labs", "Report writing", "Only test with written permission"],
     "certs": ["eJPT", "OSCP", "CEH"]},
    {"role": "Cloud security engineer", "steps": ["One cloud platform's fundamentals", "Identity and access management", "Infrastructure as code security", "Logging and detection in the cloud", "Container and Kubernetes security"],
     "certs": ["A cloud provider security specialty", "CCSK", "CCSP"]},
    {"role": "Fraud / financial crime analyst", "steps": ["How payment systems and UPI work", "Common fraud patterns and social engineering", "Data analysis with spreadsheets and SQL", "Investigation and case writing", "AML/KYC basics"],
     "certs": ["ACFE CFE", "ACAMS CAMS"]},
]

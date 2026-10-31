"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGS = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "bn", name: "বাংলা" },
  { code: "mr", name: "मराठी" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "ml", name: "മലയാളം" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "pa", name: "ਪੰਜਾਬੀ" },
  { code: "or", name: "ଓଡ଼ିଆ" },
  { code: "ur", name: "اردو" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];

type Dict = Record<string, string>;

const en: Dict = {
  nav_home: "Check", nav_live: "Live map", nav_learn: "Learn", nav_report: "Report", nav_premium: "Premium",
  nav_account: "Account", nav_login: "Log in", nav_admin: "Admin",
  hero_title: "Is it a scam? Check before you click, pay or reply.",
  hero_sub: "Paste a link, message, phone number, UPI ID or email — or scan a QR code. Free, instant, in your language.",
  check_placeholder: "Paste a link, SMS, WhatsApp message, phone number, UPI ID or email…",
  check_btn: "Check now", check_qr_photo: "QR photo", check_camera: "Scan QR",
  checking: "Checking…", try_examples: "Try:",
  v_malicious: "Dangerous — do not continue", v_suspicious: "Be careful — looks suspicious", v_safe: "No scam signs found",
  v_malicious_tip: "Don't click, pay, scan or share any code. Block the sender.",
  v_suspicious_tip: "Verify through the official app or phone number before you act.",
  v_safe_tip: "Still: never share OTP, UPI PIN or passwords with anyone.",
  why: "Why we think so", checked_by: "Checked by", risk: "Risk", community_reports: "community reports",
  warn_family: "Warn family on WhatsApp", report_this: "Report this scam", share_msg: "⚠️ Scam alert checked on ProblemHunt:",
  recommended: "Recommended protection", sponsored: "Sponsored",
  limit_reached: "Daily free checks used up", upgrade: "Go Premium",
  checks_left: "free checks left today", unlimited: "Unlimited checks (Premium)",
  stat_checks: "Checks today", stat_dangers: "Dangers caught today", stat_reports: "Community scam reports", stat_iocs: "Live threat signals",
  live_alerts: "Live scam alerts", live_alerts_sub: "Real phishing sites and scams being reported right now",
  learn_title: "Scam Academy", learn_sub: "2-minute videos and tips to stay safe",
  all: "All", videos: "Videos", articles: "Articles", tips: "Tips", read_more: "Read more", back: "Back", views: "views",
  help_title: "Got scammed? Act in the golden hour",
  help_1: "Call 1930 — National Cyber Crime Helpline (India)", help_2: "Report at cybercrime.gov.in",
  help_3: "Call your bank: block cards & UPI", help_4: "Change email & banking passwords", help_5: "Save screenshots, numbers and transaction IDs",
  tools_title: "Free safety tools", pw_title: "Has my password leaked?",
  pw_sub: "Checked privately: your password never leaves this device.", pw_btn: "Check password",
  pw_leaked: "Leaked {n} times! Change it everywhere now.", pw_safe: "Not found in known leaks. Good!",
  report_title: "Report a scam", report_sub: "Your report warns everyone who checks the same number, link or UPI ID.",
  r_kind: "What did the scammer use?", r_value: "Number / link / UPI ID / email", r_desc: "What happened?",
  r_amount: "Money lost (optional)", r_city: "City (optional)", r_submit: "Submit report",
  r_thanks: "Thank you! Your report helps protect others.", recent_reports: "Recently reported scams", times: "times",
  premium_title: "Protect yourself and your family", premium_sub: "Unlimited checks, no ads, family alerts and deep scans.",
  per: "for", days: "days", buy_upi: "Pay with UPI / Card (Razorpay)", buy_card: "Pay with Card (Stripe)",
  current_plan: "Your plan", premium_active: "Premium active until", login_to_buy: "Log in to buy",
  login: "Log in", signup: "Create account", email: "Email", password: "Password", name: "Your name", logout: "Log out",
  no_account: "New here?", have_account: "Already have an account?",
  family: "Family protection", family_sub: "Get an alert when a family member checks something dangerous.",
  family_create: "Create family code", family_join: "Join with code", family_code: "Family code", members: "Members",
  alerts_on: "Turn on alerts", alerts_enabled: "Alerts are on", language: "Language",
  footer_note: "ProblemHunt gives safety guidance and is not a bank, police or legal service.",
};

const hi: Dict = {
  nav_home: "जाँचें", nav_live: "लाइव मैप", nav_learn: "सीखें", nav_report: "रिपोर्ट", nav_premium: "प्रीमियम",
  nav_account: "खाता", nav_login: "लॉग इन", nav_admin: "एडमिन",
  hero_title: "कहीं धोखा तो नहीं? क्लिक, पेमेंट या जवाब देने से पहले जाँचें।",
  hero_sub: "लिंक, मैसेज, फ़ोन नंबर, UPI ID या ईमेल डालें — या QR स्कैन करें। मुफ़्त, तुरंत, आपकी भाषा में।",
  check_placeholder: "लिंक, SMS, WhatsApp मैसेज, फ़ोन नंबर, UPI ID या ईमेल यहाँ डालें…",
  check_btn: "अभी जाँचें", check_qr_photo: "QR फ़ोटो", check_camera: "QR स्कैन",
  checking: "जाँच हो रही है…", try_examples: "आज़माएँ:",
  v_malicious: "ख़तरनाक — आगे न बढ़ें", v_suspicious: "सावधान — संदिग्ध लगता है", v_safe: "धोखे के संकेत नहीं मिले",
  v_malicious_tip: "क्लिक, पेमेंट, स्कैन न करें और कोई कोड न बताएँ। भेजने वाले को ब्लॉक करें।",
  v_suspicious_tip: "कुछ भी करने से पहले आधिकारिक ऐप या नंबर से पुष्टि करें।",
  v_safe_tip: "फिर भी: OTP, UPI PIN या पासवर्ड किसी को न बताएँ।",
  why: "हमें ऐसा क्यों लगता है", checked_by: "इनसे जाँचा गया", risk: "जोखिम", community_reports: "लोगों की शिकायतें",
  warn_family: "WhatsApp पर परिवार को सावधान करें", report_this: "इस धोखे की रिपोर्ट करें", share_msg: "⚠️ ProblemHunt पर जाँचा गया धोखा:",
  recommended: "सुझाई गई सुरक्षा", sponsored: "प्रायोजित",
  limit_reached: "आज की मुफ़्त जाँचें खत्म", upgrade: "प्रीमियम लें",
  checks_left: "मुफ़्त जाँचें आज बाकी", unlimited: "असीमित जाँच (प्रीमियम)",
  stat_checks: "आज की जाँचें", stat_dangers: "आज पकड़े गए ख़तरे", stat_reports: "लोगों की शिकायतें", stat_iocs: "लाइव ख़तरे के संकेत",
  live_alerts: "लाइव स्कैम अलर्ट", live_alerts_sub: "अभी रिपोर्ट हो रही असली फ़िशिंग साइटें और धोखे",
  learn_title: "स्कैम अकादमी", learn_sub: "सुरक्षित रहने के लिए 2 मिनट के वीडियो और टिप्स",
  all: "सभी", videos: "वीडियो", articles: "लेख", tips: "टिप्स", read_more: "और पढ़ें", back: "वापस", views: "बार देखा",
  help_title: "ठगी हो गई? पहले घंटे में कदम उठाएँ",
  help_1: "1930 पर कॉल करें — राष्ट्रीय साइबर क्राइम हेल्पलाइन", help_2: "cybercrime.gov.in पर शिकायत करें",
  help_3: "बैंक को कॉल करें: कार्ड और UPI ब्लॉक कराएँ", help_4: "ईमेल और बैंकिंग पासवर्ड बदलें", help_5: "स्क्रीनशॉट, नंबर और ट्रांज़ैक्शन ID सँभालकर रखें",
  tools_title: "मुफ़्त सुरक्षा टूल", pw_title: "क्या मेरा पासवर्ड लीक हुआ है?",
  pw_sub: "निजी जाँच: आपका पासवर्ड इस डिवाइस से बाहर नहीं जाता।", pw_btn: "पासवर्ड जाँचें",
  pw_leaked: "{n} बार लीक हुआ! इसे अभी हर जगह बदलें।", pw_safe: "किसी ज्ञात लीक में नहीं मिला। बढ़िया!",
  report_title: "धोखे की रिपोर्ट करें", report_sub: "आपकी रिपोर्ट उस नंबर, लिंक या UPI ID को जाँचने वाले हर व्यक्ति को सावधान करेगी।",
  r_kind: "ठग ने क्या इस्तेमाल किया?", r_value: "नंबर / लिंक / UPI ID / ईमेल", r_desc: "क्या हुआ?",
  r_amount: "गंवाई रकम (वैकल्पिक)", r_city: "शहर (वैकल्पिक)", r_submit: "रिपोर्ट भेजें",
  r_thanks: "धन्यवाद! आपकी रिपोर्ट दूसरों को बचाएगी।", recent_reports: "हाल में रिपोर्ट हुए धोखे", times: "बार",
  premium_title: "खुद को और परिवार को सुरक्षित रखें", premium_sub: "असीमित जाँच, बिना विज्ञापन, परिवार अलर्ट और गहरी जाँच।",
  per: "के लिए", days: "दिन", buy_upi: "UPI / कार्ड से भुगतान (Razorpay)", buy_card: "कार्ड से भुगतान (Stripe)",
  current_plan: "आपका प्लान", premium_active: "प्रीमियम सक्रिय है, तारीख़ तक", login_to_buy: "खरीदने के लिए लॉग इन करें",
  login: "लॉग इन", signup: "खाता बनाएँ", email: "ईमेल", password: "पासवर्ड", name: "आपका नाम", logout: "लॉग आउट",
  no_account: "नए हैं?", have_account: "पहले से खाता है?",
  family: "परिवार सुरक्षा", family_sub: "जब परिवार का कोई सदस्य कुछ ख़तरनाक जाँचे तो अलर्ट पाएँ।",
  family_create: "परिवार कोड बनाएँ", family_join: "कोड से जुड़ें", family_code: "परिवार कोड", members: "सदस्य",
  alerts_on: "अलर्ट चालू करें", alerts_enabled: "अलर्ट चालू हैं", language: "भाषा",
  footer_note: "ProblemHunt सुरक्षा सलाह देता है; यह बैंक, पुलिस या कानूनी सेवा नहीं है।",
};

const ta: Dict = {
  nav_home: "சரிபார்", nav_live: "நேரடி வரைபடம்", nav_learn: "கற்க", nav_report: "புகார்", nav_premium: "பிரீமியம்",
  nav_account: "கணக்கு", nav_login: "உள்நுழை", nav_admin: "நிர்வாகம்",
  hero_title: "இது மோசடியா? கிளிக், பணம் அல்லது பதில் தருவதற்கு முன் சரிபாருங்கள்.",
  hero_sub: "இணைப்பு, செய்தி, தொலைபேசி எண், UPI ID அல்லது மின்னஞ்சலை ஒட்டவும் — அல்லது QR ஸ்கேன் செய்யவும். இலவசம், உடனடி.",
  check_placeholder: "இணைப்பு, SMS, WhatsApp செய்தி, எண், UPI ID அல்லது மின்னஞ்சலை இங்கே ஒட்டவும்…",
  check_btn: "இப்போது சரிபார்", check_qr_photo: "QR படம்", check_camera: "QR ஸ்கேன்",
  checking: "சரிபார்க்கிறது…", try_examples: "முயற்சிக்க:",
  v_malicious: "ஆபத்தானது — தொடர வேண்டாம்", v_suspicious: "கவனம் — சந்தேகமாக உள்ளது", v_safe: "மோசடி அறிகுறிகள் இல்லை",
  v_malicious_tip: "கிளிக், பணம், ஸ்கேன் செய்யாதீர்கள்; எந்தக் குறியீட்டையும் பகிராதீர்கள். அனுப்பியவரைத் தடுக்கவும்.",
  v_suspicious_tip: "செயல்படுவதற்கு முன் அதிகாரப்பூர்வ ஆப் அல்லது எண் மூலம் உறுதிசெய்யவும்.",
  v_safe_tip: "இருந்தாலும் OTP, UPI PIN, கடவுச்சொல்லை யாரிடமும் பகிர வேண்டாம்.",
  why: "ஏன் இப்படி நினைக்கிறோம்", checked_by: "சரிபார்த்தவை", risk: "அபாயம்", community_reports: "சமூகப் புகார்கள்",
  warn_family: "WhatsApp-ல் குடும்பத்தை எச்சரிக்கவும்", report_this: "இந்த மோசடியைப் புகாரளிக்கவும்", share_msg: "⚠️ ProblemHunt-ல் சரிபார்த்த மோசடி:",
  recommended: "பரிந்துரைக்கப்பட்ட பாதுகாப்பு", sponsored: "விளம்பரம்",
  limit_reached: "இன்றைய இலவச சரிபார்ப்புகள் முடிந்தன", upgrade: "பிரீமியம் பெறுக",
  checks_left: "இன்று மீதமுள்ள இலவச சரிபார்ப்புகள்", unlimited: "வரம்பற்ற சரிபார்ப்பு (பிரீமியம்)",
  stat_checks: "இன்றைய சரிபார்ப்புகள்", stat_dangers: "இன்று பிடிபட்ட ஆபத்துகள்", stat_reports: "சமூக மோசடிப் புகார்கள்", stat_iocs: "நேரடி அச்சுறுத்தல் சமிக்ஞைகள்",
  live_alerts: "நேரடி மோசடி எச்சரிக்கைகள்", live_alerts_sub: "இப்போது புகாரளிக்கப்படும் உண்மையான ஃபிஷிங் தளங்கள்",
  learn_title: "மோசடி அகாடமி", learn_sub: "பாதுகாப்பாக இருக்க 2 நிமிட வீடியோக்கள், குறிப்புகள்",
  all: "அனைத்தும்", videos: "வீடியோக்கள்", articles: "கட்டுரைகள்", tips: "குறிப்புகள்", read_more: "மேலும் படிக்க", back: "பின்செல்", views: "பார்வைகள்",
  help_title: "ஏமாற்றப்பட்டீர்களா? முதல் மணி நேரத்தில் செயல்படுங்கள்",
  help_1: "1930-ஐ அழைக்கவும் — தேசிய சைபர் குற்ற உதவி எண்", help_2: "cybercrime.gov.in-ல் புகாரளிக்கவும்",
  help_3: "வங்கியை அழைத்து கார்டு, UPI-ஐ முடக்கவும்", help_4: "மின்னஞ்சல், வங்கி கடவுச்சொற்களை மாற்றவும்", help_5: "ஸ்கிரீன்ஷாட், எண்கள், பரிவர்த்தனை ID-களைச் சேமிக்கவும்",
  tools_title: "இலவச பாதுகாப்புக் கருவிகள்", pw_title: "என் கடவுச்சொல் கசிந்ததா?",
  pw_sub: "தனிப்பட்ட சரிபார்ப்பு: உங்கள் கடவுச்சொல் இந்த சாதனத்தை விட்டு வெளியேறாது.", pw_btn: "கடவுச்சொல்லைச் சரிபார்",
  pw_leaked: "{n} முறை கசிந்துள்ளது! உடனே எல்லா இடத்திலும் மாற்றவும்.", pw_safe: "தெரிந்த கசிவுகளில் இல்லை. நல்லது!",
  report_title: "மோசடியைப் புகாரளிக்கவும்", report_sub: "உங்கள் புகார் அதே எண், இணைப்பு அல்லது UPI ID-ஐச் சரிபார்க்கும் அனைவரையும் எச்சரிக்கும்.",
  r_kind: "மோசடியாளர் எதைப் பயன்படுத்தினார்?", r_value: "எண் / இணைப்பு / UPI ID / மின்னஞ்சல்", r_desc: "என்ன நடந்தது?",
  r_amount: "இழந்த தொகை (விருப்பம்)", r_city: "நகரம் (விருப்பம்)", r_submit: "புகாரைச் சமர்ப்பி",
  r_thanks: "நன்றி! உங்கள் புகார் மற்றவர்களைப் பாதுகாக்கும்.", recent_reports: "சமீபத்தில் புகாரளிக்கப்பட்ட மோசடிகள்", times: "முறை",
  premium_title: "உங்களையும் குடும்பத்தையும் பாதுகாக்கவும்", premium_sub: "வரம்பற்ற சரிபார்ப்பு, விளம்பரமில்லை, குடும்ப எச்சரிக்கைகள்.",
  per: "க்கு", days: "நாட்கள்", buy_upi: "UPI / கார்டு மூலம் செலுத்து (Razorpay)", buy_card: "கார்டு மூலம் செலுத்து (Stripe)",
  current_plan: "உங்கள் திட்டம்", premium_active: "பிரீமியம் செயலில் உள்ளது, வரை", login_to_buy: "வாங்க உள்நுழையவும்",
  login: "உள்நுழை", signup: "கணக்கை உருவாக்கு", email: "மின்னஞ்சல்", password: "கடவுச்சொல்", name: "உங்கள் பெயர்", logout: "வெளியேறு",
  no_account: "புதியவரா?", have_account: "ஏற்கனவே கணக்கு உள்ளதா?",
  family: "குடும்பப் பாதுகாப்பு", family_sub: "குடும்ப உறுப்பினர் ஆபத்தான ஒன்றைச் சரிபார்த்தால் எச்சரிக்கை பெறுங்கள்.",
  family_create: "குடும்பக் குறியீடு உருவாக்கு", family_join: "குறியீட்டுடன் சேர்", family_code: "குடும்பக் குறியீடு", members: "உறுப்பினர்கள்",
  alerts_on: "எச்சரிக்கைகளை இயக்கு", alerts_enabled: "எச்சரிக்கைகள் இயக்கத்தில்", language: "மொழி",
  footer_note: "ProblemHunt பாதுகாப்பு வழிகாட்டல் மட்டுமே; இது வங்கி, காவல் அல்லது சட்ட சேவை அல்ல.",
};

const te: Dict = {
  nav_home: "తనిఖీ", nav_live: "లైవ్ మ్యాప్", nav_learn: "నేర్చుకోండి", nav_report: "ఫిర్యాదు", nav_premium: "ప్రీమియం",
  nav_account: "ఖాతా", nav_login: "లాగిన్", nav_admin: "అడ్మిన్",
  hero_title: "ఇది మోసమా? క్లిక్, చెల్లింపు లేదా జవాబు ముందు తనిఖీ చేయండి.",
  hero_sub: "లింక్, మెసేజ్, ఫోన్ నంబర్, UPI ID లేదా ఈమెయిల్ అతికించండి — లేదా QR స్కాన్ చేయండి. ఉచితం, తక్షణం.",
  check_placeholder: "లింక్, SMS, WhatsApp మెసేజ్, నంబర్, UPI ID లేదా ఈమెయిల్ ఇక్కడ అతికించండి…",
  check_btn: "ఇప్పుడే తనిఖీ", check_qr_photo: "QR ఫోటో", check_camera: "QR స్కాన్",
  checking: "తనిఖీ చేస్తోంది…", try_examples: "ప్రయత్నించండి:",
  v_malicious: "ప్రమాదకరం — కొనసాగవద్దు", v_suspicious: "జాగ్రత్త — అనుమానాస్పదంగా ఉంది", v_safe: "మోసపు సంకేతాలు లేవు",
  v_malicious_tip: "క్లిక్, చెల్లింపు, స్కాన్ చేయవద్దు; ఏ కోడ్‌నూ పంచుకోవద్దు. పంపినవారిని బ్లాక్ చేయండి.",
  v_suspicious_tip: "చర్య తీసుకునే ముందు అధికారిక యాప్ లేదా నంబర్ ద్వారా నిర్ధారించుకోండి.",
  v_safe_tip: "అయినా OTP, UPI PIN, పాస్‌వర్డ్‌ను ఎవరితోనూ పంచుకోవద్దు.",
  why: "ఎందుకు అలా అనుకుంటున్నాం", checked_by: "తనిఖీ చేసినవి", risk: "ప్రమాదం", community_reports: "ప్రజల ఫిర్యాదులు",
  warn_family: "WhatsAppలో కుటుంబాన్ని హెచ్చరించండి", report_this: "ఈ మోసాన్ని ఫిర్యాదు చేయండి", share_msg: "⚠️ ProblemHuntలో తనిఖీ చేసిన మోసం:",
  recommended: "సిఫార్సు చేసిన రక్షణ", sponsored: "ప్రాయోజితం",
  limit_reached: "ఈరోజు ఉచిత తనిఖీలు అయిపోయాయి", upgrade: "ప్రీమియం తీసుకోండి",
  checks_left: "ఈరోజు మిగిలిన ఉచిత తనిఖీలు", unlimited: "అపరిమిత తనిఖీలు (ప్రీమియం)",
  stat_checks: "ఈరోజు తనిఖీలు", stat_dangers: "ఈరోజు పట్టుకున్న ప్రమాదాలు", stat_reports: "ప్రజల మోసపు ఫిర్యాదులు", stat_iocs: "లైవ్ ముప్పు సంకేతాలు",
  live_alerts: "లైవ్ మోసపు హెచ్చరికలు", live_alerts_sub: "ఇప్పుడు నివేదించబడుతున్న నిజమైన ఫిషింగ్ సైట్లు",
  learn_title: "స్కామ్ అకాడమీ", learn_sub: "సురక్షితంగా ఉండటానికి 2 నిమిషాల వీడియోలు, చిట్కాలు",
  all: "అన్నీ", videos: "వీడియోలు", articles: "వ్యాసాలు", tips: "చిట్కాలు", read_more: "ఇంకా చదవండి", back: "వెనక్కి", views: "వీక్షణలు",
  help_title: "మోసపోయారా? మొదటి గంటలోనే చర్య తీసుకోండి",
  help_1: "1930కి కాల్ చేయండి — జాతీయ సైబర్ క్రైమ్ హెల్ప్‌లైన్", help_2: "cybercrime.gov.inలో ఫిర్యాదు చేయండి",
  help_3: "బ్యాంకుకు కాల్ చేసి కార్డ్, UPI బ్లాక్ చేయించండి", help_4: "ఈమెయిల్, బ్యాంకింగ్ పాస్‌వర్డ్‌లు మార్చండి", help_5: "స్క్రీన్‌షాట్లు, నంబర్లు, లావాదేవీ IDలు దాచుకోండి",
  tools_title: "ఉచిత భద్రతా సాధనాలు", pw_title: "నా పాస్‌వర్డ్ లీక్ అయిందా?",
  pw_sub: "ప్రైవేట్ తనిఖీ: మీ పాస్‌వర్డ్ ఈ పరికరం దాటి వెళ్లదు.", pw_btn: "పాస్‌వర్డ్ తనిఖీ",
  pw_leaked: "{n} సార్లు లీక్ అయింది! వెంటనే అన్నిచోట్లా మార్చండి.", pw_safe: "తెలిసిన లీక్‌లలో లేదు. బాగుంది!",
  report_title: "మోసాన్ని ఫిర్యాదు చేయండి", report_sub: "మీ ఫిర్యాదు అదే నంబర్, లింక్ లేదా UPI IDని తనిఖీ చేసే అందరినీ హెచ్చరిస్తుంది.",
  r_kind: "మోసగాడు ఏమి ఉపయోగించాడు?", r_value: "నంబర్ / లింక్ / UPI ID / ఈమెయిల్", r_desc: "ఏమి జరిగింది?",
  r_amount: "కోల్పోయిన మొత్తం (ఐచ్ఛికం)", r_city: "నగరం (ఐచ్ఛికం)", r_submit: "ఫిర్యాదు పంపండి",
  r_thanks: "ధన్యవాదాలు! మీ ఫిర్యాదు ఇతరులను కాపాడుతుంది.", recent_reports: "ఇటీవల నివేదించిన మోసాలు", times: "సార్లు",
  premium_title: "మిమ్మల్ని, మీ కుటుంబాన్ని రక్షించుకోండి", premium_sub: "అపరిమిత తనిఖీలు, ప్రకటనలు లేవు, కుటుంబ హెచ్చరికలు.",
  per: "కి", days: "రోజులు", buy_upi: "UPI / కార్డ్‌తో చెల్లించండి (Razorpay)", buy_card: "కార్డ్‌తో చెల్లించండి (Stripe)",
  current_plan: "మీ ప్లాన్", premium_active: "ప్రీమియం యాక్టివ్, వరకు", login_to_buy: "కొనడానికి లాగిన్ అవ్వండి",
  login: "లాగిన్", signup: "ఖాతా సృష్టించండి", email: "ఈమెయిల్", password: "పాస్‌వర్డ్", name: "మీ పేరు", logout: "లాగౌట్",
  no_account: "కొత్తవారా?", have_account: "ఇప్పటికే ఖాతా ఉందా?",
  family: "కుటుంబ రక్షణ", family_sub: "కుటుంబ సభ్యుడు ప్రమాదకరమైనది తనిఖీ చేస్తే హెచ్చరిక పొందండి.",
  family_create: "కుటుంబ కోడ్ సృష్టించండి", family_join: "కోడ్‌తో చేరండి", family_code: "కుటుంబ కోడ్", members: "సభ్యులు",
  alerts_on: "హెచ్చరికలు ఆన్ చేయండి", alerts_enabled: "హెచ్చరికలు ఆన్‌లో ఉన్నాయి", language: "భాష",
  footer_note: "ProblemHunt భద్రతా మార్గదర్శనం మాత్రమే; ఇది బ్యాంక్, పోలీస్ లేదా న్యాయ సేవ కాదు.",
};

const bn: Dict = {
  nav_home: "যাচাই", nav_live: "লাইভ ম্যাপ", nav_learn: "শিখুন", nav_report: "রিপোর্ট", nav_premium: "প্রিমিয়াম",
  nav_account: "অ্যাকাউন্ট", nav_login: "লগ ইন", nav_admin: "অ্যাডমিন",
  hero_title: "এটা কি প্রতারণা? ক্লিক, পেমেন্ট বা উত্তর দেওয়ার আগে যাচাই করুন।",
  hero_sub: "লিঙ্ক, মেসেজ, ফোন নম্বর, UPI ID বা ইমেল পেস্ট করুন — বা QR স্ক্যান করুন। বিনামূল্যে, তাৎক্ষণিক।",
  check_placeholder: "লিঙ্ক, SMS, WhatsApp মেসেজ, নম্বর, UPI ID বা ইমেল এখানে পেস্ট করুন…",
  check_btn: "এখনই যাচাই", check_qr_photo: "QR ছবি", check_camera: "QR স্ক্যান",
  checking: "যাচাই হচ্ছে…", try_examples: "চেষ্টা করুন:",
  v_malicious: "বিপজ্জনক — এগোবেন না", v_suspicious: "সাবধান — সন্দেহজনক", v_safe: "প্রতারণার চিহ্ন পাওয়া যায়নি",
  v_malicious_tip: "ক্লিক, পেমেন্ট, স্ক্যান করবেন না; কোনো কোড শেয়ার করবেন না। প্রেরককে ব্লক করুন।",
  v_suspicious_tip: "কিছু করার আগে অফিসিয়াল অ্যাপ বা নম্বরে যাচাই করুন।",
  v_safe_tip: "তবুও OTP, UPI PIN বা পাসওয়ার্ড কাউকে বলবেন না।",
  why: "কেন আমরা এমন মনে করি", checked_by: "যাচাই করেছে", risk: "ঝুঁকি", community_reports: "মানুষের অভিযোগ",
  warn_family: "WhatsApp-এ পরিবারকে সতর্ক করুন", report_this: "এই প্রতারণা রিপোর্ট করুন", share_msg: "⚠️ ProblemHunt-এ যাচাই করা প্রতারণা:",
  recommended: "প্রস্তাবিত সুরক্ষা", sponsored: "স্পনসরড",
  limit_reached: "আজকের বিনামূল্যে যাচাই শেষ", upgrade: "প্রিমিয়াম নিন",
  checks_left: "আজ বাকি বিনামূল্যে যাচাই", unlimited: "অসীম যাচাই (প্রিমিয়াম)",
  stat_checks: "আজকের যাচাই", stat_dangers: "আজ ধরা পড়া বিপদ", stat_reports: "মানুষের প্রতারণা রিপোর্ট", stat_iocs: "লাইভ হুমকি সংকেত",
  live_alerts: "লাইভ প্রতারণা সতর্কতা", live_alerts_sub: "এখন রিপোর্ট হওয়া আসল ফিশিং সাইট ও প্রতারণা",
  learn_title: "স্ক্যাম অ্যাকাডেমি", learn_sub: "নিরাপদ থাকতে ২ মিনিটের ভিডিও ও টিপস",
  all: "সব", videos: "ভিডিও", articles: "লেখা", tips: "টিপস", read_more: "আরও পড়ুন", back: "ফিরে যান", views: "বার দেখা",
  help_title: "প্রতারিত হয়েছেন? প্রথম ঘণ্টায় পদক্ষেপ নিন",
  help_1: "1930-এ কল করুন — জাতীয় সাইবার ক্রাইম হেল্পলাইন", help_2: "cybercrime.gov.in-এ অভিযোগ করুন",
  help_3: "ব্যাঙ্কে কল করে কার্ড ও UPI ব্লক করুন", help_4: "ইমেল ও ব্যাঙ্কিং পাসওয়ার্ড বদলান", help_5: "স্ক্রিনশট, নম্বর ও লেনদেন ID রাখুন",
  tools_title: "বিনামূল্যে নিরাপত্তা টুল", pw_title: "আমার পাসওয়ার্ড কি ফাঁস হয়েছে?",
  pw_sub: "গোপন যাচাই: আপনার পাসওয়ার্ড এই ডিভাইসের বাইরে যায় না।", pw_btn: "পাসওয়ার্ড যাচাই",
  pw_leaked: "{n} বার ফাঁস হয়েছে! এখনই সব জায়গায় বদলান।", pw_safe: "জানা ফাঁসে পাওয়া যায়নি। ভালো!",
  report_title: "প্রতারণা রিপোর্ট করুন", report_sub: "আপনার রিপোর্ট একই নম্বর, লিঙ্ক বা UPI ID যাচাইকারী সবাইকে সতর্ক করবে।",
  r_kind: "প্রতারক কী ব্যবহার করেছে?", r_value: "নম্বর / লিঙ্ক / UPI ID / ইমেল", r_desc: "কী হয়েছিল?",
  r_amount: "হারানো টাকা (ঐচ্ছিক)", r_city: "শহর (ঐচ্ছিক)", r_submit: "রিপোর্ট পাঠান",
  r_thanks: "ধন্যবাদ! আপনার রিপোর্ট অন্যদের রক্ষা করবে।", recent_reports: "সম্প্রতি রিপোর্ট হওয়া প্রতারণা", times: "বার",
  premium_title: "নিজেকে ও পরিবারকে সুরক্ষিত রাখুন", premium_sub: "অসীম যাচাই, বিজ্ঞাপন নেই, পরিবারের সতর্কতা।",
  per: "জন্য", days: "দিন", buy_upi: "UPI / কার্ডে পেমেন্ট (Razorpay)", buy_card: "কার্ডে পেমেন্ট (Stripe)",
  current_plan: "আপনার প্ল্যান", premium_active: "প্রিমিয়াম সক্রিয়, পর্যন্ত", login_to_buy: "কিনতে লগ ইন করুন",
  login: "লগ ইন", signup: "অ্যাকাউন্ট খুলুন", email: "ইমেল", password: "পাসওয়ার্ড", name: "আপনার নাম", logout: "লগ আউট",
  no_account: "নতুন?", have_account: "আগে থেকেই অ্যাকাউন্ট আছে?",
  family: "পরিবার সুরক্ষা", family_sub: "পরিবারের কেউ বিপজ্জনক কিছু যাচাই করলে সতর্কতা পান।",
  family_create: "পরিবার কোড তৈরি করুন", family_join: "কোড দিয়ে যোগ দিন", family_code: "পরিবার কোড", members: "সদস্য",
  alerts_on: "সতর্কতা চালু করুন", alerts_enabled: "সতর্কতা চালু আছে", language: "ভাষা",
  footer_note: "ProblemHunt নিরাপত্তা পরামর্শ দেয়; এটি ব্যাঙ্ক, পুলিশ বা আইনি পরিষেবা নয়।",
};

const mr: Dict = {
  nav_home: "तपासा", nav_live: "लाइव्ह नकाशा", nav_learn: "शिका", nav_report: "तक्रार", nav_premium: "प्रीमियम",
  nav_account: "खाते", nav_login: "लॉग इन", nav_admin: "ॲडमिन",
  hero_title: "ही फसवणूक आहे का? क्लिक, पेमेंट किंवा उत्तर देण्यापूर्वी तपासा.",
  hero_sub: "लिंक, मेसेज, फोन नंबर, UPI ID किंवा ईमेल टाका — किंवा QR स्कॅन करा. मोफत, लगेच, तुमच्या भाषेत.",
  check_placeholder: "लिंक, SMS, WhatsApp मेसेज, नंबर, UPI ID किंवा ईमेल इथे टाका…",
  check_btn: "आत्ताच तपासा", check_qr_photo: "QR फोटो", check_camera: "QR स्कॅन",
  checking: "तपासत आहे…", try_examples: "करून पहा:",
  v_malicious: "धोकादायक — पुढे जाऊ नका", v_suspicious: "सावधान — संशयास्पद वाटते", v_safe: "फसवणुकीची चिन्हे आढळली नाहीत",
  v_malicious_tip: "क्लिक, पेमेंट, स्कॅन करू नका; कोणताही कोड सांगू नका. पाठवणाऱ्याला ब्लॉक करा.",
  v_suspicious_tip: "काहीही करण्यापूर्वी अधिकृत ॲप किंवा नंबरवरून खात्री करा.",
  v_safe_tip: "तरीही OTP, UPI PIN किंवा पासवर्ड कोणालाही सांगू नका.",
  why: "आम्हाला असे का वाटते", checked_by: "यांनी तपासले", risk: "धोका", community_reports: "लोकांच्या तक्रारी",
  warn_family: "WhatsApp वर कुटुंबाला सावध करा", report_this: "या फसवणुकीची तक्रार करा", share_msg: "⚠️ ProblemHunt वर तपासलेली फसवणूक:",
  recommended: "सुचवलेली सुरक्षा", sponsored: "प्रायोजित",
  limit_reached: "आजच्या मोफत तपासण्या संपल्या", upgrade: "प्रीमियम घ्या",
  checks_left: "आज उरलेल्या मोफत तपासण्या", unlimited: "अमर्याद तपासण्या (प्रीमियम)",
  stat_checks: "आजच्या तपासण्या", stat_dangers: "आज पकडलेले धोके", stat_reports: "लोकांच्या फसवणूक तक्रारी", stat_iocs: "लाइव्ह धोक्याचे संकेत",
  live_alerts: "लाइव्ह फसवणूक इशारे", live_alerts_sub: "आत्ता नोंदवल्या जाणाऱ्या खऱ्या फिशिंग साइट्स",
  learn_title: "स्कॅम अकादमी", learn_sub: "सुरक्षित राहण्यासाठी 2 मिनिटांचे व्हिडिओ आणि टिप्स",
  all: "सर्व", videos: "व्हिडिओ", articles: "लेख", tips: "टिप्स", read_more: "अधिक वाचा", back: "मागे", views: "वेळा पाहिले",
  help_title: "फसवणूक झाली? पहिल्या तासात हे करा",
  help_1: "1930 वर कॉल करा — राष्ट्रीय सायबर क्राइम हेल्पलाइन", help_2: "cybercrime.gov.in वर तक्रार करा",
  help_3: "बँकेला कॉल करून कार्ड व UPI ब्लॉक करा", help_4: "ईमेल व बँकिंग पासवर्ड बदला", help_5: "स्क्रीनशॉट, नंबर व व्यवहार ID जपून ठेवा",
  tools_title: "मोफत सुरक्षा साधने", pw_title: "माझा पासवर्ड लीक झाला आहे का?",
  pw_sub: "खाजगी तपासणी: तुमचा पासवर्ड या डिव्हाइसबाहेर जात नाही.", pw_btn: "पासवर्ड तपासा",
  pw_leaked: "{n} वेळा लीक झाला! लगेच सगळीकडे बदला.", pw_safe: "ज्ञात लीकमध्ये आढळला नाही. छान!",
  report_title: "फसवणुकीची तक्रार करा", report_sub: "तुमची तक्रार तोच नंबर, लिंक किंवा UPI ID तपासणाऱ्या प्रत्येकाला सावध करेल.",
  r_kind: "फसवणूक करणाऱ्याने काय वापरले?", r_value: "नंबर / लिंक / UPI ID / ईमेल", r_desc: "काय घडले?",
  r_amount: "गमावलेली रक्कम (ऐच्छिक)", r_city: "शहर (ऐच्छिक)", r_submit: "तक्रार पाठवा",
  r_thanks: "धन्यवाद! तुमची तक्रार इतरांना वाचवेल.", recent_reports: "अलीकडे नोंदवलेल्या फसवणुका", times: "वेळा",
  premium_title: "स्वतःला आणि कुटुंबाला सुरक्षित ठेवा", premium_sub: "अमर्याद तपासण्या, जाहिराती नाहीत, कुटुंब इशारे.",
  per: "साठी", days: "दिवस", buy_upi: "UPI / कार्डने पेमेंट (Razorpay)", buy_card: "कार्डने पेमेंट (Stripe)",
  current_plan: "तुमचा प्लॅन", premium_active: "प्रीमियम सक्रिय, पर्यंत", login_to_buy: "खरेदीसाठी लॉग इन करा",
  login: "लॉग इन", signup: "खाते तयार करा", email: "ईमेल", password: "पासवर्ड", name: "तुमचे नाव", logout: "लॉग आउट",
  no_account: "नवीन आहात?", have_account: "आधीच खाते आहे?",
  family: "कुटुंब सुरक्षा", family_sub: "कुटुंबातील कोणी धोकादायक काही तपासले तर इशारा मिळवा.",
  family_create: "कुटुंब कोड तयार करा", family_join: "कोडने सामील व्हा", family_code: "कुटुंब कोड", members: "सदस्य",
  alerts_on: "इशारे सुरू करा", alerts_enabled: "इशारे सुरू आहेत", language: "भाषा",
  footer_note: "ProblemHunt सुरक्षा मार्गदर्शन देते; ही बँक, पोलीस किंवा कायदेशीर सेवा नाही.",
};

import { EXTRA, NEW_LANGS } from "./i18n2";
import { EXTRA3 } from "./i18n3";
import { EXTRA4 } from "./i18n4";

const BASE: Record<string, Dict> = { en, hi, ta, te, bn, mr, ...NEW_LANGS };
const DICTS = Object.fromEntries(
  LANGS.map(({ code }) => [code, { ...(BASE[code] || {}), ...(EXTRA[code] || {}), ...(EXTRA3[code] || {}), ...(EXTRA4[code] || {}) }]),
) as Record<Lang, Dict>;
const EN = DICTS.en;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string }>({
  lang: "en", setLang: () => {}, t: (k) => EN[k] ?? k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ph_lang") as Lang | null;
      if (saved && saved in DICTS) setLangState(saved);
      else {
        const nav = navigator.language.slice(0, 2) as Lang;
        if (nav in DICTS) setLangState(nav);
      }
    } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "ur" ? "rtl" : "ltr"; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("ph_lang", l); } catch {}
  }, []);
  const t = useCallback((k: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang]?.[k] ?? EN[k] ?? k;
    if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv));
    return s;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

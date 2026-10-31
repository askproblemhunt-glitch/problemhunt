// v5 navigation labels (new pages). Page content for the enterprise pages is English; Hindi labels included.
type Dict = Record<string, string>;
const T: Record<string, [string, string, string, string]> = {
  //      intel                AI                 courses            workplace
  en: ["Intel", "AI assistant", "Courses", "Workplace"],
  hi: ["इंटेल", "AI सहायक", "कोर्स", "वर्कप्लेस"],
  mr: ["इंटेल", "AI सहाय्यक", "कोर्स", "वर्कप्लेस"],
  ta: ["நுண்ணறிவு", "AI உதவியாளர்", "பாடங்கள்", "பணியிடம்"],
  te: ["ఇంటెల్", "AI సహాయకుడు", "కోర్సులు", "వర్క్‌ప్లేస్"],
  bn: ["ইন্টেল", "AI সহকারী", "কোর্স", "ওয়ার্কপ্লেস"],
  kn: ["ಇಂಟೆಲ್", "AI ಸಹಾಯಕ", "ಕೋರ್ಸ್‌ಗಳು", "ವರ್ಕ್‌ಪ್ಲೇಸ್"],
  ml: ["ഇന്റൽ", "AI സഹായി", "കോഴ്സുകൾ", "വർക്ക്‌പ്ലേസ്"],
  gu: ["ઇન્ટેલ", "AI સહાયક", "કોર્સ", "વર્કપ્લેસ"],
  pa: ["ਇੰਟੈੱਲ", "AI ਸਹਾਇਕ", "ਕੋਰਸ", "ਵਰਕਪਲੇਸ"],
  or: ["ଇଣ୍ଟେଲ", "AI ସହାୟକ", "ପାଠ୍ୟକ୍ରମ", "ୱର୍କପ୍ଲେସ"],
  ur: ["انٹیل", "AI معاون", "کورسز", "ورک پلیس"],
};
export const EXTRA4: Record<string, Dict> = Object.fromEntries(
  Object.entries(T).map(([k, [a, b, c, d]]) => [k, { nav_intel: a, nav_ai: b, nav_courses: c, nav_org: d }]),
);

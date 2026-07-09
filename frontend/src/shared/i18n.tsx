import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Globe, ChevronRight } from 'lucide-react';

export type Lang = 'en' | 'am' | 'om';

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',      flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ',        flag: '🇪🇹' },
  { code: 'om', label: 'Afaan Oromoo', flag: '🇪🇹' },
];

// ── Full translation dictionary ───────────────────────────────────────────────
export const translations = {
  en: {
    // Nav
    navHome: 'Home',
    navAbout: 'About Us',
    navServices: 'Services',
    navProducts: 'Our Products',
    navHealthTips: 'Health Tips',
    navContact: 'Contact',
    staffLogin: 'Staff Login',

    // Top bar
    hours: 'Mon–Sat 7:30AM – 9PM',
    location: 'Jimma, Ethiopia',

    // Hero
    heroBadge: "Jimma's Trusted Pharmacy",
    heroH1Line1: 'Your Health,',
    heroH1Line2: 'Our Commitment',
    heroDesc: 'Providing quality medications, professional consultations, and personalized care — serving the people of Jimma and surrounding communities since 2018.',
    heroServices: 'Our Services',
    heroContact: 'Get in Touch',
    heroSearch: 'Search medicines, services...',

    // Why Choose
    whyTitle: 'Why Choose Imana?',
    why1: 'Genuine, certified medications only',
    why2: 'Licensed pharmacist on duty every day',
    why3: 'Home delivery across Jimma zone',
    why4: 'Fast prescription refill service',
    why5: 'Open 7 days including public holidays',
    contactUsToday: 'Contact Us Today',

    // Stats
    statYears: 'Years Serving Jimma',
    statCustomers: 'Happy Customers',
    statSatisfaction: 'Customer Satisfaction',

    // Features strip
    feat1Title: 'Home Delivery',
    feat1Desc: 'We deliver your medications and health products safely to your door across Jimma and surrounding areas.',
    feat2Title: 'Prescription Refill',
    feat2Desc: 'Bring or send your prescription and our pharmacists will have your medication ready within the hour.',
    feat3Title: 'Pharmacist Consultation',
    feat3Desc: 'Speak with our licensed and experienced pharmacists in person or by phone — no appointment needed.',
    feat4Title: '100% Authentic Products',
    feat4Desc: 'Every product on our shelves is sourced directly from certified manufacturers and licensed distributors.',

    // About
    aboutLabel: 'About Imana Pharmacy',
    aboutH2: 'Health Care You Can\nTrust in Jimma',
    aboutP1: 'Founded in 2018, Imana Pharmacy has grown to become one of Jimma\'s most respected healthcare destinations. We stock a comprehensive range of medicines, vitamins, medical devices, and wellness products — all verified authentic.',
    aboutP2: 'Our team of licensed pharmacists is dedicated to providing personalized guidance to every patient who walks through our doors. We believe that access to quality healthcare advice should not be a privilege.',
    badge1Title: 'Licensed Pharmacists',
    badge1Sub: 'All staff certified by EFDA',
    badge2Title: 'Full Stock',
    badge2Sub: '5,000+ products available',
    badge3Title: 'Open 7 Days',
    badge3Sub: 'Including public holidays',
    badge4Title: 'Community First',
    badge4Sub: 'Serving Jimma zone since 2018',
    yearsServing: 'Years Serving\nJimma',

    // Categories
    catLabel: 'What We Carry',
    catH2: 'Our Product Categories',
    cat1: 'Prescription Drugs',
    cat2: 'Vitamins & Supplements',
    cat3: 'Personal Care',
    cat4: 'Mother & Baby',
    cat5: 'Medical Devices',
    cat6: 'Dermocosmetics',

    // Services section
    svcLabel: 'What We Offer',
    svcH2: 'Pharmacy Services',
    svcDesc: 'Beyond dispensing medicines, we provide a range of services designed to support your entire health journey.',

    // Products section
    prodLabel: 'In Stock',
    prodH2: 'Selected Products',
    prodSub: 'A glimpse of what you will find at',
    prodAvail: 'Ask us about availability',
    prodVisit: 'Visit us or call to check availability.',

    // Health Tips
    tipsLabel: 'Health Tips',
    tipsH2: 'From Our Pharmacists',
    tipsAll: 'All Articles',
    tip1Title: 'Eating for Energy: What Our Pharmacists Recommend',
    tip2Title: 'How Regular Exercise Supports Medication Effectiveness',
    tip3Title: 'Dry Skin in the Ethiopian Climate: Prevention & Care',

    // Prescription CTA
    rxBadge: 'Prescription Service',
    rxH2: 'Have a Prescription?\nWe Are Ready for You.',
    rxDesc: 'Bring your prescription to our store or call ahead — our pharmacists will prepare your medication and answer all your questions.',
    rxCall: 'Call',
    rxFind: 'Find Our Location',

    // Testimonials
    testLabel: 'Testimonials',
    testH2: 'Trusted by Our Community',
    test1: '"Imana Pharmacy has completely changed how my family manages health. The staff are knowledgeable, kind, and always have what we need."',
    test1Name: 'Fatuma Abdella',
    test1Role: 'Regular Patient',
    test2: '"I have trusted Imana for my blood pressure medications for two years. The prescription service is fast and the advice is always reliable."',
    test2Name: 'Girma Bekele',
    test2Role: 'Hypertension Patient',
    test3: '"The mother and baby section is excellent. The pharmacist guided me through everything I needed during my pregnancy. Truly wonderful service."',
    test3Name: 'Meron Haile',
    test3Role: 'New Mother',

    // Footer
    footerDesc: 'Providing modern pharmaceutical care, professional advice, and high-quality products to the community of Jimma since 2018.',
    quickLinks: 'Quick Links',
    ourServices: 'Our Services',
    contactDetails: 'Contact Details',
    staffLoginPortal: 'Staff Login Portal',
    footerSvc1: 'Home Delivery',
    footerSvc2: 'Prescription Refill',
    footerSvc3: 'Pharmacist Consultation',
    footerSvc4: 'Authentic Products',
    footerSvc5: 'Medical Devices',
    allRights: 'All Rights Reserved.',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    support: 'Support',
  },

  am: {
    navHome: 'ዋና ገጽ',
    navAbout: 'ስለ እኛ',
    navServices: 'አገልግሎቶች',
    navProducts: 'ምርቶቻችን',
    navHealthTips: 'የጤና ምክሮች',
    navContact: 'አድራሻ',
    staffLogin: 'የሰራተኞች መግቢያ',

    hours: 'ሰኞ–ቅዳሜ 7:30AM – 9PM',
    location: 'ጅማ፣ ኢትዮጵያ',

    heroBadge: 'በጅማ የሚታመን ፋርማሲ',
    heroH1Line1: 'ጤናዎ፣',
    heroH1Line2: 'የእኛ ቁርጠኝነት',
    heroDesc: 'ጥራት ያለው ሕክምና፣ ሙያዊ ምክሮች እና ግለሰባዊ እንክብካቤ እናቀርባለን — ከ2018 ጀምሮ ጅማን እና አካባቢዎቿን እናገለግላለን።',
    heroServices: 'አገልግሎቶቻችን',
    heroContact: 'ያነጋግሩን',
    heroSearch: 'መድሃኒቶች፣ አገልግሎቶች ይፈልጉ...',

    whyTitle: 'ለምን ኢማና?',
    why1: 'ተረጋግጠው የተፈቀዱ መድሃኒቶች ብቻ',
    why2: 'በየቀኑ ፈቃድ ያለው ፋርማሲስት',
    why3: 'ሙሉ የጅማ ዞን ቤት ደረሰ',
    why4: 'ፈጣን የሀኪም ትዕዛዝ አገልግሎት',
    why5: 'ሳምንቱን ሙሉ ሰባቱም ቀናት ክፍት',
    contactUsToday: 'ዛሬ ያግኙን',

    statYears: 'ጅማን ያገለገሉ ዓመታት',
    statCustomers: 'ደስተኛ ደንበኞች',
    statSatisfaction: 'የደንበኛ እርካታ',

    feat1Title: 'ቤት ድረስ ማድረስ',
    feat1Desc: 'መድሃኒቶቻዎን እና የጤና ምርቶቻዎን ወደ ቤትዎ አስተማማኝ ሆኖ እናደርሳለን።',
    feat2Title: 'የሀኪም ትዕዛዝ ዝግጅት',
    feat2Desc: 'ሀኪም ትዕዛዝዎን ያምጡ ወይም ይላኩ — ፋርማሲስቶቻችን ሰዓቱን ጠብቀው ይዘጋጃሉ።',
    feat3Title: 'የፋርማሲስት ምክር',
    feat3Desc: 'ፈቃድ ካላቸው ፋርማሲስቶቻችን ጋር ሰው ለሰው ወይም በስልክ ይነጋገሩ — ቀጠሮ አያስፈልግም።',
    feat4Title: '100% ዋስትና ያለው ምርት',
    feat4Desc: 'ሁሉም ምርቶቻችን ቀጥታ ከተረጋገጡ አምራቾችና ፈቃድ ካላቸው አቅራቢዎች ነው።',

    aboutLabel: 'ስለ ኢማና ፋርማሲ',
    aboutH2: 'በጅማ ሊታመን\nየሚችል ጤና አገልግሎት',
    aboutP1: 'ኢማና ፋርማሲ በ2018 ተቋቁሞ ከጅማ በጣም ታዋቂ የጤና ተቋሞች አንዱ ሆኗል። ሁሉም ትክክለኛ ተደርጎ የተረጋገጠ ሙሉ ዓይነት ሕክምና፣ ቫይታሚኖች፣ የህክምና መሳሪያዎች እና የጤና ምርቶች አሉን።',
    aboutP2: 'ፈቃድ ያለን ፋርማሲስቶቻችን ቡድን ለሚጎበኙን ሁሉ ግለሰባዊ መመሪያ ለመስጠት ቁርጠኞች ናቸው። የጥራት ጤና ምክር ቅድሚያ ሊሆን አይገባም ብለን እናምናለን።',
    badge1Title: 'ፈቃድ ያላቸው ፋርማሲስቶች',
    badge1Sub: 'ሁሉም ሰራተኞች በEFDA የተፈቀዱ',
    badge2Title: 'ሙሉ ክምችት',
    badge2Sub: '5,000+ ምርቶች ይገኛሉ',
    badge3Title: 'ሰባቱም ቀናት ክፍት',
    badge3Sub: 'ሕዝባዊ አከባቦርን ጨምሮ',
    badge4Title: 'ማህበረሰብ ቅድሚያ',
    badge4Sub: 'ከ2018 ጀምሮ ጅማን ያገለግላሉ',
    yearsServing: 'ጅማን ያገለገሉ\nዓመታት',

    catLabel: 'የምናቀርበው',
    catH2: 'የምርት ምድቦቻችን',
    cat1: 'የሀኪም ትዕዛዝ መድሃኒቶች',
    cat2: 'ቫይታሚኖችና ሰፕሊሜንቶች',
    cat3: 'የግል እንክብካቤ',
    cat4: 'እናት እና ሕፃን',
    cat5: 'የህክምና መሳሪያዎች',
    cat6: 'ደርሞኮስሜቲክስ',

    svcLabel: 'የምናቀርበው',
    svcH2: 'የፋርማሲ አገልግሎቶች',
    svcDesc: 'ከመድሃኒት ማቅረብ ባሻገር ለጤና ጉዞዎ ሙሉ ድጋፍ ለመስጠት የተዘጋጁ አገልግሎቶች አሉን።',

    prodLabel: 'በክምችት',
    prodH2: 'ተመርጠው የቀረቡ ምርቶች',
    prodSub: 'ከ',
    prodAvail: 'ተገኝነት ይጠይቁን',
    prodVisit: 'ይጎብኙን ወይም ደውለው ተገኝነት ያረጋግጡ።',

    tipsLabel: 'የጤና ምክሮች',
    tipsH2: 'ከፋርማሲስቶቻችን',
    tipsAll: 'ሁሉም ጽሁፎች',
    tip1Title: 'ለጉልበት መብላት: ፋርማሲስቶቻችን ምን ይመክራሉ?',
    tip2Title: 'መደበኛ ስፖርት ሕክምናን እንዴት ይደግፋል',
    tip3Title: 'በኢትዮጵያ ሙቀት ደረቅ ቆዳ: መከላከልና እንክብካቤ',

    rxBadge: 'የሀኪም ትዕዛዝ አገልግሎት',
    rxH2: 'ሀኪም ትዕዛዝ አለዎት?\nለእርስዎ ዝግጁ ነን።',
    rxDesc: 'ሀኪም ትዕዛዝዎን ወደ መደብሩ ያምጡ ወይም አስቀድመው ይደውሉ — ፋርማሲስቶቻችን መድሃኒቶን ያዘጋጃሉ።',
    rxCall: 'ይደውሉ',
    rxFind: 'አድራሻችንን ያግኙ',

    testLabel: 'ምስክርነቶች',
    testH2: 'ማህበረሰባችን ያምናቸዋል',
    test1: '"ኢማና ፋርማሲ ቤተሰቤ ጤናን የሚያስተዳድርበትን ሁኔታ ሙሉ ለሙሉ ቀይሯል። ሰራተኞቹ ዕውቀት ያላቸው፣ ደጋጊ ናቸው።"',
    test1Name: 'ፋጡማ አብደላ',
    test1Role: 'ቋሚ ታካሚ',
    test2: '"ለሁለት ዓመታት ለደም ግፊት መድሃኒቶቼ ኢማናን ስመኘ ቆይቻለሁ። አገልግሎቱ ፈጣን ነው።"',
    test2Name: 'ግርማ በቀለ',
    test2Role: 'የደም ግፊት ታካሚ',
    test3: '"የእናትና ሕፃን ክፍሉ ምርጥ ነው። ፋርማሲስቱ በእርግዝናዬ ጊዜ ያስፈለጉኝን ሁሉ ነገር ሊያሳዩኝ ረድቶኛል።"',
    test3Name: 'ሜሮን ሃይሌ',
    test3Role: 'አዲስ እናት',

    footerDesc: 'ከ2018 ጀምሮ ለጅማ ማህበረሰብ ዘመናዊ የፋርማሲ አገልግሎት፣ ሙያዊ ምክር እና ጥራት ያለው ምርት እናቀርባለን።',
    quickLinks: 'ፈጣን ማስፈሰሻዎች',
    ourServices: 'አገልግሎቶቻችን',
    contactDetails: 'የአድራሻ ዝርዝሮች',
    staffLoginPortal: 'የሰራተኞች መግቢያ',
    footerSvc1: 'ቤት ደረስ ማድረስ',
    footerSvc2: 'የሀኪም ትዕዛዝ ዝግጅት',
    footerSvc3: 'የፋርማሲስት ምክር',
    footerSvc4: 'ዋስትና ያለው ምርት',
    footerSvc5: 'የህክምና መሳሪያዎች',
    allRights: 'መብቶቹ ሁሉ የተጠበቁ ናቸው።',
    privacy: 'የግል ፖሊሲ',
    terms: 'የአገልግሎት ውሎች',
    support: 'ድጋፍ',
  },

  om: {
    navHome: 'Fuula Mana',
    navAbout: 'Weeynuu',
    navServices: 'Tajaajilaalee',
    navProducts: 'Oomishaalee Keenya',
    navHealthTips: 'Gorsa Fayyaa',
    navContact: 'Nu Qunnamaa',
    staffLogin: 'Seensa Hojjetaa',

    hours: 'Wix.–Qun. 7:30AM – 9PM',
    location: 'Jimmaa, Itoophiyaa',

    heroBadge: 'Farmaasiiwwan Jimmaa Itti Amanan',
    heroH1Line1: 'Fayyaan Keessan,',
    heroH1Line2: 'Waadaa Keenya',
    heroDesc: 'Qorichoota gaarii, gorsa ogummaa fi kunuunsa dhuunfaa dhiyeessina — ummata Jimmaa fi naannoo isaa bara 2018 irraa eegalee tajaajilaa jirra.',
    heroServices: 'Tajaajilaalee Keenya',
    heroContact: 'Nu Quunnamaa',
    heroSearch: 'Qorichoota, tajaajilaalee barbaadi...',

    whyTitle: 'Maaliif Imaanaa?',
    why1: 'Qorichoota mirkanaawan qofa',
    why2: 'Farmaasistii hayyama qabu guyyaa guyyaan',
    why3: 'Dabarsii manatti Jimmaa Zoonii guutuu',
    why4: 'Tajaajila ajaja doktora ariifachisaa',
    why5: 'Torban guutuu guyyaa 7 banaa',
    contactUsToday: 'Har\'a Nu Quunnamaa',

    statYears: 'Waggaawwan Jimmaa Tajaajilinee',
    statCustomers: 'Maamiltoota Gammadan',
    statSatisfaction: 'Quufinsa Maamiltootaa',

    feat1Title: 'Manatti Dabarsuu',
    feat1Desc: 'Qorichoota fi oomishaalee fayyaa keessan karaa nagaa manatti isiniif geessina.',
    feat2Title: 'Qophii Ajaja Doktora',
    feat2Desc: 'Ajaja doktora keessan fidi ykn ergaa — farmaasistotni keenya sa\'aatii keessatti qopheessu.',
    feat3Title: 'Gorsa Farmaasistaa',
    feat3Desc: 'Farmaasistota keenya hayyama qaban wajjin fuula duratti ykn bilbilaan hasa\'i — beellama hin barbaachisu.',
    feat4Title: 'Oomishaalee 100% Dhugaa',
    feat4Desc: 'Oomishaaleen keenya hunduu kallattiin abbootii oomishaa mirkanaawantti fi raabsaa hayyama qaban irraa dhufanii jiru.',

    aboutLabel: 'Weeynuu Farmaasii Imaanaa',
    aboutH2: 'Tajaajila Fayyaa Jimmaa\nKeessatti Itti Amansiisaa',
    aboutP1: 'Farmaasii Imaanaa bara 2018 hundaa\'ee bakka fayyaa Jimmaa itti kabajaman keessaa tokko taateetti. Qorichoota, vaayitaamiinota, meeshaalee fayyaa fi oomishaalee fayyummaa, hunduu dhugoomfamee mirkanaaye, ol aantummaan qabna.',
    aboutP2: 'Gareen farmaasistootaa keenya hayyama qaban dhuunfaa dhiyeessuu keessatti amanamoo dha. Gorsi fayyaa qulqulluu kan namaa hundaaf dhiyaachuu qabu amantii keenya.',
    badge1Title: 'Farmaasistota Hayyama Qaban',
    badge1Sub: 'Hojjettoonni hundi EFDA\' n mirkanaawan',
    badge2Title: 'Suuqii Guutuu',
    badge2Sub: 'Oomishaalee 5,000+ argama',
    badge3Title: 'Guyyaa 7 Banaadha',
    badge3Sub: 'Ayyaanota biyyoolessaa dabalatee',
    badge4Title: 'Hawaasni Dursaa',
    badge4Sub: 'Jimmaa Zoonii 2018 irraa eegalee tajaajilaa',
    yearsServing: 'Waggaawwan Jimmaa\nTajaajilinee',

    catLabel: 'Waan Qabnu',
    catH2: 'Gosa Oomishalee Keenya',
    cat1: 'Qorichoota Ajaja Doktora',
    cat2: 'Vaayitaaminoota fi Supphiimantota',
    cat3: 'Kunuunsa Dhuunfaa',
    cat4: 'Haadha fi Daa\'ima',
    cat5: 'Meeshaalee Fayyaa',
    cat6: 'Darmokoosmetiksii',

    svcLabel: 'Waan Dhiyeessinu',
    svcH2: 'Tajaajilaalee Farmaasii',
    svcDesc: 'Qoricha raabsuu caalaa, imala fayyaa keessan guutuu deeggaaruuf tajaajilaalee bal\'aa dhiyeessina.',

    prodLabel: 'Suuqitti Jiru',
    prodH2: 'Oomishaalee Filataman',
    prodSub: 'Waan argattan mul\'ina gabaabaa',
    prodAvail: 'Argama waa\'ee nu gaafadhaa',
    prodVisit: 'Nu daawwadhu ykn bilbili argama mirkaneeffadhu.',

    tipsLabel: 'Gorsa Fayyaa',
    tipsH2: 'Farmaasistota Keenya Irraa',
    tipsAll: 'Barreeffama Hunda',
    tip1Title: 'Humna Argachuuf Nyaachuu: Farmaasistoonni Keenya Maal Gorsu?',
    tip2Title: 'Shaakalli Yeroo Yeroon Qoricha Akkaataa Deeggaru',
    tip3Title: 'Awwaataa Itoophiyaatti Gogaa Gogaa: Ittisuu fi Kunuunsu',

    rxBadge: 'Tajaajila Ajaja Doktora',
    rxH2: 'Ajaja Doktora Qabdaa?\nIsiniif Qophaa\'oodha.',
    rxDesc: 'Ajaja doktora keessan suuqiitti fidi ykn dur bilbili — farmaasistoonni keenya qoricha isiniif qopheessu.',
    rxCall: 'Bilbili',
    rxFind: 'Bakka Keenya Barbaadi',

    testLabel: 'Ragaa Namoota',
    testH2: 'Hawaasni Keenya Itti Amana',
    test1: '"Farmaasii Imaanaa maatii koo fayyaa itti bulchuuf fayyadamu guutummaatti jijjiire. Hojjettoonni beekumsa qabu, gaarii dha."',
    test1Name: 'Faaxumaa Abdallaa',
    test1Role: 'Dhukkubsataa Yeroo Hundaa',
    test2: '"Waggaa lama dhukkuba dhiigaa koof qorichaaf Imaanatti amaneera. Tajaajilli dafaa dha."',
    test2Name: 'Girumaa Baqqalaa',
    test2Role: 'Dhukkubsataa Dhiibba Dhiigaa',
    test3: '"Kutaan haadha fi daa\'ima baay\'ee gaariidha. Farmaasistiin ulfinaa koo irratti waan barbaaduu hunda naaf agarse."',
    test3Name: 'Meroon Haayilee',
    test3Role: 'Haadha Haaraa',

    footerDesc: 'Hawaasa Jimmaa 2018 irraa eegalee kunuunsa farmaasii ammayyaa, gorsa ogummaa fi oomishaalee qulqulluu dhiyeessaa jirra.',
    quickLinks: 'Hidhannoo Ariifachiisaa',
    ourServices: 'Tajaajilaalee Keenya',
    contactDetails: 'Ibsa Qunnamtii',
    staffLoginPortal: 'Seensa Hojjetaa',
    footerSvc1: 'Manatti Dabarsuu',
    footerSvc2: 'Qophii Ajaja Doktora',
    footerSvc3: 'Gorsa Farmaasistaa',
    footerSvc4: 'Oomishaalee Dhugaa',
    footerSvc5: 'Meeshaalee Fayyaa',
    allRights: 'Mirgi Hundi Eegamee Jira.',
    privacy: 'Pooliisii Dhuunfaa',
    terms: 'Haala Tajaajilaa',
    support: 'Deeggarsa',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// ── Context ───────────────────────────────────────────────────────────────────
interface I18nContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nCtx = createContext<I18nContext>({
  lang: 'en',
  setLang: () => {},
  t: (k) => translations.en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const t = (key: TranslationKey): string => translations[lang][key] as string;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  return useContext(I18nCtx);
}

export function LanguageSelector() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors shadow-sm"
        aria-label="Select language"
      >
        <Globe size={14} className="text-teal-600" />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                ${l.code === lang
                  ? 'bg-teal-50 text-teal-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
              {l.code === lang && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

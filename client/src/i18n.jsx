/**
 * Internationalization — Hindi + English UI toggle.
 *
 * Provides translations for common UI strings. The system already supports
 * Hindi content in check-ins; this extends it to the interface itself.
 *
 * The translation is deliberately simple — key-value pairs, no complex
 * interpolation. This is a prototype, not a production i18n system.
 */

import { createContext, useContext, useState, useCallback } from 'react';

const translations = {
  en: {
    // Nav
    'nav.cases': 'Cases',
    'nav.alerts': 'Alerts',
    'nav.dashboard': 'Dashboard',
    'nav.checkin': 'Check-in',
    'nav.signout': 'Sign out',
    'nav.subtitle': 'NHAA 14566 · SC/ST (PoA) Act, 1989',

    // Login
    'login.title': 'Well-being Support & Monitoring System',
    'login.subtitle': 'National Helpline for Atrocity Victims · NHAA 14566',
    'login.act': 'SC/ST (Prevention of Atrocities) Act, 1989',
    'login.badge': 'Ministry of Social Justice & Empowerment · Smart India Hackathon 2026',
    'login.complainant': 'Complainant Sign-In',
    'login.complainant.desc': 'Well-being Check-in Portal',
    'login.counsellor': 'Welfare Officer',
    'login.counsellor.desc': 'District Counselling Unit',
    'login.admin': 'Administrator',
    'login.admin.desc': 'National Monitoring Cell',
    'login.username': 'Username or Case ID',
    'login.passcode': 'Passcode',
    'login.signin': 'Sign in',
    'login.signing': 'Signing in…',
    // Sahara Login
    'sahara.trust': 'All communications are confidential & human-reviewed',
    'sahara.safety': 'NATIONAL SAFETY FRAMEWORK · POA ACT 1989',
    'sahara.safeExit': 'Safe Exit',
    'sahara.banyanLabel': 'Sahara Sanctuary',
    'sahara.banyanSub': 'Community Sanctuary',
    'sahara.freeSupport': 'Free & Safe Support',
    'sahara.heroTitle': 'Your words are completely safe here.',
    'sahara.heroDesc1': 'Your words are safe here. Only you and your designated counsellor see them.',
    'sahara.heroDesc2': 'A human counsellor reviews every request under the SC/ST Protection mandate.',
    'sahara.helpline': 'Emergency National Helpline',
    'sahara.callDirect': 'Call Directly',
    'sahara.citizenBanner': 'CITIZEN SANCTUARY & DIRECT SUPPORT',
    'sahara.citizenTitle': 'Are you a victim or complainant?',
    'sahara.citizenDesc': 'No government ID or password required for immediate care.',
    'sahara.citizenCta': 'Safe Entry →',
    'sahara.beginSecureCheckin': 'Begin Secure Check-in',
    'sahara.privateCaseAccess': 'PRIVATE CASE ACCESS',
    'sahara.privateCaseAccessDesc': 'Your Sahara space is linked to your verified case.',
    'sahara.staffSignIn': 'Staff Sign in',
    'sahara.supportSpaceTitle': 'YOUR SUPPORT SPACE',
    'sahara.step1Title': '01 VERIFY',
    'sahara.step1Desc': 'Use your secure Sahara access.',
    'sahara.step2Title': '02 CONNECT',
    'sahara.step2Desc': 'Your linked case opens automatically.',
    'sahara.step3Title': '03 CONTINUE',
    'sahara.step3Desc': 'Check in and continue your support journey.',
    'sahara.accessModalHeadline': 'Welcome to your Sahara support space.',
    'sahara.accessModalCopy': 'Use your Sahara access code to continue.',
    'sahara.accessCodeLabel': 'Access Code',
    'sahara.continueSecurely': 'Continue securely',
    'sahara.codeError': "We couldn't verify this access code.",
    'sahara.verifying': 'Verifying securely…',
    'sahara.welcomeBack': 'Welcome back.',
    'sahara.journeyReady': 'Your support journey is ready.',
    'sahara.caseStageLabel': 'Case stage:',
    'sahara.nextCheckinLabel': 'Next check-in: Today',
    'sahara.continueCheckin': 'Continue Check-in',
    'sahara.evaluatorMode': 'Evaluator Mode',
    'sahara.tier1': 'TIER 1 DESK ACCESS',
    'sahara.tier1Title': 'Counsellor & Support Officer',
    'sahara.tier1Desc': 'For assigned district counsellors and welfare officers managing individual case care.',
    'sahara.tier1Features': 'ENABLED CAPABILITIES:',
    'sahara.tier1F1': 'Individual case tracking',
    'sahara.tier1F2': 'Encrypted check-in records',
    'sahara.tier1Cta': 'Enter →',
    'sahara.tier2': 'TIER 2 ADMINISTRATIVE OVERSIGHT',
    'sahara.tier2Title': 'Admin & Policy Analyst',
    'sahara.tier2Desc': 'For District Magistrates and Nodal Officers reviewing macro-level trends.',
    'sahara.tier2Features': 'PRIVACY STANDARDS:',
    'sahara.tier2F1': 'k-Anonymity threshold (k≥5)',
    'sahara.tier2F2': 'Zero PII exposure',
    'sahara.tier2Cta': 'Enter Analytics →',
    'sahara.breathe': 'Pause & Breathe 🌿',
    'sahara.demoAccess': 'Quick Access — All Demo Personas',
    'sahara.manualLogin': 'Manual Sign-In (Counsellor/Admin)',
    'sahara.manualUsername': 'Username or Case ID',
    'sahara.manualPasscode': 'Passcode',
    'sahara.manualCta': 'Sign In →',
    'sahara.trustPrivacy': 'Absolute Privacy',
    'sahara.trustPrivacyDesc': 'No invasive tracking. Encrypted under government protection guidelines.',
    'sahara.trustHuman': 'Human In The Loop',
    'sahara.trustHumanDesc': 'Reviewed by certified district welfare officers. Never by autonomous bots.',
    'sahara.trustPace': 'At Your Own Pace',
    'sahara.trustPaceDesc': 'Share only what you feel prepared to say. Pause or skip any inquiry.',
    'sahara.camouflageTitle': 'National Agro-Meteorological Weather Advisory',
    'sahara.camouflageSub': 'India Meteorological Department',
    'sahara.camouflageReturn': 'Refresh',
    'sahara.breatheTitle': 'Take a deep, calm breath',
    'sahara.breatheDesc': 'Take an unhurried, gentle breath. You are safe here.',
    'sahara.breatheInhale': 'Inhale',
    'sahara.breathePattern': '4 seconds in... 4 seconds hold... 4 seconds out',
    'sahara.breatheReturn': 'Return to Check-in',

    // Dashboard
    'dashboard.total': 'Total Cases',
    'dashboard.escalated': 'Escalated',
    'dashboard.stable': 'Stable',
    'dashboard.avgScore': 'Avg Score',
    'dashboard.alerts': 'Active Alerts',
    'dashboard.rising': 'Rising Trends',

    // Case
    'case.score': 'Distress Score',
    'case.checkins': 'Check-ins',
    'case.trend': 'Trend',
    'case.escalated': 'Escalated',
    'case.stage': 'Case Stage',
    'case.months': 'Since Registration',

    // Chat
    'chat.placeholder': 'Type your reply...',
    'chat.send': 'Send',
    'chat.analysing': 'Analysing...',
    'chat.replies': 'replies',
    'chat.notifications': 'Notifications',
    'chat.noNotifications': 'No notifications yet.',

    // Map
    'map.title': 'Geographic Overview',
    'map.table': 'Table',
    'map.riskLevel': 'Risk Level',
    'map.clickState': 'Click a state on the map to see details.',

    // Emotions
    'emotions.title': 'Detected Emotions',

    // Prediction
    'prediction.title': 'Trend Prediction',
    'prediction.confidence': 'Confidence',
    'prediction.courtDate': 'Court date within window',
  },
  hi: {
    // Nav
    'nav.cases': 'मामले',
    'nav.alerts': 'अलर्ट',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.checkin': 'जाँच',
    'nav.signout': 'साइन आउट',
    'nav.subtitle': 'NHAA 14566 · अनुसूचित जाति/जनजाति (अत्याचार निवारण) अधिनियम, 1989',

    // Login
    'login.title': 'कल्याण सहायता और निगरानी प्रणाली',
    'login.subtitle': 'अत्याचार पीड़ितों के लिए राष्ट्रीय हेल्पलाइन · NHAA 14566',
    'login.act': 'अनुसूचित जाति और अनुसूचित जनजाति (अत्याचार निवारण) अधिनियम, 1989',
    'login.badge': 'सामाजिक न्याय और अधिकारिता मंत्रालय · स्मार्ट इंडिया हैकाथॉन 2026',
    'login.complainant': 'शिकायतकर्ता साइन-इन',
    'login.complainant.desc': 'कल्याण जाँच पोर्टल',
    'login.counsellor': 'कल्याण अधिकारी',
    'login.counsellor.desc': 'जिला परामर्श इकाई',
    'login.admin': 'प्रशासक',
    'login.admin.desc': 'राष्ट्रीय निगरानी कक्ष',
    'login.username': 'उपयोगकर्ता नाम या मामला आईडी',
    'login.passcode': 'पासकोड',
    'login.signin': 'साइन इन',
    'login.signing': 'साइन इन हो रहा है…',
    // Sahara Login
    'sahara.trust': 'सभी संचार गोपनीय और मानव-सत्यापित हैं',
    'sahara.safety': 'राष्ट्रीय सुरक्षा ढाँचा · अत्याचार निवारण अधिनियम 1989',
    'sahara.safeExit': 'त्वरित निकास',
    'sahara.banyanLabel': 'सहारा संबल कुटीर',
    'sahara.banyanSub': 'अभय आश्रय',
    'sahara.freeSupport': 'निःशुल्क एवं सुरक्षित सहायता',
    'sahara.heroTitle': 'आपकी बात यहाँ पूरी तरह सुरक्षित है।',
    'sahara.heroDesc1': 'आपके शब्द यहाँ सुरक्षित हैं। केवल आप और आपके नियुक्त परामर्शदाता इन्हें देख सकते हैं।',
    'sahara.heroDesc2': 'SC/ST सुरक्षा अधिदेश के तहत प्रत्येक अनुरोध की एक मानवीय समीक्षा होती है।',
    'sahara.helpline': 'आपातकालीन राष्ट्रीय हेल्पलाइन',
    'sahara.callDirect': 'सीधे कॉल करें',
    'sahara.citizenBanner': 'नागरिक आश्रय एवं सीधी सहायता',
    'sahara.citizenTitle': 'क्या आप पीड़ित अथवा शिकायतकर्ता हैं?',
    'sahara.citizenDesc': 'तत्काल देखभाल के लिए किसी सरकारी आईडी या पासवर्ड की आवश्यकता नहीं है।',
    'sahara.citizenCta': 'सुरक्षित प्रवेश करें →',
    'sahara.beginSecureCheckin': 'सुरक्षित संवाद प्रारंभ करें',
    'sahara.privateCaseAccess': 'निजी केस संबल',
    'sahara.privateCaseAccessDesc': 'आपका सहारा संबल कक्ष आपके सत्यापित केस से जुड़ा है।',
    'sahara.staffSignIn': 'कर्मचारी / परामर्शदाता लॉगिन',
    'sahara.supportSpaceTitle': 'आपका संबल कक्ष',
    'sahara.step1Title': '०१ सत्यापन',
    'sahara.step1Desc': 'अपने सुरक्षित सहारा क्रेडेंशियल का उपयोग करें।',
    'sahara.step2Title': '०२ जुड़ाव',
    'sahara.step2Desc': 'आपका संबंधित केस स्वतः खुल जाता है।',
    'sahara.step3Title': '०३ निरंतरता',
    'sahara.step3Desc': 'संवाद दर्ज करें और अपनी संबल यात्रा जारी रखें।',
    'sahara.accessModalHeadline': 'सहारा संबल कक्ष में आपका स्वागत है।',
    'sahara.accessModalCopy': 'आगे बढ़ने के लिए अपना 6-अंकीय सहारा एक्सेस कोड दर्ज करें।',
    'sahara.accessCodeLabel': 'एक्सेस कोड',
    'sahara.continueSecurely': 'सुरक्षित रूप से आगे बढ़ें',
    'sahara.codeError': 'हम इस एक्सेस कोड को सत्यापित नहीं कर सके।',
    'sahara.verifying': 'सुरक्षित सत्यापन हो रहा है…',
    'sahara.welcomeBack': 'पुनः स्वागत है।',
    'sahara.journeyReady': 'आपकी संबल यात्रा तैयार है।',
    'sahara.caseStageLabel': 'केस का चरण:',
    'sahara.nextCheckinLabel': 'अगला संवाद: आज',
    'sahara.continueCheckin': 'संवाद प्रारंभ करें',
    'sahara.evaluatorMode': 'मूल्यांकन मोड',
    'sahara.tier1': 'स्तर १ कार्यक्षेत्र प्रवेश',
    'sahara.tier1Title': 'कौंसलर एवं सहायता अधिकारी',
    'sahara.tier1Desc': 'व्यक्तिगत मामला देखभाल प्रबंधन करने वाले नियुक्त जिला परामर्शदाताओं के लिए।',
    'sahara.tier1Features': 'सक्षम कार्यप्रणाली:',
    'sahara.tier1F1': 'व्यक्तिगत मामला ट्रैकिंग',
    'sahara.tier1F2': 'एन्क्रिप्टेड जाँच रिकॉर्ड',
    'sahara.tier1Cta': 'प्रवेश करें →',
    'sahara.tier2': 'स्तर २ प्रशासनिक देखरेख',
    'sahara.tier2Title': 'प्रशासनिक एवं नीति विश्लेषक',
    'sahara.tier2Desc': 'स्तरीय रुझानों की समीक्षा करने वाले जिला मजिस्ट्रेटों के लिए।',
    'sahara.tier2Features': 'गोपनीयता मानक:',
    'sahara.tier2F1': 'k-गोपनीयता सीमा (k≥5)',
    'sahara.tier2F2': 'शून्य PII एक्सपोज़र',
    'sahara.tier2Cta': 'विश्लेषण में प्रवेश →',
    'sahara.breathe': 'ब्रीदिंग पॉज़ लें 🌿',
    'sahara.demoAccess': 'त्वरित प्रवेश — सभी डेमो पर्सोना',
    'sahara.manualLogin': 'मैनुअल साइन-इन (परामर्शदाता/प्रशासक)',
    'sahara.manualUsername': 'उपयोगकर्ता नाम या मामला आईडी',
    'sahara.manualPasscode': 'पासकोड',
    'sahara.manualCta': 'साइन इन →',
    'sahara.trustPrivacy': 'गोपनीयता का वचन',
    'sahara.trustPrivacyDesc': 'कोई आक्रामक ट्रैकिंग नहीं। सरकारी सुरक्षा दिशानिर्देशों के तहत एन्क्रिप्टेड।',
    'sahara.trustHuman': 'मानवीय सहारा',
    'sahara.trustHumanDesc': 'प्रमाणित जिला कल्याण अधिकारियों द्वारा समीक्षित। कभी स्वायत्त बॉट द्वारा नहीं।',
    'sahara.trustPace': 'आपकी अपनी गति',
    'sahara.trustPaceDesc': 'केवल वही साझा करें जो आप बताने के लिए तैयार हैं। किसी भी प्रश्न को छोड़ सकते हैं।',
    'sahara.camouflageTitle': 'राष्ट्रीय कृषि मौसम परामर्श सेवा',
    'sahara.camouflageSub': 'भारत मौसम विज्ञान विभाग',
    'sahara.camouflageReturn': 'पुनः लोड करें',
    'sahara.breatheTitle': 'एक गहरी और शांत सांस लें',
    'sahara.breatheDesc': 'एक अनुपयत, कोमल सांस लें। आप यहाँ सुरक्षित हैं।',
    'sahara.breatheInhale': 'सांस लें',
    'sahara.breathePattern': '4 सेकंड अंदर... 4 सेकंड रोकें... 4 सेकंड बाहर',
    'sahara.breatheReturn': 'जाँच पर वापस जाएँ',

    // Dashboard
    'dashboard.total': 'कुल मामले',
    'dashboard.escalated': 'बढ़ाए गए',
    'dashboard.stable': 'स्थिर',
    'dashboard.avgScore': 'औसत स्कोर',
    'dashboard.alerts': 'सक्रिय अलर्ट',
    'dashboard.rising': 'बढ़ते रुझान',

    // Case
    'case.score': 'तनाव स्कोर',
    'case.checkins': 'जाँच',
    'case.trend': 'रुझान',
    'case.escalated': 'बढ़ाया गया',
    'case.stage': 'मामले का चरण',
    'case.months': 'पंजीकरण के बाद',

    // Chat
    'chat.placeholder': 'अपना जवाब लिखें...',
    'chat.send': 'भेजें',
    'chat.analysing': 'विश्लेषण हो रहा है...',
    'chat.replies': 'जवाब',
    'chat.notifications': 'सूचनाएँ',
    'chat.noNotifications': 'अभी कोई सूचना नहीं।',

    // Map
    'map.title': 'भौगोलिक अवलोकन',
    'map.table': 'तालिका',
    'map.riskLevel': 'जोखिम स्तर',
    'map.clickState': 'विवरण देखने के लिए मानचित्र पर किसी राज्य पर क्लिक करें।',

    // Emotions
    'emotions.title': 'पहचानी गई भावनाएँ',

    // Prediction
    'prediction.title': 'रुझान भविष्यवाणी',
    'prediction.confidence': 'विश्वास',
    'prediction.courtDate': 'न्यायालय की तिथि भविष्यवाणी खिड़की में',
  },
};

const I18nContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    try {
      return localStorage.getItem('sih26094_locale') ?? 'en';
    } catch { return 'en'; }
  });

  const handleSetLocale = useCallback((newLocale) => {
    setLocale(newLocale);
    try { localStorage.setItem('sih26094_locale', newLocale); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key) => {
    return translations[locale]?.[key] ?? translations.en[key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

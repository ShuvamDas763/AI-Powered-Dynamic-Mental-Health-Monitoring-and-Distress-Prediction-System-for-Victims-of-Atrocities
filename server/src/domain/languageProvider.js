/**
 * Multilingual Foundation Provider
 * 
 * Centralizes multilingual templates and crisis communication in English and Hindi.
 * Designed for victims under SC/ST (Prevention of Atrocities) Act support frameworks.
 */

export const SUPPORTED_LOCALES = ['en', 'hi'];
export const DEFAULT_LOCALE = 'en';

export const CRISIS_HELPLINES = {
  teleManas: '14416',
  teleManasTollFree: '1800-891-4416',
  nationalEmergency: '112',
  kiran: '1800-599-0019',
  vandrevalaFoundation: '9999-666-555',
  scStHelpline: '14566',
};

const TEMPLATES = {
  en: {
    prompts: {
      initial: 'How have things been since we last checked in?',
      followUp: 'Thank you for sharing that. Is there anything else you would like to talk about?',
      closing: 'Thank you for checking in today. Your dedicated welfare officer has received your check-in.',
      cadenceReminder: 'Hello. It is time for your scheduled well-being check-in with your support team.',
    },
    crisis: {
      header: 'Immediate Support Available',
      body: 'You are not alone. A dedicated counsellor has been notified and will reach out. If you need immediate assistance, free 24/7 helplines are available.',
      actionCall: 'Call Tele-MANAS (14416)',
      secondaryHelplines: 'National Helpline: 112 | KIRAN: 1800-599-0019 | SC/ST Atrocity Helpline: 14566',
    },
    outreach: {
      app: 'Hello {name}, your periodic well-being check-in is scheduled for today. Please take a moment to share how you are feeling.',
      sms: 'Sahara Welfare: Namaste {name}. Your well-being check-in is due today. Reply to this SMS or visit the app. Helpline: 14416.',
      ivrs: 'Namaste {name}. This is an automated well-being follow-up from the District Welfare Cell under SC/ST Protection. Press 1 to speak with a counsellor, or press 2 to schedule a call back.',
      web: 'Welcome {name}. Take your time to complete your scheduled check-in. Your responses are strictly confidential.',
    },
  },
  hi: {
    prompts: {
      initial: 'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?',
      followUp: 'आपने जो बताया उसके लिए धन्यवाद। क्या और कुछ है जो आप बताना चाहेंगे?',
      closing: 'आज संवाद साझा करने के लिए धन्यवाद। आपके कल्याण अधिकारी तक आपकी बात पहुँचा दी गई है।',
      cadenceReminder: 'नमस्ते। आपके निर्धारित कल्याण संवाद का समय हो गया है।',
    },
    crisis: {
      header: 'तत्काल सहायता उपलब्ध है',
      body: 'आप अकेले नहीं हैं। आपके नामित परामर्शदाता को सूचित कर दिया गया है। यदि आपको तुरंत सहायता चाहिए, तो 24/7 निःशुल्क हेल्पलाइन उपलब्ध हैं।',
      actionCall: 'Tele-MANAS को कॉल करें (14416)',
      secondaryHelplines: 'राष्ट्रीय आपातकालीन: 112 | किरण: 1800-599-0019 | अजा/अजजा अत्याचार निवारण हेल्पलाइन: 14566',
    },
    outreach: {
      app: 'नमस्ते {name}, आपका समयबद्ध कल्याण संवाद आज निर्धारित है। कृपया कुछ पल निकालकर बताएं कि आप कैसा महसूस कर रहे हैं।',
      sms: 'सहारा संबल: नमस्ते {name}। आपका हालचाल संवाद आज देय है। उत्तर दें या ऐप खोलें। हेल्पलाइन: 14416।',
      ivrs: 'नमस्ते {name}। यह जिला कल्याण प्रकोष्ठ की ओर से अनुसूचित जाति/जनजाति संरक्षण संवाद है। परामर्शदाता से बात करने हेतु 1 दबाएं, या बाद में कॉल के लिए 2 दबाएं।',
      web: 'स्वागत है {name}। अपनी गति से संवाद पूरा करें। आपकी सभी बातें पूर्णतः गोपनीय हैं।',
    },
  },
};

/**
 * Normalizes locale code to supported set.
 * @param {string} locale
 * @returns {'en'|'hi'}
 */
export function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  const lower = locale.toLowerCase().slice(0, 2);
  return SUPPORTED_LOCALES.includes(lower) ? lower : DEFAULT_LOCALE;
}

/**
 * Retrieves a prompt string for given locale and key.
 * @param {string} locale
 * @param {string} key
 * @returns {string}
 */
export function getPrompt(locale, key = 'initial') {
  const loc = normalizeLocale(locale);
  return TEMPLATES[loc]?.prompts?.[key] || TEMPLATES.en.prompts[key] || '';
}

/**
 * Retrieves crisis messaging for given locale.
 * @param {string} locale
 * @returns {object}
 */
export function getCrisisContent(locale) {
  const loc = normalizeLocale(locale);
  return {
    ...TEMPLATES[loc].crisis,
    helplines: CRISIS_HELPLINES,
  };
}

/**
 * Formats an outreach message for a specified channel and recipient.
 * @param {string} locale
 * @param {'web'|'app'|'sms'|'ivrs'} channel
 * @param {{ name?: string, caseId?: string }} context
 * @returns {string}
 */
export function formatOutreachTemplate(locale, channel, context = {}) {
  const loc = normalizeLocale(locale);
  const ch = channel?.toLowerCase() || 'app';
  const raw = TEMPLATES[loc]?.outreach?.[ch] || TEMPLATES.en.outreach[ch] || TEMPLATES.en.outreach.app;
  const name = context.name || (loc === 'hi' ? 'साथी' : 'friend');
  return raw.replace(/{name}/g, name);
}

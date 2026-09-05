/**
 * Crisis response wording — reviewed and approved by the research team
 *
 * This file contains the exact text shown to a person when a crisis trigger
 * fires. It is deliberately separated from the detection logic so the
 * phrasing can be reviewed and rewritten without touching code.
 *
 * CRISIS RESPONSE PROTOCOL — v2
 * -------------------------------------------------------------------------
 * Adapted from the QPR (Question, Persuade, Refer) framework. The response
 * follows three steps:
 *
 *   Step 1 — Acknowledge directly, no deflection
 *   Step 2 — Refer to real, immediate help (Tele-MANAS), in the same message
 *   Step 3 — Keep the human path open (counsellor notification)
 *
 * DECISION (protocol Section 6): the chatbot does NOT ask
 * "are you thinking about ending your life right now?" — and this is a
 * deliberate design decision, not an omission. The chatbot has no ability
 * to act differently based on the answer: the next step is identical either
 * way (surface Tele-MANAS + notify the counsellor). Asking would imply a
 * real-time capability to respond that the system does not structurally
 * have. A live-staffed helpline (Tele-MANAS) is better positioned to ask
 * that question and act on the answer. This also makes the self-harm
 * response consistent with the violence-fear response below, which has
 * never asked about suicidal intent.
 *
 * HARD RULES (from protocol Section 4):
 * - Help comes first, exploration comes after (if at all, with a human)
 * - No promise of confidentiality
 * - No arguing, debating, or minimising
 * - This response REPLACES the normal follow-up entirely
 * - Does not depend on the LLM being reachable
 *
 * HELPLINE NUMBERS (verified August 2025):
 * - Tele-MANAS: 14416 (short code) or 1-800-891-4416 (toll-free)
 *   Ministry of Health & Family Welfare, 24/7, multilingual
 *   KIRAN (1800-599-0019) merged into Tele-MANAS in Feb 2024
 *
 * TO EDIT: Change the text in CRISIS_RESPONSE below. The detection
 * logic in crisisDetection.js does not reference these strings.
 */

/**
 * The crisis response, keyed by language.
 *
 * Each locale contains:
 *   steps: Array<string> — the response shown to the person, in order
 *   helpline: { name, number, altNumber, label } — displayed prominently
 *   counsellorNote: string — shown to the counsellor in the alert
 */
export const CRISIS_RESPONSE = Object.freeze({
  en: {
    steps: [
      // Step 1 — Acknowledge directly, no deflection
      'Thank you for telling me that. What you\'re feeling is real, and I\'m glad you shared it with me.',

      // Step 2 — Refer to immediate help, in the same message
      'You can talk to someone right now, for free, 24/7:\n\nTele-MANAS — call or message 14416\n(toll-free: 1-800-891-4416)\n\nTrained counsellors are available in your language.',

      // Step 3 — Keep the human path open
      'I\'ve also let our support team know, and someone will follow up with you. You don\'t have to go through this alone.',
    ],
    helpline: {
      name: 'Tele-MANAS',
      number: '14416',
      altNumber: '1-800-891-4416',
      label: '24/7 toll-free mental health helpline — Ministry of Health & Family Welfare',
    },
    counsellorNote: 'Crisis trigger fired: the person expressed explicit self-harm/suicide language. Immediate follow-up required. See check-in text for exact wording.',
  },

  hi: {
    steps: [
      // Step 1 — Acknowledge directly, no deflection
      'आपने जो बताया उसके लिए धन्यवाद। जो आप महसूस कर रहे हैं वह सच्चा है, और मैं इसे साझा करने के लिए आपका आभारी हूँ।',

      // Step 2 — Refer to immediate help, in the same message
      'आप अभी, मुफ़्त में, किसी से बात कर सकते हैं:\n\nTele-MANAS — 14416 पर कॉल या मैसेज करें\n(टोल-फ़्री: 1-800-891-4416)\n\nप्रशिक्षित परामर्शदाता आपकी भाषा में उपलब्ध हैं।',

      // Step 3 — Keep the human path open
      'मैंने हमारी सहायता टीम को भी सूचित कर दिया है, और कोई आपसे संपर्क करेगा। आपको अकेले इससे गुज़रना नहीं है।',
    ],
    helpline: {
      name: 'Tele-MANAS',
      number: '14416',
      altNumber: '1-800-891-4416',
      label: '24/7 टोल-फ़्री मानसिक स्वास्थ्य हेल्पलाइन — स्वास्थ्य और परिवार कल्याण मंत्रालय',
    },
    counsellorNote: 'Crisis trigger fired (Hindi): the person expressed explicit self-harm/suicide language. Immediate follow-up required. See check-in text for exact wording.',
  },
});

/**
 * Violence-fear crisis response — shown when a person expresses fear of being
 * assaulted, harmed, or attacked by others. Same three-step shape as the
 * self-harm response (acknowledge → refer → keep the human path open), but
 * focused on immediate safety and, like every response in this file, it does
 * NOT ask about suicidal intent — the helpline asks; we refer.
 */
const VIOLENCE_FEAR_RESPONSE = Object.freeze({
  en: {
    steps: [
      // Step 1 — Acknowledge the safety concern directly
      'I hear you, and your safety matters. Thank you for telling me about this.',

      // Step 2 — Refer to immediate help, in the same message
      'You can talk to someone right now, for free, 24/7:\n\nTele-MANAS — call or message 14416\n(toll-free: 1-800-891-4416)\n\nTrained counsellors are available in your language.',

      // Step 3 — Keep the human path open
      'Our support team has been notified, and a counsellor will follow up with you shortly. If you feel you are in immediate danger, please contact the police (100) or your nearest helpdesk.',
    ],
    helpline: {
      name: 'Tele-MANAS',
      number: '14416',
      altNumber: '1-800-891-4416',
      label: '24/7 toll-free mental health helpline — Ministry of Health & Family Welfare',
    },
    counsellorNote: 'Crisis trigger fired: the person expressed fear of being assaulted, harmed, or attacked by others. Immediate safety follow-up required. See check-in text for exact wording.',
  },

  hi: {
    steps: [
      'मैं समझ सकता हूँ, और आपकी सुरक्षा बहुत महत्वपूर्ण है। इस बारे में बताने के लिए धन्यवाद।',
      'आपकी सुरक्षा की चिंता गंभीरता से ली जा रही है। आपको इसका सामना अकेले नहीं करना चाहिए।',
      'आप अभी, मुफ़्त में, किसी से बात कर सकते हैं:\n\nTele-MANAS — 14416 पर कॉल या मैसेज करें\n(टोल-फ़्री: 1-800-891-4416)\n\nप्रशिक्षित परामर्शदाता आपकी भाषा में उपलब्ध हैं।',
      'हमारी सहायता टीम को सूचित कर दिया गया है, और कोई आपसे जल्द ही संपर्क करेगा। अगर आपको लगता है कि आप तत्काल ख़तरे में हैं, तो कृपया पुलिस (100) या अपनी निकटतम हेल्पडेस से संपर्क करें।',
    ],
    helpline: {
      name: 'Tele-MANAS',
      number: '14416',
      altNumber: '1-800-891-4416',
      label: '24/7 टोल-फ़्री मानसिक स्वास्थ्य हेल्पलाइन — स्वास्थ्य और परिवार कल्याण मंत्रालय',
    },
    counsellorNote: 'Crisis trigger fired (Hindi): the person expressed fear of being assaulted, harmed, or attacked by others. Immediate safety follow-up required. See check-in text for exact wording.',
  },
});

/**
 * Build the full crisis response for a given locale.
 *
 * @param {string} locale — 'en' or 'hi'
 * @param {string} [category] — the crisis category code, for per-category responses
 * @returns {{ steps: string[], helpline: object, counsellorNote: string }}
 */
export function getCrisisResponse(locale, category) {
  // Violence fear gets its own safety-focused variant.
  if (category === 'violence_fear') {
    return VIOLENCE_FEAR_RESPONSE[locale] ?? VIOLENCE_FEAR_RESPONSE.en;
  }
  return CRISIS_RESPONSE[locale] ?? CRISIS_RESPONSE.en;
}

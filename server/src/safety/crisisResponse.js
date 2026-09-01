/**
 * Crisis response wording — PENDING RESEARCH TEAM SIGN-OFF
 *
 * This file contains the exact text shown to a person when a crisis trigger
 * fires. It is deliberately separated from the detection logic so the
 * research team can review and rewrite the phrasing without touching code.
 *
 * CRISIS RESPONSE PROTOCOL — v1 Draft
 * -------------------------------------------------------------------------
 * Based on QPR (Question, Persuade, Refer) framework. The response follows
 * four steps:
 *
 *   Step 1 — Acknowledge directly, no deflection
 *   Step 2 — Ask directly, calmly (PENDING: should chatbot ask this?
 *            or skip to human referral?)
 *   Step 3 — Refer to real, immediate help (Tele-MANAS)
 *   Step 4 — Keep the human path open (counsellor notification)
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
      // Step 1 — Acknowledge directly (QPR: Acknowledge)
      'Thank you for telling me that. What you\'re feeling is real, and I\'m glad you shared it with me.',

      // Step 2 — Direct safety question (QPR: Question)
      // PENDING RESEARCH TEAM SIGN-OFF — see protocol Section 6
      // Should the chatbot ask this, or skip to Step 3 and let a human ask?
      'Are you thinking about ending your life right now?',

      // Step 3 — Refer to immediate help (QPR: Refer)
      'You can talk to someone right now, for free, 24/7:\n\nTele-MANAS — call or message 14416\n(toll-free: 1-800-891-4416)\n\nTrained counsellors are available in your language.',

      // Step 4 — Keep the human path open
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
      // Step 1 — Acknowledge directly
      'आपने जो बताया उसके लिए धन्यवाद। जो आप महसूस कर रहे हैं वह सच्चा है, और मैं इसे साझा करने के लिए आपका आभारी हूँ।',

      // Step 2 — Direct safety question
      // PENDING RESEARCH TEAM SIGN-OFF
      'क्या आप अभी अपनी जान लेने के बारे में सोच रहे हैं?',

      // Step 3 — Refer to immediate help
      'आप अभी, मुफ़्त में, किसी से बात कर सकते हैं:\n\nTele-MANAS — 14416 पर कॉल या मैसेज करें\n(टोल-फ़्री: 1-800-891-4416)\n\nप्रशिक्षित परामर्शदाता आपकी भाषा में उपलब्ध हैं।',

      // Step 4 — Keep the human path open
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
 * Build the full crisis response for a given locale.
 *
 * @param {string} locale — 'en' or 'hi'
 * @returns {{ steps: string[], helpline: object, counsellorNote: string }}
 */
export function getCrisisResponse(locale) {
  return CRISIS_RESPONSE[locale] ?? CRISIS_RESPONSE.en;
}

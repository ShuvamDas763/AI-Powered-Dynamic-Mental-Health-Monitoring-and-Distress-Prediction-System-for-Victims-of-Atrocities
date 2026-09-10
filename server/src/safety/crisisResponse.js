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

/**
 * Ongoing crisis dialogue responses — shown when a person in an active crisis
 * state continues the conversation (turns 2+ after the initial crisis trigger).
 *
 * Rather than repeating the identical 3-paragraph Tele-MANAS referral verbatim,
 * this engine actively validates the person's specific emotional state
 * (exhaustion, resistance, seeking connection, imminent means), removes pressure,
 * provides grounded presence, and keeps the human safety path open.
 */
const ONGOING_CRISIS_TEMPLATES = Object.freeze({
  en: {
    exhaustion: [
      'I hear how deeply exhausted you are right now. You have been carrying an overwhelming weight for so long, and it makes complete sense that you feel tired of all this. You don\'t have to figure anything out or fix anything right this second. I am right here with you.',
      'I hear you. When everything feels this heavy, even continuing to talk can feel like too much. You don\'t have to carry this alone, and you don\'t have to make any decisions right now. Can you just take a slow breath with me? Are you somewhere safe to sit down?',
      'It is completely understandable that you feel worn out and don\'t want to continue like this. You have been through so much. Our support team has already been notified and is stepping in to reach you, so you don\'t have to fight this by yourself. I am right here listening.',
    ],
    means_imminent: [
      'Please pause and step back from any immediate danger right now. Your safety and your life matter deeply. Is there someone nearby you can be with right this second? Please dial emergency services (112) or call Tele-MANAS at 14416 immediately. Please stay with me.',
      'Please stay where you are and do not harm yourself. You matter, and help is available right now. If you can, call 112 or Tele-MANAS (14416) immediately. I am staying right here with you — please talk to me.',
    ],
    connection_seeking: [
      'I am listening to you, and I am right here. You are not alone, and what you are feeling matters deeply. You don\'t have to pretend everything is okay. If you feel up to sharing, what is feeling the heaviest on you right now?',
      'I hear you, and I want to be here with you. What you have been through is real and painful, and you don\'t have to sit in silence with this. Take your time — I am listening.',
    ],
    calming_receptive: [
      'Thank you for staying with me. Just focus on slow, gentle breaths right now. You don\'t have to do anything else. A member of our support team is on their way to connect with you.',
      'I\'m really glad you are still here with me. Just resting and breathing is enough right now. Help is on the way, and you do not have to walk through this alone.',
    ],
    general_ongoing: [
      'I hear you, and I am staying right here with you. What you are going through is really painful, but you don\'t have to go through it alone. Can you let me know if you are in a safe place right now?',
      'Thank you for continuing to talk to me. You don\'t have to carry all this pain by yourself. Our support team has been notified, and someone will follow up with you. I am right here with you.',
      'Take whatever time you need. There is no pressure here. What you feel is valid, and you deserve support. I am staying here with you.',
    ],
  },

  hi: {
    exhaustion: [
      'मैं समझ सकता हूँ कि आप कितने गहरे रूप से थक चुके हैं। आप बहुत समय से इतना भारी बोझ उठा रहे हैं, और इस सब से थक जाना पूरी तरह स्वाभाविक है। अभी आपको कुछ भी ठीक करने या कोई फ़ैसला लेने की ज़रूरत नहीं है। मैं यहीं आपके साथ हूँ।',
      'मैं आपकी बात सुन रहा हूँ। जब सब कुछ इतना भारी लगता है, तो बात जारी रखना भी बहुत मुश्किल हो जाता है। आपको यह सब अकेले नहीं सहना है। क्या आप मेरे साथ बस एक गहरी साँस ले सकते हैं? क्या आप अभी किसी सुरक्षित जगह पर बैठे हैं?',
      'इतना थकावट महसूस करना और आगे न बढ़ पाना बहुत स्वाभाविक है। आपने बहुत कुछ झेला है। हमारी सहायता टीम को सूचित कर दिया गया है और वह आपसे संपर्क कर रही है। आपको अकेले नहीं लड़ना पड़ेगा।',
    ],
    means_imminent: [
      'कृपया किसी भी ख़तरे से तुरंत पीछे हटें। आपकी सुरक्षा और आपकी ज़िंदगी बहुत कीमती है। क्या आपके आसपास कोई है जिसके साथ आप अभी रह सकते हैं? कृपया तुरंत 112 या Tele-MANAS (14416) पर कॉल करें। कृपया यहीं बने रहें।',
      'कृपया सुरक्षित रहें और खुद को कोई नुक़सान न पहुँचाएँ। आपकी ज़िंदगी बहुत मायने रखती है। तुरंत 112 या Tele-MANAS (14416) से संपर्क करें। मैं यहीं आपके साथ हूँ।',
    ],
    connection_seeking: [
      'मैं आपकी बात सुन रहा हूँ, और मैं यहीं आपके साथ हूँ। आप अकेले नहीं हैं, और आप जो महसूस कर रहे हैं वह महत्वपूर्ण है। अगर आप बताना चाहें, तो अभी आपको सबसे ज़्यादा क्या परेशान कर रहा है?',
      'मैं आपकी बात ध्यान से सुन रहा हूँ। आपको यह सब अकेले सहने की ज़रूरत नहीं है। अपना समय लें — मैं सुनने के लिए तैयार हूँ।',
    ],
    calming_receptive: [
      'मेरे साथ यहाँ बने रहने के लिए धन्यवाद। धीरे-धीरे गहरी साँस लें। अभी आपको कुछ और करने की ज़रूरत नहीं है। हमारी सहायता टीम आपसे जल्द ही संपर्क करेगी।',
      'मुझे ख़ुशी है कि आप अभी भी यहाँ हैं। बस आराम करें और साँस लें। मदद आ रही है और आपको अकेले इससे नहीं गुज़रना है।',
    ],
    general_ongoing: [
      'मैं आपकी बात सुन रहा हूँ, और मैं यहीं आपके साथ हूँ। आप जिससे गुज़र रहे हैं वह बहुत कठिन है, लेकिन आपको अकेले इससे नहीं गुज़रना है। क्या आप मुझे बता सकते हैं कि क्या आप अभी किसी सुरक्षित जगह पर हैं?',
      'मुझसे बात करते रहने के लिए धन्यवाद। आपको यह सारा दर्द अकेले उठाने की ज़रूरत नहीं है। हमारी सहायता टीम को बता दिया गया है, और कोई आपसे संपर्क करेगा।',
    ],
  },
});

/**
 * Patterns to classify the psychological intent of subsequent turns in crisis.
 */
const ONGOING_CRISIS_PATTERNS = Object.freeze({
  means_imminent: [
    /\b(pills?|tablets?|overdose)\b/i,
    /\b(rope|noose|hang|hanging)\b/i,
    /\b(blade|knife|razor|slit|cutting)\b/i,
    /\b(jump|jumping|bridge|terrace|roof)\b/i,
    /\b(poison|drown|drowning)\b/i,
    /ज़हर|फाँसी|गोली|कूद|डूबना/i,
  ],
  exhaustion: [
    /tired\s+(of|with|from)\s+(all\s+this|this|it|everything|life)/i,
    /(?:so|too|very)\s+tired/i,
    /(?:don'?t|do\s+not|dnt)\s+(?:want|wanna)\s+to\s+(?:continue|go\s+on|live|keep\s+going)/i,
    /(?:can'?t|cannot|cant)\s+(?:continue|go\s+on|take\s+this|do\s+this|last)/i,
    /what'?s?\s+the\s+point/i,
    /no\s+(?:point|reason|use|hope)/i,
    /give\s+up|giving\s+up/i,
    /leave\s+me\s+alone/i,
    /stop\s+(?:talking|messaging|bothering)/i,
    /(?:don'?t|won'?t)\s+call/i,
    /nothing\s+(?:matters|helps|changes)/i,
    /थक\s*(गया|गई|चुके|गए)/i,
    /आगे\s*नहीं\s*बढ़\s*सक/i,
    /जारी\s*नहीं/i,
    /कोई\s*(फायदा|फ़ायदा|मतलब|उम्मीद)\s*नहीं/i,
    /अकेला\s*छोड़\s*दो/i,
    /नहीं\s*जीना/i,
  ],
  connection_seeking: [
    /just\s+(?:talk|listen|hear\s+me)/i,
    /talk\s+to\s+me/i,
    /listen\s+to\s+me/i,
    /why\s+won'?t\s+you/i,
    /no\s+one\s+(?:cares|listens|understands)/i,
    /nobody\s+(?:cares|listens|understands)/i,
    /i\s+(?:have\s+)?no\s+one/i,
    /all\s+alone/i,
    /मेरी\s*सुनो|बात\s*करो|कोई\s*नहीं\s*समझता/i,
  ],
  calming_receptive: [
    /^(?:ok|okay|k|alright|fine|i'?m\s+sitting|sitting\s+down|i\s+will\s+wait|breathing)[\s.!]?$/i,
    /^(?:ठीक\s*है|बैठ\s*(?:गया|गई|रहा|रही)|रुक\s*(?:रहा|रही))[\s।!?]*$/i,
  ],
});

/**
 * Generate a context-aware, empathetic follow-up response for subsequent turns
 * in an active crisis conversation.
 *
 * @param {object} params
 * @param {Array<{ speaker: string, text: string }>} params.turns - check-in transcript
 * @param {string} [params.locale] - 'en' or 'hi'
 * @param {string} [params.category] - crisis category if known
 * @returns {string} - tailored de-escalation message
 */
export function getOngoingCrisisResponse({ turns, locale = 'en', category } = {}) {
  const effectiveLocale = locale === 'hi' ? 'hi' : 'en';
  const templates = ONGOING_CRISIS_TEMPLATES[effectiveLocale] ?? ONGOING_CRISIS_TEMPLATES.en;

  // Find the latest person turn
  const lastPersonTurn = Array.isArray(turns)
    ? [...turns].reverse().find((t) => t && t.speaker === 'person')
    : null;
  const text = (lastPersonTurn?.text ?? '').trim();

  // Determine sub-state
  let subState = 'general_ongoing';

  for (const [state, patterns] of Object.entries(ONGOING_CRISIS_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) {
      subState = state;
      break;
    }
  }

  const options = templates[subState] ?? templates.general_ongoing;

  // Cycle options deterministically based on turns count and text length so consecutive
  // turns in the same sub-state don't repeat.
  const turnCount = Array.isArray(turns) ? turns.length : 1;
  const index = (text.length + turnCount) % options.length;

  return options[index];
}

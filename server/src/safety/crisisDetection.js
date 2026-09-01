/**
 * Crisis detection — pattern-based hard-trigger for explicit self-harm/suicide language.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The normal LLM scoring pipeline treats all messages through sentiment analysis.
 * A message like "I feel like ending my life everyday" can score LOW because the
 * model interprets it as metaphorical, or because the cached fallback path has no
 * model at all. This module runs INDEPENDENTLY of the LLM — before any model
 * call, before any fallback — so it fires regardless of whether the API is
 * reachable.
 *
 * DESIGN PRINCIPLES
 * -------------------------------------------------------------------------
 * - Pattern-based, not model-based. Must fire in cached-fallback mode.
 * - Runs on the concatenation of all person turns in the check-in.
 * - Returns the MATCHED TEXT and CATEGORY so the counsellor sees exactly what
 *   fired the trigger — same explainability standard as the rest of the system.
 * - Conservative: catches clear signals, does not attempt to be exhaustive.
 *   Missing a subtle expression is a risk; a false positive that triggers a
 *   comfort response and a counsellor alert is acceptable — the human reviews.
 *
 * CRISIS RESPONSE WORDING
 * -------------------------------------------------------------------------
 * The exact response text lives in crisisResponse.js as a separate, editable
 * block. This module detects; that module decides what to say. The research
 * team reviews and rewrites crisisResponse.js before shipping.
 */

/**
 * Pattern categories — matching Section 2 of the Crisis Response Protocol.
 *
 * Each category is an array of regex patterns. A match on ANY pattern in ANY
 * category triggers the crisis flow. Patterns are case-insensitive.
 *
 * Hindi patterns use substring matching (no \b) because JavaScript's \b does
 * not work with Devanagari characters — same principle as the GRAPHIC patterns
 * in contentPatterns.js.
 */

/** Direct statements about wanting to end one's life, not wanting to be alive. */
const EXPLICIT_INTENT = Object.freeze([
  /i\s+(want|wish|feel\s+like|feel\s+like\s+i)\s+(to\s+)?(end|ending|finish|finishing)\s+(my\s+)?life/i,
  /i\s+(want|wish)\s+to\s+(die|kill\s+myself|end\s+it)/i,
  /i\s+(have\s+been\s+|keep\s+)?thinking\s+about\s+(end|ending|killing|finishing|kill|finish)\s+(it\s+all|(my\s+)?(life|myself))/i,
  /i\s+(don'?t|do\s+not)\s+want\s+to\s+(be\s+alive|live\s+anymore|live\s+here|go\s+on)/i,
  /i\s+(can'?t|cannot|can\s+not)\s+(go\s+on|take\s+this\s+anymore|do\s+this\s+anymore|live\s+like\s+this)/i,
  /i\s+want\s+to\s+end\s+it\s+all/i,
  /i\s+want\s+to\s+disappear/i,
  /i\s+wish\s+i\s+was\s+(never\s+born|dead|gone|not\s+here|not\s+alive)/i,
  /i\s+don'?t\s+see\s+(a\s+)?point\s+(anymore|in\s+(going\s+on|living|anything))/i,
  /i\s+don'?t\s+see\s+why\s+i\s+(should|would)\s+(go\s+on|keep\s+going|live)/i,
  /no\s+reason\s+to\s+(live|go\s+on|keep\s+going|continue)/i,
  // Hindi equivalents
  /मैं\s*(मरना\s*चाहत[ाी]|जीना\s*नहीं\s*चाहत[ाी]|आत्महत्या\s*करना\s*चाहत[ाी])/,
  /मुझे\s*(लगता\s*है\s*कि|ऐसा\s*लगता\s*है)\s*(मैं\s*)?(मर\s*जाऊ[ँّ]|ख़त्म\s*हो\s*जाऊ[ँّ])/,
  /मैं\s*(अब\s*)?(जी\s*नहीं\s*सकत[ाी]|आगे\s*नहीं\s*बढ़\s*सकत[ाी])/,
]);

/** Hopelessness combined with finality or ending language. */
const HOPELESSNESS_FINALITY = Object.freeze([
  /there'?s?\s+no\s+(point|reason)\s+(anymore|in\s+(going\s+on|living|anything))/i,
  /nothing\s+(matters|will\s+(ever\s+)?change|is\s+going\s+to\s+change|will\s+get\s+better)/i,
  /everyone\s+(would\s+be\s+better\s+off|is\s+better\s+off)\s+(without\s+me|dead)/i,
  /i'?m?\s+(better\s+off\s+)?(dead|gone|not\s+here)/i,
  /no\s+one\s+(would\s+(care|notice|miss)|cares?)\s+(if\s+i\s+(was\s+gone|died|disappeared))/i,
  /i\s+don'?t\s+matter\s+(to\s+anyone|anymore)/i,
  /what'?s?\s+the\s+point\s+(of\s+(going\s+on|living|trying|anything))/i,
  /i\s+(can'?t|cannot)\s+do\s+this\s+anymore/i,
  // Hindi
  /कुछ\s*भी\s*(बदलने\s*वाला\s*नहीं\s*है|नहीं\s*बदलेगा|मायने\s*नहीं\s*रखता)/,
  /सब\s*(मुझसे\s*बेहतर\s*होंगे|अच्छे\s*होंगे)\s*(बिना\s*मेरे|मेरे\s*बिना)/,
  /मैं\s*(किसी\s*के\s*लिए\s*)?(कोई\s*मायने\s*नहीं\s*रखता|महत्वपूर्ण\s*नहीं\s*हूँ)/,
]);

/** Specific method or means references — highest urgency tier. */
const METHOD_MEANS = Object.freeze([
  /\b(poison|pills?|tablet|overdose)\b/i,
  /\b(rope|noose|hang|hanging|hanged)\b/i,
  /\b(blade|razor|knife|cutting|slit)\b/i,
  /\b(jump|jumping\s+(off|from|into))\b/i,
  /\b(drown|drowning|drown(?:ed|ing|s))\b/i,
  /\b(gas|carbon\s*monoxide|suffoca)\b/i,
  /\b(shoot|shooting|gun|pistol|bullet)\b/i,
  /\b(setting\s+(myself|on\s+fire)|burn(?:ed|ing)\s+myself)\b/i,
  // Hindi method references
  /ज़हर|गोली|फाँसी|नदी\s*में\s*कूद|डूबना/,
]);

/** Threats toward self in the context of ongoing intimidation/pressure. */
const THREAT_SELF_CONTEXT = Object.freeze([
  /i\s+(can'?t|cannot)\s+(take|handle|bear)\s+(this|it|them|the\s+(threats?|pressure|intimidation))/i,
  /i\s+(won'?t|will\s+not|can'?t)\s+(survive|last|make\s+it)\s+(much\s+longer|through\s+this)/i,
  /they\s+(will\s+)?(kill\s+me|i'?m?\s+(going\s+to\s+be\s+)?dead)/i,
  /i'?m?\s+(scared\s+)?(they\s+will\s+kill|going\s+to\s+die|going\s+to\s+be\s+killed)/i,
  /i\s+can'?t\s+keep\s+(going|living)\s+(like\s+this|with\s+(this|them|the\s+threats?))/i,
  // Hindi
  /मैं\s*(अब\s*)?(सह\s*नहीं\s*सकत[ाी]|बर्दाश्त\s*नहीं\s*कर\s*सकत[ाी])/,
  /वो\s*(मुझे|मेरे\s*साथ)\s*(मार\s*डालेंगे|कुछ\s*कर\s*डालेंगे)/,
]);

/**
 * All categories with metadata for explainability.
 * Order matters: METHOD_MEANS is checked first (highest urgency).
 */
const CRISIS_CATEGORIES = Object.freeze([
  { code: 'method_means', label: 'Reference to a specific method or means', patterns: METHOD_MEANS, urgency: 'critical' },
  { code: 'explicit_intent', label: 'Explicit statement about ending one\'s life', patterns: EXPLICIT_INTENT, urgency: 'high' },
  { code: 'hopelessness_finality', label: 'Hopelessness combined with finality language', patterns: HOPELESSNESS_FINALITY, urgency: 'high' },
  { code: 'threat_self_context', label: 'Expression of being unable to continue amid ongoing pressure', patterns: THREAT_SELF_CONTEXT, urgency: 'high' },
]);

/**
 * Check a text string against all crisis patterns.
 *
 * @param {string} text — the concatenation of person turns in the check-in
 * @returns {{
 *   triggered: boolean,
 *   category: string|null,
 *   categoryLabel: string|null,
 *   urgency: string|null,
 *   matchedPattern: string|null,
 *   matchedText: string|null
 * }}
 */
export function detectCrisis(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { triggered: false, category: null, categoryLabel: null, urgency: null, matchedPattern: null, matchedText: null };
  }

  const normalised = text.trim();

  for (const { code, label, patterns, urgency } of CRISIS_CATEGORIES) {
    for (const pattern of patterns) {
      const match = normalised.match(pattern);
      if (match) {
        return {
          triggered: true,
          category: code,
          categoryLabel: label,
          urgency,
          matchedPattern: String(pattern),
          matchedText: match[0],
        };
      }
    }
  }

  return { triggered: false, category: null, categoryLabel: null, urgency: null, matchedPattern: null, matchedText: null };
}

/**
 * Run crisis detection on a check-in's turns.
 *
 * @param {Array<{ speaker: string, text: string }>} turns — the conversation
 * @returns {ReturnType<typeof detectCrisis>}
 */
export function detectCrisisInCheckIn(turns) {
  if (!Array.isArray(turns)) return detectCrisis('');
  const personText = turns
    .filter((t) => t.speaker === 'person')
    .map((t) => t.text)
    .join(' ');
  return detectCrisis(personText);
}

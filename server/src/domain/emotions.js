/**
 * Emotion detection — identifies discrete emotions from check-in text.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The problem statement explicitly requires "Emotion AI" and "Sentiment
 * Analysis" as innovation components. The LLM pipeline already produces a
 * sentiment score (0-100), but that's a single number. This module adds
 * discrete emotion detection — identifying specific emotional states like
 * fear, anger, sadness, hopelessness, and fatigue from the person's words.
 *
 * Emotion detection serves two purposes:
 * 1. Richer explainability — a counsellor sees "fear + hopelessness" not
 *    just "score: 65"
 * 2. Better intervention matching — fear triggers safety protocols, anger
 *    triggers mediation, fatigue triggers process support
 *
 * DESIGN
 * -------------------------------------------------------------------------
 * Pattern-based, like crisisDetection.js and fallbackSignals.js. Each emotion
 * maps to regex patterns that detect the emotional state from the person's
 * language. This runs independently of the LLM and works in cached-fallback
 * mode.
 *
 * The emotions are deliberately non-clinical — "sadness" not "depression",
 * "fatigue" not "exhaustion disorder". This module reports emotional signals,
 * never diagnoses.
 */

/**
 * Discrete emotion categories with detection patterns.
 *
 * Each emotion has:
 * - code: stable identifier
 * - label: human-readable name
 * - patterns: regex patterns that detect this emotion
 * - weight: relative intensity (0-1) for scoring
 */
const EMOTION_PATTERNS = Object.freeze({
  fear: {
    code: 'fear',
    label: 'Fear',
    weight: 0.9,
    patterns: [
      /(?:i(?:'m| am)?)\s+(?:scared|afraid|terrified|frightened|nervous|anxious|worried|panicking)/i,
      /(?:feel|feeling)\s+(?:scared|afraid|terrified|frightened|nervous|anxious|worried|unsafe|threatened|intimidated)/i,
      /(?:i(?:'m| am)?)\s+(?:afraid|scared)\s+(?:of|about|that|to)/i,
      /(?:danger|threat|attack|assault|harm|kill|hurt)\s+(?:me|us|my|our)/i,
      /(?:they|someone|people)\s+(?:will|might|could)\s+(?:hurt|harm|attack|kill|threaten)/i,
      /(?:my|our|family|children|kids)\s+(?:is|are|were)?\s*(?:scared|afraid|terrified|frightened)/i,
      // Hindi
      /(?:डर|घबराहट|भय|ख़ौफ़|डरा|सहमा|आशंकित)/,
      /(?:असुरक्षित|ख़तरा|धमकी|ख़तरे)/,
    ],
  },
  anger: {
    code: 'anger',
    label: 'Anger',
    weight: 0.7,
    patterns: [
      /(?:i(?:'m| am)?)\s+(?:angry|furious|frustrated|outraged|livid|mad|annoyed)/i,
      /(?:feel|feeling)\s+(?:angry|furious|frustrated|outraged|livid|mad|annoyed|infuriated)/i,
      /(?:this is|it is)\s+(?:unfair|unjust|wrong|outrageous|disgusting|ridiculous)/i,
      /(?:i(?:'m| am)?)\s+(?:sick\s+of|tired\s+of|done\s+with|fed\s+up\s+with)/i,
      /(?:how\s+(?:dare|can)\s+(?:they|he|she|you))/i,
      // Hindi
      /(?:ग़ुस्सा|क्रोध|नाराज़|बौखलाहट|तकलीफ़देह|बेहद\s+ग़ुस्सा)/,
      /(?:अन्याय|ग़ैर-क़ानूनी|ग़लत|बेशर्म)/,
    ],
  },
  sadness: {
    code: 'sadness',
    label: 'Sadness',
    weight: 0.6,
    patterns: [
      /(?:i(?:'m| am)?)\s+(?:sad|unhappy|miserable|dejected|down|low|heartbroken|grief|grieving)/i,
      /(?:feel|feeling)\s+(?:sad|unhappy|miserable|dejected|down|low|empty|numb|lost)/i,
      /(?:i(?:'m| am)?)\s+(?:crying|tears|tearful|weeping)/i,
      /(?:nothing\s+(?:makes\s+me|brings|interests|excites|matters))/i,
      /(?:i\s+miss)\s+(?:my|the|our|home|family|old\s+life)/i,
      // Hindi
      /(?:दुखी|उदास|ग़मगीन|अफ़सोस|रोना|आँसू|बेचैनी)/,
      /(?:कुछ\s+अच्छा\s+नहीं\s+लगता|मन\s+नहीं\s+लगता)/,
    ],
  },
  hopelessness: {
    code: 'hopelessness',
    label: 'Hopelessness',
    weight: 0.85,
    patterns: [
      /(?:there(?:'s| is)\s+)?no\s+(?:point|reason|hope|use|sense)\s+(?:in|anymore)?/i,
      /nothing\s+(?:will|would|is\s+going\s+to|ever)?\s*(?:change|improve|get\s+better|work|matter)/i,
      /i\s+(?:don'?t|do\s+not)\s+(?:see\s+(?:a\s+)?point|think\s+(?:anything|it)\s+will\s+(?:change|improve|get\s+better))/i,
      /i\s+(?:can'?t|cannot)\s+(?:go\s+on|take\s+this|do\s+this|keep\s+going|continue)\s+(?:anymore|any\s+longer)/i,
      /(?:give|giving)\s+up/i,
      /(?:waste\s+of\s+time|time(?:'s)?\s+(?:wasted|wasting))/i,
      // Hindi
      /(?:कुछ\s+नहीं\s+बदलेगा|कोई\s+फ़ायदा\s+नहीं|बेकार|व्यर्थ)/,
      /(?:हिम्मत\s+नहीं\s+बची|और\s+नहीं\s+हो\s+पाएगा)/,
    ],
  },
  fatigue: {
    code: 'fatigue',
    label: 'Fatigue',
    weight: 0.5,
    patterns: [
      /(?:i(?:'m| am)?)\s+(?:so\s+)?(?:tired|exhausted|drained|worn\s+out|burned?\s*out|fatigued)/i,
      /(?:feel|feeling)\s+(?:tired|exhausted|drained|worn\s+out|burned?\s*out|fatigued|weak)/i,
      /(?:i(?:'m| am)?)\s+(?:so\s+)?(?:tired|exhausted|done)\s+(?:of|with|from|\b)/i,
      /(?:i\s+can'?t)\s+(?:take\s+this|do\s+this|keep\s+going|anymore)/i,
      /(?:i(?:'m| am)?)\s+(?:not\s+)?(?:sleeping\s+well|able\s+to\s+sleep)/i,
      /(?:i(?:'m| am)?)\s+\w+\s+(?:tired|exhausted|done)\b/i,
      // Hindi
      /(?:थका\s+हुआ|थक\s+गया|थकावट|बोरियत|ऊर्जा\s+नहीं|ताक़त\s+नहीं)/,
      /(?:नींद\s+नहीं\s+आती|सो\s+नहीं\s+पाता)/,
    ],
  },
  withdrawal: {
    code: 'withdrawal',
    label: 'Withdrawal',
    weight: 0.65,
    patterns: [
      /i\s+(?:don'?t|do\s+not)\s+(?:want\s+to|feel\s+like|feel\s+like\s+i)\s+(?:talk|speak|discuss|share|answer|respond|reply|continue|participate)/i,
      /i\s+(?:want\s+to|'d\s+like\s+to)\s+(?:stop|end|discontinue|cancel)\s+(?:these\s+)?(?:check[\s-]?ins|messages|calls)/i,
      /i\s+(?:need|want)\s+(?:some\s+)?(?:space|time\s+alone|privacy|fewer\s+messages)/i,
      /please\s+(?:reduce|less\s+frequent|fewer)\s+(?:check[\s-]?ins|messages)/i,
      /i\s+(?:'?m?\s+)?(?:not\s+)?(?:interested|engaged|connected|participating)/i,
      // Hindi
      /(?:बात\s+नहीं\s+करना|संपर्क\s+कम|दूरी|अलग)/,
    ],
  },
});

/**
 * Detect emotions from a text string.
 *
 * @param {string} text — the concatenation of person turns
 * @returns {{ emotions: Array<{ code: string, label: string, intensity: number, matchedText: string }>, primaryEmotion: string|null }}
 */
export function detectEmotions(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { emotions: [], primaryEmotion: null };
  }

  const normalised = text.trim();
  const detected = [];

  for (const [key, emotion] of Object.entries(EMOTION_PATTERNS)) {
    for (const pattern of emotion.patterns) {
      const match = normalised.match(pattern);
      if (match) {
        detected.push({
          code: emotion.code,
          label: emotion.label,
          intensity: emotion.weight,
          matchedText: match[0].trim().slice(0, 100),
        });
        break; // One match per emotion is enough
      }
    }
  }

  // Sort by intensity (strongest first)
  detected.sort((a, b) => b.intensity - a.intensity);

  return {
    emotions: detected,
    primaryEmotion: detected.length > 0 ? detected[0].code : null,
  };
}

/**
 * Detect emotions from a check-in's turns.
 *
 * @param {Array<{ speaker: string, text: string }>} turns
 * @returns {ReturnType<typeof detectEmotions>}
 */
export function detectEmotionsInCheckIn(turns) {
  if (!Array.isArray(turns)) return detectEmotions('');
  const personText = turns
    .filter((t) => t.speaker === 'person')
    .map((t) => t.text)
    .join(' ');
  return detectEmotions(personText);
}

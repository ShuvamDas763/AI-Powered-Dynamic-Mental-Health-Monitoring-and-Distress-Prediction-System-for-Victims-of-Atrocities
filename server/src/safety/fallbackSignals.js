/**
 * Pattern-based signal detection for cached-fallback mode.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * When the LLM is unavailable (no API key, network failure, forced fallback),
 * the analysis pipeline returns empty signals[] and a fixed sentiment. This
 * means a person saying "I feel like I'm under someone's watch" gets the same
 * reading as someone saying "things are fine" — the system is blind to the
 * content of what they wrote.
 *
 * This module runs the same pattern-based architecture as crisisDetection.js:
 * regex patterns matched against the person's text, producing the same signal
 * codes the LLM would report. It is deliberately conservative — matching clear,
 * unambiguous phrases rather than attempting to cover every possible phrasing.
 * A missed pattern in fallback mode means a signal is lost until the next live
 * LLM call; a false pattern match means a counsellor sees a signal that may not
 * apply — the human reviews either way, and the latter is the safer direction.
 *
 * DESIGN
 * -------------------------------------------------------------------------
 * Each signal code maps to an array of case-insensitive regex patterns. A match
 * on ANY pattern for a signal activates that signal. The detector also returns
 * matched phrases (for the explainability panel) and a fallback sentiment
 * reading based on the strongest detected signal.
 *
 * This module is ONLY used by the cached-fallback path. When a live model is
 * available, the LLM's own reading takes precedence — the model sees context
 * and nuance that regex cannot.
 */

import { SIGNAL } from '../domain/escalation.js';

/**
 * Pattern categories — one per signal code.
 *
 * Phrased as observable language patterns: "being watched", "followed",
 * "approached about the matter" — matching the LLM prompt's own definitions.
 *
 * Hindi patterns use substring matching (no \b) because JavaScript's \b
 * does not work with Devanagari characters.
 */
const SIGNAL_PATTERNS = Object.freeze({
  [SIGNAL.INTIMIDATION]: [
    /(?:feel|feeling|am|'m)\s+(?:like\s+)?(?:i(?:'m| am)?\s+)?(?:being\s+)?(?:watched|followed|tracked|observed|monitored|kept\s+an\s+eye\s+on)/i,
    /(?:someone|somebody|they|people)\s+(?:is|are|'s)?\s*(?:watching|following|tracking|monitoring|keeping\s+(?:an\s+)?eye\s+on)\s+(?:me|us)/i,
    /under\s+(?:someone'?s?\s+)?(?:watch|surveillance|observation)/i,
    /(?:feel|feeling)\s+(?:unsafe|threatened|intimidated|scared|afraid|nervous)\s+(?:when|because|around|near|about)/i,
    /(?:being\s+)?approached\s+(?:about|regarding|concerning)\s+(?:the\s+)?(?:case|matter|incident|complaint)/i,
    /(?:they|someone)\s+(?:came|comes|showed?\s+up)\s+(?:to|near|around)\s+(?:ask|talk|speak)\s+(?:about|regarding)\s+me/i,
    /(?:they|someone|people)\s+(?:keep|keeps)\s+(?:showing\s+up|coming\s+around|coming\s+near|appearing)\s+(?:near|around|by|outside|at)\s+(?:my|the|our)/i,
    /(?:keep|keeps)\s+(?:showing\s+up|coming\s+around|appearing)\s+(?:near|around|by|outside)/i,
    /(?:scared|afraid|frightened|nervous|terrified)\s+to\s+(?:go|leave|walk|travel|be\s+alone|go\s+alone)/i,
    /(?:stopped|can'?t|cannot|unable\s+to)\s+(?:go\s+out|go\s+alone|leave|travel|walk|move\s+freely)/i,
    // Fear of assault / violence from others
    /i\s+(will|would|might|could)\s+(get|be)\s+(assault(?:ed|ing)?|assulat(?:ed)?|attacked|beaten|hurt|harmed|raped)/i,
    /i(?:'m|\s+am)\s+(scared|afraid|terrified|frightened|worried)\s+(that\s+)?(they|someone|he|she|people)\s+(will|might|could|is\s+going\s+to)\s+(assault|attack|beat|hurt|harm|kill|rape|come\s+after)/i,
    /i(?:'m|\s+am)\s+(scared|afraid|terrified|frightened|worried)\s+(to\s+go|about\s+going|of\s+going|when\s+i\s+go|if\s+i\s+go)\s+(out|outside|home|there|to\s+(the|work|market|school|hearing|court))/i,
    /(?:i\s+)?(?:don'?t|do\s+not)\s+(feel\s+)?(safe|secure|protected)\s+(going|when|i\s+go|to\s+go|about|outside|out)/i,
    /i\s+feel\s+(unsafe|insecure|threatened|intimidated|scared|afraid|terrified)\s+(when|if|because|about|going|to\s+go|if\s+i)/i,
    /i\s+(will|might|could)\s+(get\s+)?(assault(?:ed|ing)?|assulat(?:ed)?|attacked|beaten|hurt|harmed|raped)\s+(again|if|i|when|by|because)/i,
    /someone\s+(threatened|threatens)\s+(me\s+(if|when|because)|to\s+)?(assault|attack|beat|hurt|harm|kill|rape|come\s+after)/i,
    /they\s+(threatened|threaten)\s+(to\s+)?(assault|attack|beat|hurt|harm|kill|rape|come\s+after)/i,
    /i(?:'m|\s+am)\s+(scared|afraid|terrified)\s+(they|someone)\s+(will|might|could)\s+(come\s+to|come\s+for|find|show\s+up|attack|hurt)/i,
    /i\s+(won'?t|will\s+not|can'?t|cannot)\s+(go\s+out|leave|go\s+alone|go\s+to|travel|walk)\s+(because|since|as|if|scared|afraid|terrified)/i,
    /(?:afraid|scared|terrified)\s+(to\s+go|of\s+going)\s+(out|outside|there|to\s+(the|work|court|hearing))/i,
    /(?:afraid|scared|terrified|worried)\s+.*(?:go|leave|travel|walk|appear|attend|testify|hearing|court)/i,
    /(?:go|leave|travel|walk|appear|attend|testify|hearing|court).*(?:afraid|scared|terrified|worried)/i,
    /(?:afraid|scared|terrified|worried)\s+(?:because|if|when|that).*(?:assault|attack|hurt|harm|threat|danger|unsafe)/i,
    /someone\s+(?:threatened|warned|told).*(?:testify|go|appear|speak|talk|report|complain)/i,
    // Hindi equivalents
    /(?:देख|रहा|रही|रहे).*(?:है|हू[ँै]|मुझे)/,
    /मुझे\s*(?:लगता\s*है|परेशानी|डर).*(?:कोई|वो|वह|ये).*(?:देख|रहा|रही)/,
    /(?:पीछा|निगरानी|देख\s*रह)/,
    /(?:मुझे|मैं).*(?:डर|भय|घबराहट).*(?:बाहर|निकल|जाना|निकलना)/,
    /(?:बाहर|निकल).*(?:डर|भय|घबराहट|परेशानी).*(?:मुझे|मैं)/,
    /(?:मार|पीट|हमला|चोट|नुकसान).*(?:देंगे|करेंगे|होगा)/,
  ],

  // Sleep disturbance / insomnia — often indicates deeper distress
  [SIGNAL.HOPELESSNESS]: [
    /(?:can'?t|cannot|unable\s+to)\s+(?:sleep|rest|relax|calm\s+down)/i,
    /(?:waking\s+up|wake\s+up|wakes\s+up)\s+(?:screaming|crying|in\s+tears|terrified|afraid)/i,
    /(?:nightmares?|bad\s+dreams?|reliving|replaying)\s+(?:again|every|all|keeps?|still)/i,
    /(?:there'?s?\s+)?no\s+(?:point|reason|sense|hope|use)\s+(?:in|anymore)?/i,
    /nothing\s+(?:will|would|is\s+going\s+to|ever)?\s*(?:change|improve|get\s+better|work|matter)/i,
    /(?:i\s+)?(?:don'?t|do\s+not)\s+(?:see\s+(?:a\s+)?point|think\s+(?:anything|it)\s+will\s+(?:change|improve|get\s+better))/i,
    /(?:i\s+)?(?:can'?t|cannot)\s+(?:go\s+on|take\s+this|do\s+this|keep\s+going|continue)\s+(?:anymore|any\s+longer)/i,
    /(?:i\s+)?(?:don'?t|do\s+not)\s+(?:want\s+to|feel\s+like)\s+(?:go\s+on|continue|keep\s+going|try)/i,
    /(?:no\s+)?(?:point|hope)\s+(?:in\s+)?(?:going\s+on|continuing|living|trying|anything)/i,
    /(?:give|giving)\s+up/i,
    /(?:waste\s+of\s+time|time(?:'s)?\s+(?:wasted|wasting))/i,
    // Wanting to disappear / self-erasure
    /(?:want|wishing|wish)\s+to\s+(?:disappear| vanish|die|not\s+exist|end\s+(?:it|everything|my\s+life))/i,
    /(?:just\s+)?(?:want|need|wishing)\s+(?:to\s+)?(?:disappear|disappear\s+forever)/i,
    // Hindi equivalents
    /कुछ\s*(?:बदलने\s*वाला|नहीं\s*बदलेगा|मायने\s*नहीं\s*रखता|नहीं\s*होगा)/,
    /कोई\s*(?:फ़ायदा|मतलब|उपयोग|मायने)\s*नहीं/,
  
    /(?:feel|feeling)s+(?:numb|empty|hollow|deads+inside|disconnected)/i,
    /(?:feel|feeling)\s+(?:numb|empty|hollow|dead\s+inside|disconnected)/i,],

  [SIGNAL.DISENGAGEMENT]: [
    /(?:i\s+)?(?:don'?t|do\s+not)\s+(?:want\s+to|feel\s+like|feel\s+like\s+i)\s+(?:talk|speak|discuss|share|answer|respond|reply|continue|participate)/i,
    /(?:i\s+)?(?:want\s+to|'d\s+like\s+to)\s+(?:stop|end|discontinue|cancel)\s+(?:these\s+)?(?:check[\s-]?ins|messages|calls|contacts|conversations)/i,
    /(?:i\s+)?(?:need|want)\s+(?:some\s+)?(?:space|time\s+alone|privacy|fewer\s+messages)/i,
    /(?:please\s+)?(?:reduce|less\s+frequent|fewer)\s+(?:check[\s-]?ins|messages|calls|contacts)/i,
    /(?:i\s+)?(?:'?m?\s+)?(?:managing|fine|okay|alright|ok)\s*,?\s*(?:nothing\s+)?(?:else|to\s+say|more)/i,
    // Sexual assault specific — not wanting to talk about what happened
    /(?:don'?t|do\s+not)\s+want\s+to\s+(?:talk|speak|discuss|share)\s+(?:about|regarding)\s+(?:what|it|that|this|the\s+incident|the\s+case|happened)/i,
    /(?:can'?t|cannot)\s+(?:talk|speak|discuss|share)\s+(?:about|regarding)\s+(?:what|it|that|this|happened)/i,
    // Feeling dirty, broken, ashamed
    /(?:feel|feeling)\s+(?:dirty|broken|ashamed|worthless|like\s+(?:a\s+)?(?:failure|burden))/i,
    /(?:i\s+)?(?:am|'m)\s+(?:so\s+)?(?:ashamed|dirty|broken|worthless)/i,
    // Hindi equivalents
    /बात\s*(?:नहीं\s*करना|बंद\s*कर)/,
    /(?:कम\s*संपर्क|ज़्यादा\s*बात\s*नहीं)/,
    /(?:शर्मिंदा|गंदा|टूटा\s*हुआ|बेकार)/,
  

    // Self-care decline and emotional numbness
    /(?:not\s+eating\s+properly|haven't\s+been\s+eating|stopped\s+eating)/i,
    /(?:sit(?:ting)?|staying?)\s+(?:in\s+)?(?:my|the)?\s*(?:room|house|home)\s+(?:all\s+)?day/i,
    /(?:i\s+feel|feeling)\s+(?:numb|empty|hollow|dead\s+inside|disconnected)/i,
    /(?:can'?t|cannot)\s+(?:eat|sleep|concentrate|focus|function)/i,
    /(?:haven't|have\s+not)\s+been\s+(?:eating|sleeping|going\s+out)/i,],

  [SIGNAL.SOCIAL_ISOLATION]: [
    /(?:people|neighbours|neighbors|community|family|friends|relatives)\s+(?:have|has|are|'?re)?\s*(?:stopped|avoiding|avoided|ignoring|ignored|excluding|excluded|distancing|distant|left|leaving)/i,
    /(?:nobody|no\s+one|no\s+one)\s+(?:will|wants?\s+to|talks?\s+to|speaks?\s+to|answers|answers?\s+the\s+phone)/i,
    /(?:nobody|no\s+one)\s+(?:in\s+)?(?:my|the|our)?\s*(?:village|community|family|area|neighborhood|town)\s+(?:talks?\s+to|speaks?\s+to|interacts?\s+with|visits?)/i,
    /(?:everyone|people|they)\s+(?:all\s+)?(?:think|thinks|believe|believes|say|says)\s+(?:i|i'm)\s+(?:caused|causing|trouble|problem|issues)/i,
    /(?:been|being|feel|feeling)\s+(?:avoided|excluded|isolated|alone|lonely|left\s+out|shunned)/i,
    /(?:they|people)\s+(?:don'?t|do\s+not)\s+(?:come|visit|talk|speak|interact|play)\s+(?:with|anymore)/i,
    // Understanding / empathy gaps
    /(?:nobody|no\s+one)\s+(?:understands?|gets?\s+it|knows?|believes?|cares?)/i,
    /(?:everyone|people)\s+(?:don'?t|do\s+not)\s+(?:understand|get\s+it|know)/i,
    // Hindi equivalents
    /(?:लोग|पड़ोसी|घर\s*वाले|परिवार).*(?:बात\s*नहीं|दूरी|अलग|अकेला|बचते|छोड़)/,
    /(?:अकेला|एकांत|कोई\s*नहीं\s*बोलता)/,
  ],

  [SIGNAL.PROCESS_FATIGUE]: [
    /(?:tired|exhausted|worn\s+down|drained|fed\s+up|sick\s+of|tired\s+of)\s+(?:of|with|from)?\s*(?:the\s+)?(?:delays?|adjournments?|visits?|waiting|court|appearances?|running\s+(?:around|errands)|process)/i,
    /(?:another|yet\s+another)\s+(?:adjournment|postponement|delay|hearing\s+date\s+(?:moved|changed|cancelled))/i,
    /(?:no\s+)?(?:date|hearing|update|news|progress|movement|response)\s+(?:yet|still|fixed|set|came|arrived|received)/i,
    /(?:have\s+to|had\s+to|need\s+to)\s+(?:take|miss)\s+(?:another\s+)?(?:day|time|work|off)\s+(?:off|for|from)\s+(?:the\s+)?(?:hearing|court|visit|office)/i,
    /(?:been\s+going|going)\s+(?:in|there)\s+(?:for|since)\s+(?:months?|years?|a\s+long\s+time)/i,
    /(?:going\s+to\s+court|going\s+(?:in|there)\s+(?:for|to))\s+(?:the\s+)?(?:third|fourth|fifth|\d+th)\s+(?:time|visit|appearance)/i,
    /(?:i(?:'m|\s+am)|feeling)\s+(?:so\s+)?(?:tired|exhausted|drained|worn\s+out|burned?\s+out)\b/i,
    // Hindi equivalents
    /(?:थक\s*गया|थक\s*गई|थक\s*गए|थकान|थकावट|बोरियत)/,
    /(?:फ़िर\s*से|दोबारा|हर\s*बार)\s*(?:जाना|चक्कर|आना|सुनना)/,
    /(?:तारीख|तिथि|सुनवाई).*(?:नहीं\s*मिली|नहीं\s*आई|टल\s*गई|बदल\s*गई|नहीं\s*हुई)/,
    /(?:जाँच|जांच|investigation).*(?:शुरू\s*नहीं|नहीं\s*हुई|नहीं\s*शुरू|अभी\s*तक)/,
    /(?:चिंतित|परेशान|घबराया).*(?:क्या|कभी|क्या\s*होगा|क्या\s*होगी)/,
    /(?:थक\s*गया|थक\s*गई|थक\s*गए|बहुत\s*थक).*(?:हूँ|है|गया|गई)/,
  ],

  [SIGNAL.DEFLECTION]: [
    /(?:i\s+)?(?:am|'m)\s+(?:fine|okay|ok|alright|good|great|nice|well|managing|managing\s+fine|doing\s+well|never\s+better|all\s+good)\b/i,
    /(?:nothing|nothing\s+new|nothing\s+to\s+report|nothing\s+to\s+say|nothing\s+important|nothing\s+worth|nothing\s+much|nothing\s+at\s+all)\s*[.!?]*$/i,
    /(?:there\s+is|there's|there\s+are)\s+nothing\s+to\s+(?:worry|fear|concern|stress|fret)\s+about/i,
    /(?:i'?m?\s+)?(?:totally|completely|absolutely|just|simply)?\s*(?:fine|okay|ok|good|great|all\s+right)\s*[.!?]*$/i,
    /(?:don'?t|do\s+not)\s+(?:want\s+to|feel\s+like|feel\s+like\s+i)\s+(?:talk|think|discuss|dwell)\s+(?:about|on)\s+(?:it|this|that|the\s+case)/i,
    // Hindi equivalents
    /(?:ठीक\s*हूँ|ठीक\s*है|सब\s*ठीक|कोई\s*बात\s*नहीं|कुछ\s*नहीं\s*है)\s*[।!?\s]*$/u,
    /(?:बताने\s*जैसा\s*नहीं|कुछ\s*नया\s*नहीं|कोई\s*नया\s*अपडेट\s*नहीं)/,
  ],

  [SIGNAL.ECONOMIC_PRESSURE]: [
    /(?:money|rent|fees|savings|wages?|salary|income|earnings?|bills?|debt|loan|borrow)\s+(?:is|are|'s|'?re)?\s*(?:tight|low|gone|running\s+out|hard|difficult|strained|tight|an?\s+issue)/i,
    /(?:can'?t|cannot|unable\s+to)\s+(?:afford|pay|manage|cover|keep\s+up)/i,
    /(?:costs?\s+more|extra\s+(?:cost|expense|travel|expense)|spending\s+(?:most|all)\s+of)/i,
    /(?:lost|used\s+up|running\s+out\s+of)\s+(?:my|our|the)?\s*(?:savings?|money|paycheck|wages?)/i,
    /(?:work|job|employment)\s+(?:is|has\s+been)?\s*(?:hard|difficult|lost|gone|cut|reduced)/i,
    /(?:hungry|starving|hunger|food|meals?)\s+(?:is|are|'?s)?\s*(?:a|an|the)?\s*(?:issue|problem|concern|worry)/i,
    /(?:children|kids|family)\s+(?:are|is)?\s*(?:hungry|starving|without|need|lack)/i,
    /(?:lost|burned?|destroyed)\s+(?:my|our|the)?\s*(?:shop|store|home|house|business|livelihood)/i,
    /(?:don'?t|do\s+not)\s+(?:know\s+where|have\s+no\s+idea)\s+(?:to\s+get|where\s+to\s+find|how\s+to\s+(?:get|afford|pay|manage))/i,
    // Hindi equivalents
    /(?:पैसे|पैसा|आमदनी|कमाई|तनख़्वाह).*(?:कम|ख़त्म|तंगी|तंग|मुश्किल|नहीं)/,
    /(?:मज़दूरी|काम).*(?:नुकसान|कमी|नहीं\s*मिला|खो\s*दिया)/,
    /(?:भूखे|भूख|खाना|दाना|रोटी).*(?:बच्चे|बच्चों|परिवार|हम|मेरे)/,
    /(?:दुकान|घर|मकान|व्यापार).*(?:जल\s*गया|खो\s*दिया|तबाह|नष्ट|बर्बाद)/,
    /(?:पैसे|रुपये|कुछ\s*भी\s*नहीं).*(?:नहीं\s*है|ख़त्म|बचा)/,
  ],
});

/**
 * Fallback sentiment adjustments per signal.
 *
 * When no LLM is available, we derive a sentiment reading from the detected
 * signals rather than using the fixed FALLBACK_SENTIMENT of 45. Stronger
 * signals push the reading higher (more concern), keeping it within the
 * range that the rest of the pipeline expects.
 */
const SIGNAL_SENTIMENT_BOOST = Object.freeze({
  [SIGNAL.INTIMIDATION]: 30,
  [SIGNAL.HOPELESSNESS]: 25,
  [SIGNAL.DISENGAGEMENT]: 15,
  [SIGNAL.SOCIAL_ISOLATION]: 20,
  [SIGNAL.PROCESS_FATIGUE]: 10,
  [SIGNAL.DEFLECTION]: 10,
  [SIGNAL.ECONOMIC_PRESSURE]: 15,
});

/**
 * Check a text string against all fallback signal patterns.
 *
 * @param {string} text — the concatenation of person turns in the check-in
 * @returns {{ signals: string[], signalPhrases: string[], fallbackSentiment: number }}
 */
export function detectSignals(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { signals: [], signalPhrases: [], fallbackSentiment: 45 };
  }

  const normalised = text.trim();
  const signals = [];
  const signalPhrases = [];
  let maxBoost = 0;

  for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS)) {
    for (const pattern of patterns) {
      const match = normalised.match(pattern);
      if (match) {
        signals.push(signal);
        // Use the matched text as the signal phrase — same approach as crisisDetection
        const phrase = match[0].trim();
        if (phrase.length > 0 && phrase.length < 120) {
          signalPhrases.push(phrase);
        }
        const boost = SIGNAL_SENTIMENT_BOOST[signal] ?? 0;
        if (boost > maxBoost) maxBoost = boost;
        break; // One match per signal is enough
      }
    }
  }

  // Derive fallback sentiment: base of 35 + strongest signal boost, capped at 95.
  // Lower = more concern, so a strong signal pushes sentiment UP (more concerning).
  const fallbackSentiment = Math.min(95, 35 + maxBoost);

  return { signals: [...new Set(signals)], signalPhrases: [...new Set(signalPhrases)], fallbackSentiment };
}

/**
 * Detect signals from a check-in's turns (same interface as detectCrisisInCheckIn).
 *
 * @param {Array<{ speaker: string, text: string }>} turns
 * @returns {ReturnType<typeof detectSignals>}
 */
export function detectSignalsInCheckIn(turns) {
  if (!Array.isArray(turns)) return detectSignals('');
  const personText = turns
    .filter((t) => t.speaker === 'person')
    .map((t) => t.text)
    .join(' ');
  return detectSignals(personText);
}

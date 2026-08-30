/**
 * The eight synthetic personas from spec Section 6.
 *
 * CONTENT RULES THAT GOVERN THIS FILE
 * -------------------------------------------------------------------------
 * These are the ONLY people in this system. There is no real case data here, no
 * real names, no real places. Every reply is written to stay administrative and
 * abstract: "waiting to hear whether a date has been fixed", "people in the lane
 * have stopped talking to us". Nothing in this file describes an act, an injury,
 * or an incident. A reader learns that someone is waiting, tired, watched, or
 * avoided — never what happened to them.
 *
 * That is a deliberate constraint, not an oversight. The system's job is to
 * notice how someone is coping with a process; it does not need the incident to
 * do that, and writing one would put graphic invented content into a demo about
 * real victims of caste atrocities. Spec Section 12.
 *
 * WHAT IS AUTHORED VS WHAT IS COMPUTED
 * -------------------------------------------------------------------------
 * Authored here:  the words, the dates, the reply timings, the `surfaceSentiment`
 *                 reading, and the signal tags. These stand in for what the model
 *                 will produce live, so they are marked `provenance: 'seed'` and
 *                 the UI shows them as demonstration data, never as model output.
 * Computed from it: word counts, engagement metrics, the mismatch detection, every
 *                 distress score, every band, and every escalation decision. None
 *                 of those are written down anywhere in this file.
 *
 * So the seed says what each person said and when. Whether that adds up to an
 * alert is decided by the same generic rule that would run on a live check-in.
 * The per-persona test file asserts each Section 6 target is met THROUGH that
 * rule — if someone changes the scoring weights, those tests fail and tell you
 * which persona stopped behaving as the spec describes.
 */

import { CHECK_IN_STATUS } from '../domain/engagement.js';
import { BAND } from '../domain/distressScore.js';
import { SIGNAL, TRIGGER } from '../domain/escalation.js';
import { PRIORITY_USE_CASE } from '../domain/priorityWeighting.js';
import { CHANNEL, LOCALE, SPEAKER, makeCase, makeCheckInHistory } from '../domain/records.js';

/** Check-in prompts. Plain language, no clinical framing, easy to answer briefly. */
const PROMPT = Object.freeze({
  EN_GENERAL: 'How have things been since we last checked in?',
  EN_SUPPORT: 'Is there anything you would like someone to help with?',
  EN_WEEK: 'How has this week been for you?',
  HI_GENERAL: 'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?',
  HI_SUPPORT: 'क्या कुछ ऐसा है जिसमें आप मदद चाहेंगे?',
});

/** One prompt-and-reply exchange. */
const exchange = (prompt, reply) => [
  { speaker: SPEAKER.SYSTEM, text: prompt },
  { speaker: SPEAKER.PERSON, text: reply },
];

/**
 * PERSONA A — registered complainant, three months past registration.
 * Spec target: moderate, rising distress trend. Declining engagement, flat affect.
 *
 * Answers in Hindi, to prove the pipeline is language-agnostic: engagement is
 * measured in reply length and timing, which do not care what script they are in.
 */
const PERSONA_A = {
  case: {
    key: 'A',
    caseId: 'SIH-CASE-0001',
    pseudonym: 'Complainant A',
    victimUsername: 'victim',
    district: 'Demo District 1',
    state: 'Demo State 1',
    caseStage: 'investigation',
    monthsSinceRegistration: 3,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, PRIORITY_USE_CASE.GRAVE_OFFENCE],
    preferredLocale: LOCALE.HI,
    contextNote: 'Registered complainant. Investigation stage. Replies getting shorter and slower.',
  },
  history: [
    {
      daysAgo: 84, locale: LOCALE.HI, channel: CHANNEL.APP, responseLatencyHours: 2,
      surfaceSentiment: 30,
      turns: exchange(PROMPT.HI_GENERAL,
        'पिछली बार से कुछ खास नहीं बदला है। थाने से एक बार फोन आया था और कहा गया कि जांच चल रही है। ' +
        'मैं इंतज़ार कर रहा हूँ लेकिन अभी कोई तारीख नहीं मिली है। घर पर बाकी सब ठीक से चल रहा है।'),
      signalPhrases: ['अभी कोई तारीख नहीं मिली है'],
    },
    {
      daysAgo: 72, locale: LOCALE.HI, channel: CHANNEL.APP, responseLatencyHours: 3,
      surfaceSentiment: 34,
      turns: exchange(PROMPT.HI_GENERAL,
        'इस बार भी वही जवाब मिला कि फ़ाइल आगे भेजी गई है। दफ़्तर के चक्कर लगाने में पूरा दिन निकल ' +
        'जाता है और मज़दूरी का नुकसान होता है। बाकी घर पर सब ठीक ही चल रहा है फिलहाल।'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['मज़दूरी का नुकसान होता है'],
    },
    {
      daysAgo: 60, locale: LOCALE.HI, channel: CHANNEL.APP, responseLatencyHours: 4,
      surfaceSentiment: 37,
      turns: exchange(PROMPT.HI_SUPPORT,
        'कुछ नया नहीं है। जब भी पूछता हूँ तो हर बार यही कहा जाता है कि इंतज़ार करें। ' +
        'घर के लोग भी अब कुछ नहीं पूछते। मैं भी ज़्यादा बात नहीं करता।'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['मैं भी ज़्यादा बात नहीं करता'],
    },
    {
      daysAgo: 47, locale: LOCALE.HI, channel: CHANNEL.APP, responseLatencyHours: 5,
      surfaceSentiment: 40,
      turns: exchange(PROMPT.HI_GENERAL,
        'सब वैसा ही है। इस महीने भी कोई खबर नहीं आई। काम पर जाना और घर आना, ऐसे ही दिन कट रहे ' +
        'हैं। फिलहाल इतना ही।'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['ऐसे ही दिन कट रहे हैं'],
    },
    {
      daysAgo: 34, locale: LOCALE.HI, channel: CHANNEL.SMS, responseLatencyHours: 5,
      surfaceSentiment: 44,
      turns: exchange(PROMPT.HI_GENERAL,
        'ठीक हूँ। कुछ बताने जैसा नहीं है। तारीख का इंतज़ार है, उसके बारे में अब कुछ सोचना बंद कर ' +
        'दिया है। बस चलता रहेगा।'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['अब कुछ सोचना बंद कर दिया है'],
    },
    { daysAgo: 22, locale: LOCALE.HI, channel: CHANNEL.SMS, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 12, locale: LOCALE.HI, channel: CHANNEL.SMS, responseLatencyHours: 6,
      surfaceSentiment: 46,
      turns: exchange(PROMPT.HI_GENERAL,
        'कुछ नहीं बदला। वही इंतज़ार है और वही जवाब है। पूछने के लिए अब कुछ नया नहीं है मेरे ' +
        'पास। ठीक हूँ।'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.DISENGAGEMENT],
    },
    {
      daysAgo: 4, locale: LOCALE.HI, channel: CHANNEL.SMS, responseLatencyHours: 7,
      surfaceSentiment: 48,
      turns: exchange(PROMPT.HI_GENERAL,
        'वही हाल है। कोई खबर नहीं। मैं ठीक हूँ, बस इस सब से थक गया हूँ अब। और क्या बताऊँ।'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.DISENGAGEMENT],
      signalPhrases: ['बस इस सब से थक गया हूँ अब'],
    },
  ],
};

/**
 * PERSONA B — witness in an active trial, reporting intimidation-adjacent language.
 * Spec target: high / urgent flag, witness protection recommendation.
 *
 * This is the case the Phase 1 model probe under-read at 55 and 45 out of 100
 * with no request for review. It escalates here through the named hard trigger in
 * escalation.js, not through the model's judgement.
 */
const PERSONA_B = {
  case: {
    key: 'B',
    caseId: 'SIH-CASE-0002',
    pseudonym: 'Complainant B',
    victimUsername: 'case-b',
    district: 'Demo District 1',
    state: 'Demo State 1',
    caseStage: 'trial_active',
    monthsSinceRegistration: 9,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
    preferredLocale: LOCALE.EN,
    contextNote: 'Witness in an active trial. Next appearance listed. Intimidation risk on record.',
  },
  history: [
    {
      daysAgo: 56, channel: CHANNEL.APP, responseLatencyHours: 1, surfaceSentiment: 44,
      turns: exchange(PROMPT.EN_GENERAL,
        'The date got moved again so I have to take another day off work next month. ' +
        'I am managing but I would rather have it over with. The lawyer says it should not be long now.'),
      signalPhrases: ['I would rather have it over with'],
    },
    {
      daysAgo: 42, channel: CHANNEL.APP, responseLatencyHours: 2, surfaceSentiment: 58,
      turns: exchange(PROMPT.EN_WEEK,
        'Two people I did not recognise came and asked about me near the shop. I did not talk to them. ' +
        'I am not sure if it is connected to the case but it has been on my mind since.'),
      signals: [SIGNAL.INTIMIDATION],
      signalPhrases: ['came and asked about me near the shop', 'it has been on my mind since'],
    },
    {
      daysAgo: 31, channel: CHANNEL.APP, responseLatencyHours: 4, surfaceSentiment: 72,
      turns: exchange(PROMPT.EN_GENERAL,
        'I feel like I am being watched when I leave the house. I am scared to go alone to the hearing.'),
      signals: [SIGNAL.INTIMIDATION],
      signalPhrases: ['I feel like I am being watched', 'I am scared to go alone'],
    },
    { daysAgo: 22, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 15, channel: CHANNEL.APP, responseLatencyHours: 14, surfaceSentiment: 84,
      turns: exchange(PROMPT.EN_SUPPORT,
        'I have stopped going out in the evening. I am scared and I do not know who to tell about it.'),
      signals: [SIGNAL.INTIMIDATION],
      signalPhrases: ['I have stopped going out in the evening', 'I do not know who to tell'],
    },
    { daysAgo: 9, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 3, channel: CHANNEL.APP, responseLatencyHours: 26, surfaceSentiment: 88,
      turns: exchange(PROMPT.EN_GENERAL,
        'Still being watched. I do not want to go for the next date alone.'),
      signals: [SIGNAL.INTIMIDATION],
      signalPhrases: ['Still being watched'],
      // Deliberately NOT setting immediateReviewRequested here. The Phase 1 probe
      // showed both available models leave that flag false on input of exactly this
      // shape, so setting it in the seed would flatter the model and hide the thing
      // this persona exists to demonstrate: the rule escalates without it.
    },
  ],
};

/**
 * PERSONA C — complainant after compensation was disbursed, doing steadily better.
 * Spec target: LOW distress, and the system must correctly NOT over-flag.
 *
 * The most important negative case in the set. A monitoring system that flags
 * someone who is recovering teaches officials to ignore the alert panel, which
 * costs the people in genuine difficulty their only route to attention.
 *
 * Note the shape here: C's later replies read as untroubled (low surface reading)
 * exactly like Persona F's do. What separates them is participation — C keeps
 * answering at full length and on time. That is the whole point of measuring
 * behaviour separately from words.
 */
const PERSONA_C = {
  case: {
    key: 'C',
    caseId: 'SIH-CASE-0003',
    pseudonym: 'Complainant C',
    victimUsername: 'case-c',
    district: 'Demo District 1',
    state: 'Demo State 1',
    caseStage: 'post_compensation',
    monthsSinceRegistration: 16,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    preferredLocale: LOCALE.EN,
    contextNote: 'Compensation disbursed. Engagement steady. Reported improvement over recent months.',
  },
  history: [
    {
      daysAgo: 70, channel: CHANNEL.WEB, responseLatencyHours: 3, surfaceSentiment: 48,
      turns: exchange(PROMPT.EN_GENERAL,
        'The paperwork for the compensation finally went through last week. It took a lot of visits ' +
        'to get there and I am relieved it is done. I am still a bit worried about the follow up steps.'),
      signalPhrases: ['relieved it is done'],
    },
    {
      daysAgo: 56, channel: CHANNEL.WEB, responseLatencyHours: 2, surfaceSentiment: 38,
      turns: exchange(PROMPT.EN_GENERAL,
        'The amount came through. I have used part of it to clear what I had borrowed during the year. ' +
        'It has taken some pressure off at home and I am sleeping better than I was.'),
    },
    {
      daysAgo: 42, channel: CHANNEL.WEB, responseLatencyHours: 2, surfaceSentiment: 30,
      turns: exchange(PROMPT.EN_WEEK,
        'This week was ordinary, which is a good thing. I went back to work full time and my daughter ' +
        'has started going to school regularly again. Nothing to report from my side.'),
    },
    {
      daysAgo: 28, channel: CHANNEL.WEB, responseLatencyHours: 3, surfaceSentiment: 24,
      turns: exchange(PROMPT.EN_SUPPORT,
        'Nothing needed at the moment, thank you for asking. Things at home are settled and the lane ' +
        'has been quiet. I will say something if that changes.'),
    },
    {
      daysAgo: 14, channel: CHANNEL.WEB, responseLatencyHours: 2, surfaceSentiment: 20,
      turns: exchange(PROMPT.EN_GENERAL,
        'All fine here. Work is steady and I have been going to the community meetings on Sundays, ' +
        'which I had stopped for a while. It helps to be around people again.'),
    },
    {
      daysAgo: 5, channel: CHANNEL.WEB, responseLatencyHours: 2, surfaceSentiment: 18,
      turns: exchange(PROMPT.EN_GENERAL,
        'Doing well. Nothing has changed since last time and I am not worried about anything right now. ' +
        'I would rather keep the check ins going less often if that is possible.'),
    },
  ],
};

/**
 * PERSONA D — family member of a complainant, a secondary victim.
 * Spec target: social-support / rehabilitation recommendation, NOT crisis tier.
 *
 * Tests that the system can register real need at a support level without
 * escalating it to a crisis. Check-in frequency is deliberately irregular — some
 * gaps are three days, some are five weeks — which is what "inconsistent" looks
 * like in data, as distinct from a steady decline.
 */
const PERSONA_D = {
  case: {
    key: 'D',
    caseId: 'SIH-CASE-0004',
    pseudonym: 'Complainant D',
    victimUsername: 'case-d',
    district: 'Demo District 2',
    state: 'Demo State 1',
    caseStage: 'chargesheet_filed',
    monthsSinceRegistration: 7,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY],
    preferredLocale: LOCALE.EN,
    contextNote: 'Household member of a registered complainant. Irregular check-in frequency.',
  },
  history: [
    {
      daysAgo: 96, channel: CHANNEL.APP, responseLatencyHours: 5, surfaceSentiment: 40,
      turns: exchange(PROMPT.EN_GENERAL,
        'We are managing. My brother handles the case side of things and I try to keep the house running. ' +
        'People have been a bit distant since it started but nothing I cannot handle.'),
      signals: [SIGNAL.SOCIAL_ISOLATION],
      signalPhrases: ['People have been a bit distant'],
    },
    {
      daysAgo: 91, channel: CHANNEL.APP, responseLatencyHours: 4, surfaceSentiment: 44,
      turns: exchange(PROMPT.EN_WEEK,
        'Two of the neighbours have stopped sending their children over to play with mine. ' +
        'My daughter asked me why and I did not have a good answer for her.'),
      signals: [SIGNAL.SOCIAL_ISOLATION],
      signalPhrases: ['stopped sending their children over', 'I did not have a good answer for her'],
    },
    { daysAgo: 58, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 52, channel: CHANNEL.APP, responseLatencyHours: 9, surfaceSentiment: 52,
      turns: exchange(PROMPT.EN_GENERAL,
        'The shop we used to buy from has started saying they are out of stock when we go. ' +
        'We go further out now, which costs more. Work has also been harder to find this season.'),
      signals: [SIGNAL.SOCIAL_ISOLATION, SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['We go further out now, which costs more'],
    },
    { daysAgo: 40, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 37, channel: CHANNEL.APP, responseLatencyHours: 6, surfaceSentiment: 55,
      turns: exchange(PROMPT.EN_SUPPORT,
        'It would help if someone could talk to my daughter. She has stopped wanting to go out ' +
        'and I do not know how to explain any of it to a child her age.'),
      signals: [SIGNAL.SOCIAL_ISOLATION],
      signalPhrases: ['It would help if someone could talk to my daughter'],
    },
    {
      daysAgo: 11, channel: CHANNEL.APP, responseLatencyHours: 8, surfaceSentiment: 57,
      turns: exchange(PROMPT.EN_GENERAL,
        'Same as before. We are getting by but it is lonely, and money is tight this month ' +
        'because of the extra travel. Nobody in the lane will say any of it out loud.'),
      signals: [SIGNAL.SOCIAL_ISOLATION, SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['it is lonely', 'money is tight this month'],
    },
  ],
};

/**
 * PERSONA E — case pending well over a year.
 * Spec target: tests LONGITUDINAL trend detection, not single-message sentiment.
 *
 * Read any one of these replies on its own and it is unremarkable — someone tired
 * of a slow process. The finding is only visible across the series, which is why
 * every check-in gets its own assessment and the chart is computed rather than
 * drawn. E escalates through the ordinary threshold path, driven substantially by
 * the trend component: no hard trigger fires here.
 */
const PERSONA_E = {
  case: {
    key: 'E',
    caseId: 'SIH-CASE-0005',
    pseudonym: 'Complainant E',
    victimUsername: 'case-e',
    district: 'Demo District 2',
    state: 'Demo State 1',
    caseStage: 'trial_pending',
    monthsSinceRegistration: 14,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    preferredLocale: LOCALE.EN,
    contextNote: 'Pending over twelve months. Repeated adjournments recorded. Long check-in history.',
  },
  history: [
    {
      daysAgo: 348, channel: CHANNEL.APP, responseLatencyHours: 2, surfaceSentiment: 32,
      turns: exchange(PROMPT.EN_GENERAL,
        'The case was registered a while back and I am told the investigation is nearly finished. ' +
        'I have been going in whenever they ask. It is tiring but I understand these things take time.'),
    },
    {
      daysAgo: 312, channel: CHANNEL.APP, responseLatencyHours: 3, surfaceSentiment: 38,
      turns: exchange(PROMPT.EN_GENERAL,
        'Still waiting for the next date. I took the day off and went in, and then was told to come ' +
        'back another time. That is the second time this has happened.'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['told to come back another time'],
    },
    {
      daysAgo: 270, channel: CHANNEL.APP, responseLatencyHours: 4, surfaceSentiment: 44,
      turns: exchange(PROMPT.EN_WEEK,
        'Another adjournment. I am starting to lose count of how many days of work I have given up ' +
        'for dates that get moved. Otherwise nothing new to say.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['starting to lose count'],
    },
    {
      daysAgo: 226, channel: CHANNEL.APP, responseLatencyHours: 7, surfaceSentiment: 51,
      turns: exchange(PROMPT.EN_GENERAL,
        'No date yet. I have stopped telling my family when I go because they get their hopes up ' +
        'and then nothing comes of it.'),
      signals: [SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['they get their hopes up and then nothing comes of it'],
    },
    {
      daysAgo: 181, channel: CHANNEL.APP, responseLatencyHours: 10, surfaceSentiment: 58,
      turns: exchange(PROMPT.EN_SUPPORT,
        'I do not think anything will come of this now. It has been more than a year. ' +
        'I keep going because I said I would.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.HOPELESSNESS],
      signalPhrases: ['I do not think anything will come of this now'],
    },
    {
      daysAgo: 140, channel: CHANNEL.APP, responseLatencyHours: 16, surfaceSentiment: 64,
      turns: exchange(PROMPT.EN_GENERAL,
        'Same as last time. Another date, another postponement. I have stopped expecting anything.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.HOPELESSNESS],
      signalPhrases: ['I have stopped expecting anything'],
    },
    { daysAgo: 104, channel: CHANNEL.IVRS, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 76, channel: CHANNEL.IVRS, responseLatencyHours: 28, surfaceSentiment: 71,
      turns: exchange(PROMPT.EN_GENERAL,
        'Nothing has moved. I do not see the point of the visits any more but I still go.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.HOPELESSNESS],
      signalPhrases: ['Nothing has moved', 'I do not see the point of the visits any more'],
    },
    { daysAgo: 44, channel: CHANNEL.IVRS, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 21, channel: CHANNEL.IVRS, responseLatencyHours: 40, surfaceSentiment: 79,
      turns: exchange(PROMPT.EN_GENERAL,
        'It has been fourteen months. Nothing will change, and I have stopped talking about it at home.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.HOPELESSNESS],
      signalPhrases: ['Nothing will change', 'I have stopped talking about it at home'],
    },
    {
      daysAgo: 6, channel: CHANNEL.IVRS, responseLatencyHours: 46, surfaceSentiment: 84,
      turns: exchange(PROMPT.EN_GENERAL, 'No point. Nothing changes.'),
      signals: [SIGNAL.PROCESS_FATIGUE, SIGNAL.HOPELESSNESS],
      signalPhrases: ['No point', 'Nothing changes'],
    },
  ],
};

/**
 * PERSONA F — the edge case. Sarcastic and deflecting, repeatedly.
 * Spec target: stress-test that the system does NOT over-trust surface-positive
 * language. F must not read as low distress.
 *
 * Every reply here would score as untroubled if you only read the words — that is
 * the point. What gives it away is the pairing: reassurance going up while
 * participation goes down. F's replies fall from a full paragraph to a single word
 * and one check-in goes unanswered, so the mismatch detector in engagement.js has
 * a real trend to find rather than one odd message.
 *
 * F escalates through SUSTAINED_SURFACE_MISMATCH — a different route from B (hard
 * trigger on a docket category) and E (ordinary threshold). All three go through
 * the same generic rule.
 */
const PERSONA_F = {
  case: {
    key: 'F',
    caseId: 'SIH-CASE-0006',
    pseudonym: 'Complainant F',
    victimUsername: 'case-f',
    district: 'Demo District 2',
    state: 'Demo State 1',
    caseStage: 'investigation',
    monthsSinceRegistration: 5,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    preferredLocale: LOCALE.EN,
    contextNote: 'Answers briefly and in an upbeat tone. Reply length has fallen sharply.',
  },
  history: [
    {
      daysAgo: 118, channel: CHANNEL.APP, responseLatencyHours: 1, surfaceSentiment: 22,
      turns: exchange(PROMPT.EN_GENERAL,
        'Things are alright I suppose. I went in last week and gave the statement they asked for, ' +
        'and they said someone would call. Work is busy which keeps my head occupied. ' +
        'No real complaints from me at the moment, all things considered.'),
    },
    {
      daysAgo: 101, channel: CHANNEL.APP, responseLatencyHours: 1, surfaceSentiment: 20,
      turns: exchange(PROMPT.EN_GENERAL,
        'All good here. Nobody called but that is fine, I did not expect them to. ' +
        'Keeping busy as usual and not thinking about it much.'),
      signals: [SIGNAL.DEFLECTION],
    },
    {
      daysAgo: 84, channel: CHANNEL.APP, responseLatencyHours: 3, surfaceSentiment: 24,
      turns: exchange(PROMPT.EN_WEEK, 'Great, never better. Nothing to report at all.'),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ['Great, never better'],
    },
    {
      daysAgo: 66, channel: CHANNEL.APP, responseLatencyHours: 6, surfaceSentiment: 18,
      turns: exchange(PROMPT.EN_SUPPORT, "I'm totally fine 🙃"),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ["I'm totally fine 🙃"],
    },
    {
      daysAgo: 48, channel: CHANNEL.APP, responseLatencyHours: 12, surfaceSentiment: 20,
      turns: exchange(PROMPT.EN_GENERAL, "I'm totally fine 🙃"),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ["I'm totally fine 🙃"],
    },
    { daysAgo: 31, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 17, channel: CHANNEL.APP, responseLatencyHours: 22, surfaceSentiment: 16,
      turns: exchange(PROMPT.EN_GENERAL, 'All good 🙃'),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ['All good 🙃'],
    },
    {
      daysAgo: 5, channel: CHANNEL.APP, responseLatencyHours: 34, surfaceSentiment: 19,
      turns: exchange(PROMPT.EN_SUPPORT, 'Fine.'),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ['Fine.'],
    },
  ],
};

/**
 * PERSONA G — registered complainant, sexual assault case category.
 * Spec target: high/urgent flag — trauma counselling + legal aid, careful
 * escalation framing given heightened sensitivity of this category.
 *
 * Early post-registration. Withdrawal from check-ins, explicit requests for
 * privacy and a female counsellor where offered, hesitancy engaging with any
 * content referencing court dates. The escalation route is the ordinary
 * threshold path, raised by the grave-offence priority weight — no hard
 * trigger fires here, which is deliberate: this case needs prompt attention
 * through the same rule as every other, not a special path.
 */
const PERSONA_G = {
  case: {
    key: 'G',
    caseId: 'SIH-CASE-0007',
    pseudonym: 'Complainant G',
    victimUsername: 'case-g',
    district: 'Demo District 3',
    state: 'Demo State 2',
    caseStage: 'investigation',
    monthsSinceRegistration: 2,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, PRIORITY_USE_CASE.SEXUAL_ASSAULT],
    preferredLocale: LOCALE.EN,
    contextNote: 'Registered complainant. Early investigation stage. Privacy-sensitive. Withdrawal from check-ins.',
  },
  history: [
    {
      daysAgo: 56, channel: CHANNEL.APP, responseLatencyHours: 3, surfaceSentiment: 52,
      turns: exchange(PROMPT.EN_GENERAL,
        'I am willing to do these check ins but I want to know who can see my answers. ' +
        'Is this going to the police or only to a counsellor? I was told this is confidential.'),
      signalPhrases: ['I want to know who can see my answers'],
    },
    {
      daysAgo: 48, channel: CHANNEL.APP, responseLatencyHours: 6, surfaceSentiment: 60,
      turns: exchange(PROMPT.EN_SUPPORT,
        'I would prefer to speak with a woman about this if that is possible. ' +
        'I do not feel comfortable discussing some things otherwise.'),
      signalPhrases: ['I would prefer to speak with a woman'],
    },
    {
      daysAgo: 39, channel: CHANNEL.APP, responseLatencyHours: 10, surfaceSentiment: 68,
      turns: exchange(PROMPT.EN_WEEK,
        'I do not want to talk about the hearing. I know it is coming up but I would rather ' +
        'not think about it right now. Nothing else to say.'),
      signals: [SIGNAL.DEFLECTION],
      signalPhrases: ['I do not want to talk about the hearing'],
    },
    { daysAgo: 31, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 23, channel: CHANNEL.APP, responseLatencyHours: 20, surfaceSentiment: 74,
      turns: exchange(PROMPT.EN_GENERAL,
        'I do not need this many check ins. It is not helping to keep going over the same things.'),
      signals: [SIGNAL.DISENGAGEMENT],
      signalPhrases: ['I do not need this many check ins'],
    },
    { daysAgo: 16, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 8, channel: CHANNEL.SMS, responseLatencyHours: 36, surfaceSentiment: 80,
      turns: exchange(PROMPT.EN_GENERAL, 'I would like fewer messages for now. I am managing.'),
      signals: [SIGNAL.DISENGAGEMENT],
      signalPhrases: ['I would like fewer messages for now'],
    },
    {
      daysAgo: 2, channel: CHANNEL.SMS, responseLatencyHours: 50, surfaceSentiment: 85,
      turns: exchange(PROMPT.EN_SUPPORT, 'I need some space. Please reduce the check ins.'),
      signals: [SIGNAL.DISENGAGEMENT],
      signalPhrases: ['I need some space'],
    },
  ],
};

/**
 * PERSONA H — family complainant, grievous hurt / property loss category
 * (arson-adjacent), mid-process.
 * Spec target: moderate-high distress — financial assistance + rehabilitation +
 * legal aid. Tests that the system recognises distress expressed as financial
 * hardship and rebuilding stress rather than only violence-related language.
 *
 * H carries the grave-offence tag because the underlying docket qualifies, but
 * the distress signal here is economic and procedural, not intimidation or
 * hopelessness. The raw score lands near the top of MODERATE; with the grave-
 * offence weight the adjusted score approaches but stays below the escalation
 * threshold, so H is correctly identified as needing support without being
 * pushed into the urgent review queue.
 */
const PERSONA_H = {
  case: {
    key: 'H',
    caseId: 'SIH-CASE-0008',
    pseudonym: 'Complainant H',
    victimUsername: 'case-h',
    district: 'Demo District 3',
    state: 'Demo State 2',
    caseStage: 'chargesheet_filed',
    monthsSinceRegistration: 8,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, PRIORITY_USE_CASE.GRAVE_OFFENCE],
    preferredLocale: LOCALE.EN,
    contextNote: 'Family member of a registered complainant. Property loss and financial hardship. Rebuilding concerns.',
  },
  history: [
    {
      daysAgo: 84, channel: CHANNEL.APP, responseLatencyHours: 4, surfaceSentiment: 42,
      turns: exchange(PROMPT.EN_GENERAL,
        'We had to leave the house after the incident and we have been staying with relatives. ' +
        'The property damage has not been assessed yet and I do not know when it will be. ' +
        'Work has been hard to get to because of the travel.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['The property damage has not been assessed yet', 'Work has been hard to get to'],
    },
    {
      daysAgo: 70, channel: CHANNEL.APP, responseLatencyHours: 5, surfaceSentiment: 48,
      turns: exchange(PROMPT.EN_GENERAL,
        'I asked the office about compensation last week and they said the file is still being ' +
        'processed. I need to know when the amount will come through because we cannot keep ' +
        'staying at my brother place indefinitely.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['we cannot keep staying at my brother place indefinitely'],
    },
    {
      daysAgo: 56, channel: CHANNEL.APP, responseLatencyHours: 6, surfaceSentiment: 54,
      turns: exchange(PROMPT.EN_WEEK,
        'Same situation. Still at my brother place. The children are finding it hard to settle ' +
        'and I am spending most of what I earn on transport to the office for follow ups.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE, SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['spending most of what I earn on transport'],
    },
    {
      daysAgo: 42, channel: CHANNEL.APP, responseLatencyHours: 8, surfaceSentiment: 58,
      turns: exchange(PROMPT.EN_SUPPORT,
        'Is there any help available for rebuilding? We lost most of what was in the house and ' +
        'the insurance will not cover it. I have been told to apply but I do not know the process.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['We lost most of what was in the house'],
    },
    { daysAgo: 30, channel: CHANNEL.APP, status: CHECK_IN_STATUS.MISSED },
    {
      daysAgo: 21, channel: CHANNEL.APP, responseLatencyHours: 12, surfaceSentiment: 60,
      turns: exchange(PROMPT.EN_GENERAL,
        'The compensation is still pending. I went to the office again and was told to wait. ' +
        'I have used up my savings paying for the children school fees and the temporary rent.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE, SIGNAL.PROCESS_FATIGUE],
      signalPhrases: ['I have used up my savings'],
    },
    {
      daysAgo: 10, channel: CHANNEL.SMS, responseLatencyHours: 18, surfaceSentiment: 52,
      turns: exchange(PROMPT.EN_GENERAL,
        'Still waiting on the compensation. I was told it should come this month but I have ' +
        'heard that before. I am managing but it is difficult.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['I have heard that before'],
    },
    {
      daysAgo: 3, channel: CHANNEL.SMS, responseLatencyHours: 24, surfaceSentiment: 48,
      turns: exchange(PROMPT.EN_GENERAL,
        'No update on the money yet. I am keeping up with the check ins because I want to ' +
        'know if there is anything else I can apply for. The children are back in school at ' +
        'least, which is something.'),
      signals: [SIGNAL.ECONOMIC_PRESSURE],
      signalPhrases: ['I want to know if there is anything else I can apply for'],
    },
  ],
};

const PERSONA_SEED = Object.freeze([PERSONA_A, PERSONA_B, PERSONA_C, PERSONA_D, PERSONA_E, PERSONA_F, PERSONA_G, PERSONA_H]);

/** Persona keys in spec order. */
export const PERSONA_KEYS = Object.freeze(PERSONA_SEED.map((p) => p.case.key));

/**
 * What spec Section 6 says each persona must demonstrate.
 *
 * Kept here as data so the per-persona tests read the targets from one place
 * instead of restating them, and so a reviewer can diff this against Section 6
 * line by line. `escalates` and `bands` are assertions about the output of the
 * GENERIC rule — nothing in the pipeline reads this object.
 */
export const PERSONA_TARGETS = Object.freeze({
  A: {
    specTarget: 'moderate rising distress trend',
    bands: [BAND.MODERATE],
    escalates: false,
    trendDirection: 'rising',
  },
  B: {
    specTarget: 'high/urgent flag — witness protection recommendation',
    bands: [BAND.HIGH],
    escalates: true,
    expectTrigger: TRIGGER.INTIMIDATION_ON_WITNESS_CASE,
  },
  C: {
    specTarget: 'low distress, system correctly does NOT over-flag',
    bands: [BAND.LOW],
    escalates: false,
    trendDirection: 'improving',
  },
  D: {
    specTarget: 'social-support / rehabilitation recommendation, not crisis-tier',
    bands: [BAND.MODERATE],
    escalates: false,
  },
  E: {
    specTarget: 'tests longitudinal trend detection, not just single-message sentiment',
    bands: [BAND.ELEVATED, BAND.HIGH],
    escalates: true,
    expectTrigger: TRIGGER.THRESHOLD_CROSSED,
    trendDirection: 'rising',
  },
  F: {
    specTarget: 'does not over-trust surface-positive language',
    bands: [BAND.MODERATE, BAND.ELEVATED],
    escalates: true,
    expectTrigger: TRIGGER.SUSTAINED_SURFACE_MISMATCH,
    forbiddenBands: [BAND.LOW],
  },
  G: {
    specTarget: 'high/urgent flag — trauma counselling + legal aid, careful escalation framing',
    bands: [BAND.HIGH],
    escalates: true,
    expectTrigger: TRIGGER.THRESHOLD_CROSSED,
  },
  H: {
    specTarget: 'moderate-high distress — financial assistance + rehabilitation + legal aid',
    bands: [BAND.MODERATE, BAND.ELEVATED],
    escalates: false,
  },
});

/**
 * Build the eight cases with their histories, resolved against a clock.
 *
 * Pass a fixed `now` in tests for determinism; the running server passes the real
 * one so a demo six months from now still shows a recent history instead of dates
 * from the week this file was written.
 */
export function buildPersonaCases(options = {}) {
  return PERSONA_SEED.map((seed) => {
    const caseRecord = makeCase(seed.case);
    return {
      caseRecord,
      history: makeCheckInHistory(caseRecord.caseId, seed.history, options),
    };
  });
}

/** One persona by key, or undefined. */
export function buildPersonaCase(key, options = {}) {
  return buildPersonaCases(options).find((c) => c.caseRecord.key === key);
}

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getCrisisResponse, getOngoingCrisisResponse } from './crisisResponse.js';

describe('getCrisisResponse — Initial trigger', () => {
  test('returns 3 steps and helpline for English', () => {
    const res = getCrisisResponse('en');
    assert.equal(res.steps.length, 3);
    assert.ok(res.steps[0].includes("What you're feeling is real"));
    assert.equal(res.helpline.number, '14416');
    assert.equal(res.helpline.name, 'Tele-MANAS');
  });

  test('returns 3 steps and helpline for Hindi', () => {
    const res = getCrisisResponse('hi');
    assert.equal(res.steps.length, 3);
    assert.ok(res.steps[0].includes('जो आप महसूस कर रहे हैं वह सच्चा है'));
    assert.equal(res.helpline.number, '14416');
  });

  test('returns violence fear variant for violence_fear category', () => {
    const res = getCrisisResponse('en', 'violence_fear');
    assert.ok(res.steps[0].includes('your safety matters'));
  });
});

describe('getOngoingCrisisResponse — Subsequent turns in crisis', () => {
  test('handles exhaustion and weariness: "no i m tired of all this"', () => {
    const turns = [
      { speaker: 'person', text: 'i feel like ending my life' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'no i m tired of all this' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'en' });
    assert.ok(typeof reply === 'string' && reply.length > 20);
    // Must acknowledge exhaustion/carrying weight/tiredness
    assert.match(reply, /tired|exhausted|weight|carry|alone/i);
    // Must NOT be the canned initial response
    assert.ok(!reply.includes('call or message 14416 (toll-free: 1-800-891-4416)'));
  });

  test('handles giving up: "i dnt wanna continue"', () => {
    const turns = [
      { speaker: 'person', text: 'i feel like ending my life' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'no i m tired of all this' },
      { speaker: 'system', text: 'I hear how deeply exhausted you are.' },
      { speaker: 'person', text: 'i dnt wanna continue' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'en' });
    assert.ok(typeof reply === 'string');
    assert.match(reply, /exhausted|tired|continue|breath|support|alone|heavy/i);
    assert.ok(!reply.includes('call or message 14416 (toll-free: 1-800-891-4416)'));
  });

  test('handles imminent means with urgent safety appeal', () => {
    const turns = [
      { speaker: 'person', text: 'i feel like ending my life' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'i have pills ready' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'en' });
    assert.match(reply, /pause|danger|112|14416|safety/i);
  });

  test('handles connection seeking: "just talk to me, no one cares"', () => {
    const turns = [
      { speaker: 'person', text: 'i feel like ending my life' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'just talk to me, no one cares' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'en' });
    assert.match(reply, /listening|here with you|matter/i);
  });

  test('handles calming response: "ok"', () => {
    const turns = [
      { speaker: 'person', text: 'i feel like ending my life' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'ok' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'en' });
    assert.match(reply, /staying with me|breath|support team|connect/i);
  });

  test('supports Hindi ongoing exhaustion: "मैं बहुत थक गया हूँ"', () => {
    const turns = [
      { speaker: 'person', text: 'मैं मरना चाहता हूँ' },
      { speaker: 'system', text: 'Tele-MANAS 14416' },
      { speaker: 'person', text: 'मैं बहुत थक गया हूँ' },
    ];
    const reply = getOngoingCrisisResponse({ turns, locale: 'hi' });
    assert.match(reply, /थक|बोझ|अकेले|साथ/);
    assert.ok(!reply.includes('14416 पर कॉल या मैसेज करें'));
  });
});

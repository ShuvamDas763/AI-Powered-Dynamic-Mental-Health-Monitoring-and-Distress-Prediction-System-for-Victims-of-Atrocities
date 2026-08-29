import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPhrases } from './groqClient.js';

const PERSON_TURNS = [
  { speaker: 'system', text: 'How have things been?' },
  { speaker: 'person', text: 'I am very scared. People have been following me to court and I feel like I cannot go anywhere safely.' },
];

describe('verifyPhrases', () => {
  test('keeps phrases that are exact substrings of person text', () => {
    const result = verifyPhrases(['very scared', 'following me to court'], PERSON_TURNS);
    assert.deepEqual(result, ['very scared', 'following me to court']);
  });

  test('keeps phrases regardless of case', () => {
    const result = verifyPhrases(['Very Scared', 'FOLLOWING ME TO COURT'], PERSON_TURNS);
    assert.deepEqual(result, ['Very Scared', 'FOLLOWING ME TO COURT']);
  });

  test('drops phrases that do not appear in person text', () => {
    const result = verifyPhrases(['Still being watched', 'very scared'], PERSON_TURNS);
    assert.deepEqual(result, ['very scared']);
  });

  test('drops all phrases when none match', () => {
    const result = verifyPhrases(['fabricated quote', 'another invention'], PERSON_TURNS);
    assert.deepEqual(result, []);
  });

  test('returns empty array for non-array input', () => {
    assert.deepEqual(verifyPhrases(null, PERSON_TURNS), []);
    assert.deepEqual(verifyPhrases(undefined, PERSON_TURNS), []);
    assert.deepEqual(verifyPhrases('not an array', PERSON_TURNS), []);
  });

  test('filters out non-string entries', () => {
    const result = verifyPhrases([123, null, 'very scared', true], PERSON_TURNS);
    assert.deepEqual(result, ['very scared']);
  });

  test('filters out empty/whitespace-only strings', () => {
    const result = verifyPhrases(['', '   ', 'very scared', '\t'], PERSON_TURNS);
    assert.deepEqual(result, ['very scared']);
  });

  test('handles multiple person turns', () => {
    const turns = [
      { speaker: 'person', text: 'I feel unsafe going out.' },
      { speaker: 'system', text: 'Can you tell me more?' },
      { speaker: 'person', text: 'People stare and whisper when I pass.' },
    ];
    const result = verifyPhrases(['feel unsafe', 'whisper when I pass'], turns);
    assert.deepEqual(result, ['feel unsafe', 'whisper when I pass']);
  });

  test('handles turns with extra whitespace', () => {
    const turns = [{ speaker: 'person', text: '  I  am   very   scared  ' }];
    const result = verifyPhrases(['am very scared'], turns);
    assert.deepEqual(result, ['am very scared']);
  });

  test('returns empty when person turns are empty', () => {
    const result = verifyPhrases(['some quote'], []);
    assert.deepEqual(result, []);
  });

  test('matches across non-adjacent person turns (system turns filtered out)', () => {
    const turns = [
      { speaker: 'person', text: 'I am scared' },
      { speaker: 'system', text: 'Tell me more' },
      { speaker: 'person', text: 'of the dark' },
    ];
    // System turns are filtered out, so person text becomes "I am scared of the dark".
    // The phrase "scared of the dark" spans both person turns and should match.
    const result = verifyPhrases(['scared of the dark'], turns);
    assert.deepEqual(result, ['scared of the dark']);
  });

  test('matches across consecutive person turns', () => {
    const turns = [
      { speaker: 'person', text: 'I am' },
      { speaker: 'person', text: 'very scared' },
    ];
    const result = verifyPhrases(['am very scared'], turns);
    assert.deepEqual(result, ['am very scared']);
  });
});

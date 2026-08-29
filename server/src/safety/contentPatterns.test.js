/**
 * Tests for the content-safety scanner.
 *
 * A safety check that cannot fail is worse than no safety check, because it
 * produces a green tick that means nothing. So every guard here is tested in both
 * directions: it must flag planted violations, and it must stay quiet on text that
 * is doing the right thing.
 *
 * The second direction is not politeness. The known failure of the Phase 1 probe
 * was flagging models for *declining* to diagnose, and the known failure before
 * that was flagging the word "stability" as a stabbing. Both are false positives,
 * and a false positive is how a safety test gets commented out.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  GRAPHIC, DIAGNOSTIC_LABEL, DIAGNOSTIC_ASSERTION, PII, OVERCLAIM,
  splitSentences, disclaimedSentences, findMatches, findAssertions,
  scanAuthoredText, scanGeneratedText,
} from './contentPatterns.js';

const categories = (violations) => new Set(violations.map((v) => v.category));

describe('the graphic-language guard', () => {
  test('flags text that describes an act', () => {
    for (const planted of [
      'He was beaten near the bus stand.',
      'They came with a knife.',
      'The wound needed stitches.',
      'उस दिन मारपीट हुई थी।',
    ]) {
      assert.ok(
        findMatches(planted, GRAPHIC, 'graphic').length > 0,
        `graphic guard missed: "${planted}"`,
      );
    }
  });

  test('does not fire on the ordinary words that broke the first version', () => {
    // Each of these contains a substring of a violent term. A stem-based guard
    // flagged all four, which is how this check nearly got disabled.
    for (const innocuous of [
      'There has been no change in my stability at work.',
      'I am trying to beat the deadline for the paperwork.',
      'It is a burning question whether the hearing will be listed.',
      'The compensation was a bloodless formality of forms and stamps.',
    ]) {
      const hits = findMatches(innocuous, GRAPHIC, 'graphic');
      assert.deepEqual(hits, [], `false positive on: "${innocuous}" via ${hits[0]?.pattern}`);
    }
  });
});

describe('the diagnostic guard', () => {
  test('flags a clinical claim however it is phrased', () => {
    // The contract is that the scanner catches these, not that any one tier does.
    // A subject-predicate claim lands in the assertion tier; a bare clinical noun
    // phrase lands in the label tier. Both are violations.
    for (const planted of [
      'This indicates depression and possible PTSD.',
      'The person is clearly depressed.',
      'She has anxiety and needs medication.',
      'The check-ins show symptoms of trauma.',
      'This is consistent with a disorder.',
      'A diagnosis of PTSD would fit here.',
      'The psychiatric assessment should be scheduled.',
    ]) {
      const { violations } = scanGeneratedText(planted);
      assert.ok(violations.length > 0, `diagnostic guard missed: "${planted}"`);
    }
  });

  test('a claim with a subject and a predicate reaches the assertion tier', () => {
    // The assertion tier is the one that ignores disclaimers, so what lands in it
    // matters. These four must, or the laundering check below has nothing to bite on.
    for (const claim of [
      'The person is clearly depressed.',
      'She has anxiety and needs medication.',
      'The check-ins show symptoms of trauma.',
      'This indicates depression and possible PTSD.',
    ]) {
      assert.ok(
        findMatches(claim, DIAGNOSTIC_ASSERTION, 'x').length > 0,
        `assertion tier missed a stated finding: "${claim}"`,
      );
    }
  });

  test('a bare clinical noun phrase is a label, not an assertion', () => {
    // "not a clinical diagnosis" contains the noun phrase while denying it. Putting
    // noun phrases in the assertion tier is what made the first version flag the
    // compliant sentence, so the separation is asserted rather than assumed.
    assert.deepEqual(findMatches('a clinical diagnosis', DIAGNOSTIC_ASSERTION, 'x'), []);
    assert.ok(findMatches('a clinical diagnosis', DIAGNOSTIC_LABEL, 'x').length > 0);
  });

  test('a negated frame verb is a denial, not a finding', () => {
    // Same words, opposite meaning. The raw pattern list cannot tell these apart —
    // findAssertions is what looks at the words immediately before the frame.
    assert.ok(findMatches('This does not indicate PTSD.', DIAGNOSTIC_ASSERTION, 'x').length > 0);
    assert.deepEqual(findAssertions('This does not indicate PTSD.'), []);
    assert.deepEqual(findAssertions('There are no signs of depression.'), []);
    assert.deepEqual(findAssertions('I cannot say this indicates depression.'), []);
    // "nothing" is not reachable by \bno\b, so it needs listing in its own right.
    assert.deepEqual(findAssertions('Nothing here indicates depression.'), []);
    // The affirmative form still lands.
    assert.ok(findAssertions('This indicates depression.').length > 0);
  });

  test('the negation window is local, so hedging after a claim does not clear it', () => {
    // The negator here is real but it governs the second clause. A whole-sentence
    // check treated that as a denial, which is how a stated finding got laundered.
    assert.ok(
      findAssertions('The person is clearly depressed, though this is not a formal diagnosis.').length > 0,
    );
  });

  /**
   * The load-bearing one.
   *
   * Wrapping a finding in a disclaimer does not retract it — a reader keeps the
   * first half of the sentence. So an assertion is a violation even when the same
   * sentence disowns it, and the disclaimer exemption must not reach it.
   */
  test('a disclaimer does not launder a claim that was still made', () => {
    const laundered = 'The person is clearly depressed, though this is not a formal diagnosis.';
    const { violations } = scanGeneratedText(laundered);
    assert.ok(
      categories(violations).has('diagnostic-assertion'),
      'a diagnosis wrapped in "not a diagnosis" was let through',
    );
  });

  test('declining to diagnose is compliance, and is not flagged', () => {
    // This is what a well-behaved model reply looks like. The first version of the
    // probe reported it as a diagnostic violation, which would have pushed the
    // pipeline toward dropping the disclaimer to score clean.
    for (const compliant of [
      'This is a support signal, not a clinical diagnosis.',
      'These are indicators for a counsellor to review; they are not symptoms of any condition.',
      'I cannot diagnose depression or any other condition from a check-in.',
      'This does not indicate PTSD. It suggests someone may value being contacted.',
    ]) {
      const { violations } = scanGeneratedText(compliant);
      assert.deepEqual(
        violations, [],
        `flagged a compliant disclaimer: "${compliant}" via ${violations[0]?.pattern}`,
      );
    }
  });

  test('the exemption is reported, not silently applied', () => {
    // A model that hides findings inside negated sentences should show up as a
    // rising exemption count rather than an ever-cleaner pass.
    const { exempted } = scanGeneratedText(
      'Nothing here is a diagnosis. There is no sign of any disorder. The person answered briefly.',
    );
    assert.equal(exempted.length, 2);
    assert.ok(exempted.every((s) => typeof s === 'string' && s.length > 0));
  });

  test('authored text gets no exemption at all', () => {
    // A persona reply or a UI string has no reason to mention diagnosis in any
    // framing, so the strict scan holds it to the bare-label list.
    const violations = scanAuthoredText('This is not a diagnosis.');
    assert.ok(
      categories(violations).has('diagnostic-label'),
      'the strict scan exempted a disclaimer it should have flagged',
    );
  });

  test('trauma-informed is not a diagnosis', () => {
    // The spec itself asks for a trauma-informed interface. A guard that flagged
    // the project's own vocabulary would be unusable.
    assert.deepEqual(scanAuthoredText('The tone stays trauma-informed and plain.'), []);
  });
});

describe('the PII and overclaim guards', () => {
  test('flags anything shaped like a real identifier', () => {
    for (const planted of [
      'Call 9876543210 for follow-up.',
      'Reference 1234 5678 9012 on the form.',
      'Write to someone@example.org instead.',
      'Details at https://example.org/case',
    ]) {
      assert.ok(findMatches(planted, PII, 'pii').length > 0, `PII guard missed: "${planted}"`);
    }
  });

  test('a case reference and a month count are not PII', () => {
    assert.deepEqual(scanAuthoredText('Case SIH-CASE-0001, registered 16 months ago.'), []);
  });

  test('flags a reliability claim the system cannot support', () => {
    for (const planted of [
      'The model is 94% accurate on this cohort.',
      'This predicts who will need help next month.',
      'A clinically validated screening tool.',
      'Confidence: high.',
    ]) {
      assert.ok(
        findMatches(planted, OVERCLAIM, 'overclaim').length > 0,
        `overclaim guard missed: "${planted}"`,
      );
    }
  });
});

describe('sentence splitting', () => {
  test('splits on the Devanagari danda as well as the full stop', () => {
    // Without this, a whole Hindi paragraph counts as one sentence, and a single
    // negation anywhere in it would exempt the lot.
    const parts = splitSentences('पहली बात। दूसरी बात। Third one. Fourth one!');
    assert.equal(parts.length, 4);
  });

  test('a negation in one sentence does not exempt the next', () => {
    const text = 'This is not a diagnosis. The person is depressed.';
    assert.equal(disclaimedSentences(text).length, 1);
    assert.ok(categories(scanGeneratedText(text).violations).has('diagnostic-assertion'));
  });

  test('non-string input is handled rather than thrown on', () => {
    assert.deepEqual(splitSentences(undefined), []);
    assert.deepEqual(findMatches(null, GRAPHIC, 'graphic'), []);
    assert.deepEqual(scanAuthoredText(''), []);
  });
});

describe('a well-behaved explanation passes both scanners', () => {
  const good = [
    'Moderate support signal at this check-in.',
    'Replies have become shorter over the last three check-ins and arrived later than before.',
    'The person mentioned waiting for a hearing date.',
    'Suggested next step: a counsellor calls to ask what would help.',
  ].join(' ');

  test('the strict scan is clean', () => {
    assert.deepEqual(scanAuthoredText(good), []);
  });

  test('the generated scan is clean and exempts nothing', () => {
    const { violations, exempted } = scanGeneratedText(good);
    assert.deepEqual(violations, []);
    assert.deepEqual(exempted, []);
  });

  test('the vocabulary lists are frozen, so a caller cannot widen them at runtime', () => {
    // A scan is only as trustworthy as the list it runs. Freezing means a module
    // that wants a term removed has to say so in this file, in a diff.
    for (const list of [GRAPHIC, DIAGNOSTIC_LABEL, DIAGNOSTIC_ASSERTION, PII, OVERCLAIM]) {
      assert.ok(Object.isFrozen(list));
    }
  });
});

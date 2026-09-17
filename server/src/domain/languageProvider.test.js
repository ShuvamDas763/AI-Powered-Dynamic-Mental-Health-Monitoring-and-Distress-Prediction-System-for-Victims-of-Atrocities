import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  CRISIS_HELPLINES,
  normalizeLocale,
  getPrompt,
  getCrisisContent,
  formatOutreachTemplate,
} from './languageProvider.js';

describe('languageProvider', () => {
  it('normalizes locales correctly', () => {
    assert.equal(normalizeLocale('en'), 'en');
    assert.equal(normalizeLocale('EN-US'), 'en');
    assert.equal(normalizeLocale('hi'), 'hi');
    assert.equal(normalizeLocale('hi-IN'), 'hi');
    assert.equal(normalizeLocale('fr'), DEFAULT_LOCALE);
    assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
  });

  it('returns appropriate prompts for English and Hindi', () => {
    const enInitial = getPrompt('en', 'initial');
    const hiInitial = getPrompt('hi', 'initial');
    assert.ok(enInitial.includes('checked in'));
    assert.ok(hiInitial.includes('पिछली बार'));

    const fallback = getPrompt('es', 'followUp');
    assert.ok(fallback.includes('Thank you for sharing'));
  });

  it('provides crisis messaging and helpline numbers', () => {
    const enCrisis = getCrisisContent('en');
    assert.ok(enCrisis.header.length > 0);
    assert.equal(enCrisis.helplines.teleManas, '14416');
    assert.equal(enCrisis.helplines.nationalEmergency, '112');

    const hiCrisis = getCrisisContent('hi');
    assert.ok(hiCrisis.header.includes('तत्काल'));
    assert.equal(hiCrisis.helplines.scStHelpline, '14566');
  });

  it('formats outreach messages for various channels', () => {
    const sms = formatOutreachTemplate('en', 'sms', { name: 'Priya' });
    assert.ok(sms.includes('Priya'));
    assert.ok(sms.includes('Sahara Welfare'));

    const hiIvrs = formatOutreachTemplate('hi', 'ivrs', { name: 'सुनीता' });
    assert.ok(hiIvrs.includes('सुनीता'));
    assert.ok(hiIvrs.includes('परामर्शदाता'));
  });
});

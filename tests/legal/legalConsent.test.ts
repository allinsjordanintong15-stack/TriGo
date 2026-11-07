// Re-consent decision and the "You agreed to …" line (src/utils/legalConsent.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LEGAL_VERSION } from '../../shared/legal/index.ts';
import { legalConsentLine, needsLegalConsent } from '../../src/utils/legalConsent.ts';

const acceptedAt = new Date(2026, 10, 7, 9, 30);

describe('needsLegalConsent', () => {
  it('asks accounts that never accepted (no legalConsent)', () => {
    assert.equal(needsLegalConsent(null), true);
    assert.equal(needsLegalConsent(undefined), true);
  });

  it('does not ask again for the current version', () => {
    assert.equal(needsLegalConsent({ version: LEGAL_VERSION, acceptedAt }), false);
  });

  it('asks again after the version changes', () => {
    assert.equal(needsLegalConsent({ version: '1.0', acceptedAt }, '1.1'), true);
  });
});

describe('legalConsentLine', () => {
  it('shows the accepted version and date', () => {
    assert.equal(
      legalConsentLine({ version: '1.0', acceptedAt }),
      'You agreed to version 1.0 on Nov 7, 2026.',
    );
  });

  it('says so when nothing was accepted yet', () => {
    assert.equal(legalConsentLine(null), 'You have not agreed to these yet.');
  });
});

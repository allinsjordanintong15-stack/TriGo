/// <reference types="node" />

// The legal version the Firestore rules accept (currentLegalVersion() in firestore.rules)
// equals LEGAL_VERSION in shared/legal/meta.ts. Run with `npm run test:unit`.
// When the notice or terms change version, update both, then users re-consent.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEGAL_VERSION } from '../../shared/legal/index.ts';

const rulesPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'firestore.rules');

describe('legal version in the Firestore rules', () => {
  it('currentLegalVersion() returns LEGAL_VERSION', () => {
    const rules = readFileSync(rulesPath, 'utf8');
    const match = rules.match(/function currentLegalVersion\(\)\s*\{\s*return '([^']+)';\s*\}/);
    assert.ok(match, 'currentLegalVersion() not found in firestore.rules');
    assert.equal(match[1], LEGAL_VERSION);
  });
});

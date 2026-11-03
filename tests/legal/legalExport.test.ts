/// <reference types="node" />

// Shared legal module (shared/legal): the Markdown in docs/legal matches the text, the
// version and contact are well-formed, and no "Draft" wording reaches users.
// Run with `npm run test:unit`. If the sync test fails: `npm run legal:export`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findPlaceholders,
  formatLegalDate,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_MARKDOWN_FILES,
  LEGAL_VERSION,
  legalDocumentToMarkdown,
  legalVersionLine,
  PRIVACY_CONTACT,
  PRIVACY_NOTICE,
  TERMS,
} from '../../shared/legal/index.ts';

const docsLegal = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'legal');

function allText(doc: (typeof LEGAL_DOCUMENTS)[number]): string {
  return legalDocumentToMarkdown(doc);
}

describe('legal Markdown export', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    it(`docs/legal/${LEGAL_MARKDOWN_FILES[doc.id]} matches shared/legal (else run npm run legal:export)`, () => {
      const onDisk = readFileSync(join(docsLegal, LEGAL_MARKDOWN_FILES[doc.id]), 'utf8').replace(/\r\n/g, '\n');
      assert.equal(onDisk, legalDocumentToMarkdown(doc));
    });
  }

  it('each export starts with the title and the version line', () => {
    const md = legalDocumentToMarkdown(PRIVACY_NOTICE);
    assert.match(md, /\n# TriGo Privacy Notice\n\n_Version 1\.0 · Effective 3 November 2026_\n/);
  });
});

describe('legal version and contact', () => {
  it('privacy contact is TriGo Management with the project email', () => {
    assert.deepEqual(PRIVACY_CONTACT, { name: 'TriGo Management', email: 'allinsjordanintong15@gmail.com' });
  });

  it('version is major.minor and the effective date is a real date', () => {
    assert.match(LEGAL_VERSION, /^\d+\.\d+$/);
    assert.doesNotThrow(() => formatLegalDate(LEGAL_EFFECTIVE_DATE));
    assert.equal(legalVersionLine(), `Version ${LEGAL_VERSION} · Effective ${formatLegalDate(LEGAL_EFFECTIVE_DATE)}`);
  });

  it('formats dates in plain English and rejects bad ones', () => {
    assert.equal(formatLegalDate('2026-11-03'), '3 November 2026');
    assert.equal(formatLegalDate('2027-01-31'), '31 January 2027');
    assert.throws(() => formatLegalDate('2026-02-30'));
    assert.throws(() => formatLegalDate('3 Nov 2026'));
  });

  it('both documents name the privacy contact email', () => {
    for (const doc of LEGAL_DOCUMENTS) assert.ok(allText(doc).includes(PRIVACY_CONTACT.email), doc.id);
  });
});

describe('legal text shown to users', () => {
  it('has no "Draft" wording', () => {
    for (const doc of LEGAL_DOCUMENTS) assert.doesNotMatch(allText(doc), /draft/i, doc.id);
  });

  it('section ids are unique, anchor-safe slugs', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const ids = doc.sections.map((section) => section.id);
      assert.equal(new Set(ids).size, ids.length, doc.id);
      for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('reflects fix A: a driver\'s location is deleted on going offline', () => {
    const location = PRIVACY_NOTICE.sections.find((section) => section.id === 'location');
    assert.ok(location);
    assert.match(JSON.stringify(location), /goes offline, the saved position is deleted/);
  });

  it('reflects fix B: Android lock screen shows only Android\'s own hidden-contents message', () => {
    const notifications = PRIVACY_NOTICE.sections.find((section) => section.id === 'notifications');
    assert.ok(notifications);
    assert.match(JSON.stringify(notifications), /lock screen shows only Android's own message that the contents are hidden/);
  });

  it('lists the values still to fill in (minimum age, Firestore region)', () => {
    // When these are filled in, update this list (and raise the version if already published).
    assert.deepEqual(findPlaceholders(PRIVACY_NOTICE), [
      '⟦TO FILL: Firestore location / region⟧',
      '⟦TO FILL: minimum age⟧',
    ]);
    assert.deepEqual(findPlaceholders(TERMS), ['⟦TO FILL: minimum age⟧']);
  });
});

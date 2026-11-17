/// <reference types="node" />

// Settings edit flow (admin/src/settings/settingsDiff.ts): which fields count as unsaved
// changes, the review rows and the gold warnings (> 50% change or set to 0).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  changeWarning,
  diffNumberFields,
  isFieldChanged,
  unsavedChangesLabel,
  type NumberField,
} from '../../admin/src/settings/settingsDiff.ts';

const peso = (value: number) => `₱${value.toFixed(2)}`;

function field(id: string, initial: number, text: string): NumberField {
  const trimmed = text.trim();
  const parsed = /^\d+(\.\d{1,2})?$/.test(trimmed) ? { value: Number(trimmed) } : { error: 'Invalid.' };
  return { id, label: id, text, initialText: initial.toFixed(2), initial, parsed, format: peso };
}

describe('changeWarning', () => {
  it('warns when a value is set to 0', () => {
    assert.equal(changeWarning(15, 0), 'zero');
  });

  it('warns above a 50% change in either direction', () => {
    assert.equal(changeWarning(10, 15.01), 'large');
    assert.equal(changeWarning(10, 4.99), 'large');
    assert.equal(changeWarning(40, 100), 'large');
  });

  it('does not warn at exactly 50% or below', () => {
    assert.equal(changeWarning(10, 15), null);
    assert.equal(changeWarning(10, 5), null);
    assert.equal(changeWarning(40.5, 45.5), null);
  });

  it('treats any change away from 0 as large', () => {
    assert.equal(changeWarning(0, 1), 'large');
  });

  it('does not warn for unchanged or first-time values', () => {
    assert.equal(changeWarning(8, 8), null);
    assert.equal(changeWarning(0, 0), null);
    assert.equal(changeWarning(null, 0), null);
    assert.equal(changeWarning(null, 500), null);
  });
});

describe('isFieldChanged', () => {
  it('compares parsed values, so formatting alone is not a change', () => {
    assert.equal(isFieldChanged(field('a', 8, '8.00')), false);
    assert.equal(isFieldChanged(field('a', 8, '8')), false);
    assert.equal(isFieldChanged(field('a', 8, ' 8.0 ')), false);
    assert.equal(isFieldChanged(field('a', 8, '8.5')), true);
  });

  it('counts invalid text as a change unless it is the initial text', () => {
    assert.equal(isFieldChanged(field('a', 8, '')), true);
    assert.equal(isFieldChanged(field('a', 8, 'abc')), true);
  });
});

describe('diffNumberFields', () => {
  it('lists only changed fields, with old/new text and warnings', () => {
    const diff = diffNumberFields(
      [field('base', 15, '15.00'), field('perKm', 8, '20'), field('other', 10, '0')],
      { notSavedYet: false },
    );
    assert.deepEqual(diff.changedIds, ['perKm', 'other']);
    assert.deepEqual(diff.errors, []);
    assert.deepEqual(diff.rows, [
      { id: 'perKm', label: 'perKm', oldText: '₱8.00', newText: '₱20.00', warning: 'large' },
      { id: 'other', label: 'other', oldText: '₱10.00', newText: '₱0.00', warning: 'zero' },
    ]);
  });

  it('reports invalid fields as errors (in form order) and leaves them out of the rows', () => {
    const diff = diffNumberFields([field('a', 1, 'x'), field('b', 2, '3'), field('c', 3, '')], { notSavedYet: false });
    assert.deepEqual(diff.changedIds, ['a', 'b', 'c']);
    assert.deepEqual(
      diff.errors.map((e) => e.id),
      ['a', 'c'],
    );
    assert.deepEqual(
      diff.rows.map((r) => r.id),
      ['b'],
    );
  });

  it('has nothing to review when nothing changed', () => {
    const diff = diffNumberFields([field('a', 1, '1.00'), field('b', 2, '2')], { notSavedYet: false });
    assert.deepEqual(diff, { changedIds: [], errors: [], rows: [] });
  });

  it('lists every field as a default, without warnings, when nothing is saved yet', () => {
    const diff = diffNumberFields([field('a', 15, '15.00'), field('b', 8, '0')], { notSavedYet: true });
    assert.deepEqual(diff.changedIds, ['b']);
    assert.deepEqual(diff.rows, [
      { id: 'a', label: 'a', oldText: '₱15.00 (default)', newText: '₱15.00', warning: null },
      { id: 'b', label: 'b', oldText: '₱8.00 (default)', newText: '₱0.00', warning: null },
    ]);
  });
});

describe('unsavedChangesLabel', () => {
  it('uses the singular for one change', () => {
    assert.equal(unsavedChangesLabel(1), '1 unsaved change');
    assert.equal(unsavedChangesLabel(2), '2 unsaved changes');
  });
});

/// <reference types="node" />

// Settings edit flow (admin/src/settings/settingsDiff.ts): which fields count as unsaved
// changes, the review rows and the gold warnings (> 50% change or set to 0).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  changeWarning,
  diffFields,
  isFieldChanged,
  switchField,
  unsavedChangesLabel,
  type SettingField,
} from '../../admin/src/settings/settingsDiff.ts';

const peso = (value: number | string | boolean) => `₱${(value as number).toFixed(2)}`;

/** An amount field; `initial` null = nothing saved for it (initial text ''). */
function field(id: string, initial: number | null, text: string): SettingField {
  const trimmed = text.trim();
  const parsed = /^\d+(\.\d{1,2})?$/.test(trimmed) ? { value: Number(trimmed) } : { error: 'Invalid.' };
  return {
    id,
    label: id,
    text,
    initialText: initial === null ? '' : initial.toFixed(2),
    initial,
    parsed,
    format: peso,
  };
}

/** A text field whose parse trims and collapses spaces. */
function textField(id: string, initial: string | null, text: string): SettingField {
  const value = text.trim().replace(/\s+/g, ' ');
  return {
    id,
    label: id,
    text,
    initialText: initial ?? '',
    initial,
    parsed: value ? { value } : { error: 'Required.' },
    format: (v) => String(v),
  };
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
    assert.equal(isFieldChanged(textField('n', 'TriGo Trinidad', ' TriGo   Trinidad ')), false);
  });

  it('counts invalid text as a change unless it is the initial text', () => {
    assert.equal(isFieldChanged(field('a', 8, '')), true);
    assert.equal(isFieldChanged(field('a', 8, 'abc')), true);
    assert.equal(isFieldChanged(field('a', null, '')), false);
    assert.equal(isFieldChanged(field('a', null, '  ')), false);
  });

  it('counts any valid value as a change when nothing was saved for it', () => {
    assert.equal(isFieldChanged(field('a', null, '40')), true);
  });
});

describe('diffFields', () => {
  it('lists only changed fields, with old/new text and warnings', () => {
    const diff = diffFields([field('base', 15, '15.00'), field('perKm', 8, '20'), field('other', 10, '0')]);
    assert.deepEqual(diff.changedIds, ['perKm', 'other']);
    assert.deepEqual(diff.errors, []);
    assert.deepEqual(diff.rows, [
      { id: 'perKm', label: 'perKm', oldText: '₱8.00', newText: '₱20.00', warning: 'large' },
      { id: 'other', label: 'other', oldText: '₱10.00', newText: '₱0.00', warning: 'zero' },
    ]);
  });

  it('reports invalid fields as errors (in form order) and leaves them out of the rows', () => {
    const diff = diffFields([field('a', 1, 'x'), field('b', 2, '3'), field('c', 3, '')]);
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
    const diff = diffFields([field('a', 1, '1.00'), field('b', 2, '2')]);
    assert.deepEqual(diff, { changedIds: [], errors: [], rows: [] });
  });

  it('lists every field as a default, without warnings, when nothing is saved yet', () => {
    const diff = diffFields([field('a', 15, '15.00'), field('b', 8, '0')], { notSavedYet: true });
    assert.deepEqual(diff.changedIds, ['b']);
    assert.deepEqual(diff.rows, [
      { id: 'a', label: 'a', oldText: '₱15.00 (default)', newText: '₱15.00', warning: null },
      { id: 'b', label: 'b', oldText: '₱8.00 (default)', newText: '₱0.00', warning: null },
    ]);
  });

  it('shows first-time values as "Not set" with no warning', () => {
    const diff = diffFields([field('tricycle', null, '500'), field('motorcycle', null, '0')]);
    assert.deepEqual(diff.rows, [
      { id: 'tricycle', label: 'tricycle', oldText: 'Not set', newText: '₱500.00', warning: null },
      { id: 'motorcycle', label: 'motorcycle', oldText: 'Not set', newText: '₱0.00', warning: null },
    ]);
  });

  it('a half-filled new row: the blank cell is an error but not a change', () => {
    const diff = diffFields([field('tricycle', null, '40'), field('motorcycle', null, '')]);
    assert.deepEqual(diff.changedIds, ['tricycle']);
    assert.deepEqual(
      diff.errors.map((e) => e.id),
      ['motorcycle'],
    );
  });

  it('compares text values and never warns on them', () => {
    const diff = diffFields([textField('name', 'TriGo', 'TriGo Trinidad')]);
    assert.deepEqual(diff.rows, [{ id: 'name', label: 'name', oldText: 'TriGo', newText: 'TriGo Trinidad', warning: null }]);
  });
});

describe('switchField', () => {
  const labels: [string, string] = ['Active', 'Inactive'];

  it('is unchanged while it matches the saved value', () => {
    const diff = diffFields([switchField({ id: 's', label: 'Status', initial: true }, true, labels)]);
    assert.deepEqual(diff.changedIds, []);
  });

  it('shows on/off labels in the review', () => {
    const diff = diffFields([switchField({ id: 's', label: 'Status', initial: true }, false, labels)]);
    assert.deepEqual(diff.rows, [{ id: 's', label: 'Status', oldText: 'Active', newText: 'Inactive', warning: null }]);
  });

  it('counts as a change on a row that was never saved', () => {
    const diff = diffFields([switchField({ id: 's', label: 'Status', initial: null }, false, labels)]);
    assert.deepEqual(diff.rows, [{ id: 's', label: 'Status', oldText: 'Not set', newText: 'Inactive', warning: null }]);
  });
});

describe('unsavedChangesLabel', () => {
  it('uses the singular for one change', () => {
    assert.equal(unsavedChangesLabel(1), '1 unsaved change');
    assert.equal(unsavedChangesLabel(2), '2 unsaved changes');
  });
});

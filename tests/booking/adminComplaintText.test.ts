/// <reference types="node" />

// Plain-English sentences on the admin complaint page (admin/src/complaints/complaintText.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  complaintCountText,
  complaintStatusSentence,
  tripStatusText,
  warningCountText,
} from '../../admin/src/complaints/complaintText.ts';

describe('complaintStatusSentence', () => {
  it('asks for a review while open', () => {
    assert.equal(complaintStatusSentence('open', 'Nov 9, 2026', 'you'), 'Waiting for your review.');
  });

  it('says when and by whom it was resolved or put in review', () => {
    assert.equal(complaintStatusSentence('resolved', 'Nov 9, 2026', 'Ana Cruz'), 'Resolved on Nov 9, 2026 by Ana Cruz.');
    assert.equal(complaintStatusSentence('in_review', 'Nov 9, 2026', 'you'), 'In review since Nov 9, 2026 by you.');
    assert.equal(complaintStatusSentence('resolved', null, null), 'Resolved.');
  });
});

describe('complaintCountText', () => {
  it('never says "no complaints" when this complaint is counted', () => {
    assert.equal(complaintCountText(0, true), 'First complaint on record');
    assert.equal(complaintCountText(1, true), 'First complaint on record');
    assert.equal(complaintCountText(2, true), '2 complaints on record');
  });

  it('speaks of other complaints when this one is too old to be counted', () => {
    assert.equal(complaintCountText(0, false), 'No other complaints on record since Nov 10, 2026');
    assert.equal(complaintCountText(1, false), '1 other complaint on record since Nov 10, 2026');
    assert.equal(complaintCountText(3, false), '3 other complaints on record since Nov 10, 2026');
  });
});

describe('warningCountText', () => {
  it('counts active warnings', () => {
    assert.equal(warningCountText(0), 'No warnings yet');
    assert.equal(warningCountText(1), '1 warning');
    assert.equal(warningCountText(2), '2 warnings');
  });
});

describe('tripStatusText', () => {
  it('describes each status in plain words', () => {
    assert.equal(tripStatusText('completed', false), 'Trip completed');
    assert.equal(tripStatusText('pending', true), 'Expired: no driver accepted it in time');
    assert.equal(tripStatusText(null, false), 'Status unknown');
  });
});

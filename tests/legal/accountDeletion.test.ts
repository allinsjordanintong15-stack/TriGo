// Account deletion request helpers (src/utils/accountDeletion.ts) and the short privacy
// notice on the driver application (shared/legal/driverApplicationNotice.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DRIVER_APPLICATION_NOTICE } from '../../shared/legal/index.ts';
import {
  DELETION_REASON_MAX_LENGTH,
  deletionNotes,
  normalizeDeletionReason,
  type DeletionContext,
} from '../../src/utils/accountDeletion.ts';

const nothingOpen: DeletionContext = {
  passengerTripActive: false,
  driverOnTrip: false,
  driverHoldsRequest: false,
  unpaidCommissionCentavos: 0,
};

describe('normalizeDeletionReason', () => {
  it('trims, and an empty reason is null (no reason field written)', () => {
    assert.deepEqual(normalizeDeletionReason('  Moving away  '), { reason: 'Moving away', error: null });
    assert.deepEqual(normalizeDeletionReason('   '), { reason: null, error: null });
  });

  it('accepts 500 characters and refuses 501 (firestore.rules limit)', () => {
    assert.equal(DELETION_REASON_MAX_LENGTH, 500);
    assert.equal(normalizeDeletionReason('a'.repeat(500)).error, null);
    assert.match(normalizeDeletionReason('a'.repeat(501)).error ?? '', /500 characters/);
  });
});

describe('deletionNotes', () => {
  it('has no notes when nothing is open', () => {
    assert.deepEqual(deletionNotes(nothingOpen), []);
  });

  it('explains an active trip, as passenger or driver, once', () => {
    const asPassenger = deletionNotes({ ...nothingOpen, passengerTripActive: true });
    const both = deletionNotes({ ...nothingOpen, passengerTripActive: true, driverOnTrip: true });
    assert.equal(asPassenger.length, 1);
    assert.deepEqual(both, asPassenger);
    assert.match(asPassenger[0], /trip in progress.*record is kept.*after the trip has ended/);
  });

  it('explains a held out-of-area request', () => {
    const [note] = deletionNotes({ ...nothingOpen, driverHoldsRequest: true });
    assert.match(note, /holding an out-of-area request/);
  });

  it('explains unpaid commission with the amount and the kept records', () => {
    const [note] = deletionNotes({ ...nothingOpen, unpaidCommissionCentavos: 12550 });
    assert.match(note, /₱125\.50 in unpaid commission/);
    assert.match(note, /commission and payment records are kept/);
  });

  it('lists every open item', () => {
    const notes = deletionNotes({
      passengerTripActive: false,
      driverOnTrip: true,
      driverHoldsRequest: true,
      unpaidCommissionCentavos: 1,
    });
    assert.equal(notes.length, 3);
  });
});

describe('driver application privacy notice', () => {
  const text = DRIVER_APPLICATION_NOTICE.points.map((p) => p.text).join(' ');

  it('says what is collected, who reviews it and what passengers see', () => {
    assert.match(text, /plate number/);
    assert.match(text, /OR\/CR/);
    assert.match(text, /TriGo team/);
    assert.match(text, /shown to passengers/);
    assert.match(text, /mobile number is shared with the passenger only during an active trip/);
  });

  it('asks for "I\'ve read this" and has no "Draft" wording', () => {
    assert.equal(DRIVER_APPLICATION_NOTICE.acknowledgement, "I've read this");
    assert.doesNotMatch(`${DRIVER_APPLICATION_NOTICE.title} ${text}`, /draft/i);
  });
});

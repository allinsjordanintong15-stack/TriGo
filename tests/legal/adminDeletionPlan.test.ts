// Admin account deletion helpers (admin/src/privacy/deletionPlan.ts): the checks shown
// before anonymizing, and the decline note. The write payloads are checked against the
// Firestore rules in tests/rules/privacy.test.ts. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  anonymizedUserUpdate,
  canAnonymize,
  DECLINE_NOTE_MAX_LENGTH,
  DELETED_NAME,
  deletionChecks,
  validateDeclineNote,
  type OpenItems,
} from '../../admin/src/privacy/deletionPlan.ts';

const peso = (centavos: number) => `₱${(centavos / 100).toFixed(2)}`;
const nothingOpen: OpenItems = {
  passengerActiveTrips: 0,
  driverOnTrip: false,
  driverHoldsRequest: false,
  unpaidCentavos: 0,
};

function states(items: OpenItems) {
  return Object.fromEntries(deletionChecks(items, peso).map((check) => [check.id, check.state]));
}

describe('deletionChecks', () => {
  it('all fine when nothing is open', () => {
    assert.deepEqual(states(nothingOpen), {
      'passenger-trip': 'ok',
      'driver-trip': 'ok',
      'held-request': 'ok',
      commission: 'ok',
    });
    assert.equal(canAnonymize(deletionChecks(nothingOpen, peso)), true);
  });

  it('blocks on a trip (passenger or driver) or a held request', () => {
    for (const items of [
      { ...nothingOpen, passengerActiveTrips: 1 },
      { ...nothingOpen, driverOnTrip: true },
      { ...nothingOpen, driverHoldsRequest: true },
    ]) {
      assert.equal(canAnonymize(deletionChecks(items, peso)), false, JSON.stringify(items));
    }
  });

  it('only warns about unpaid or unreadable commission, with the amount', () => {
    const unpaid = deletionChecks({ ...nothingOpen, unpaidCentavos: 12550 }, peso);
    assert.equal(canAnonymize(unpaid), true);
    const commission = unpaid.find((check) => check.id === 'commission');
    assert.equal(commission?.state, 'warning');
    assert.match(commission?.detail ?? '', /₱125\.50 unpaid/);
    assert.equal(states({ ...nothingOpen, unpaidCentavos: null }).commission, 'warning');
  });

  it('counts several passenger trips in plain words', () => {
    const [passenger] = deletionChecks({ ...nothingOpen, passengerActiveTrips: 2 }, peso);
    assert.match(passenger.detail, /2 trips in progress\. Wait until they end\./);
  });
});

describe('validateDeclineNote', () => {
  it('requires a note of at most 500 characters (firestore.rules)', () => {
    assert.equal(DECLINE_NOTE_MAX_LENGTH, 500);
    assert.ok(validateDeclineNote('   '));
    assert.equal(validateDeclineNote('x'.repeat(500)), null);
    assert.ok(validateDeclineNote('x'.repeat(501)));
  });
});

describe('anonymized profile', () => {
  it('blanks name, email, mobile number and photo', () => {
    const now = Symbol('now');
    assert.deepEqual(anonymizedUserUpdate(now), {
      fullName: DELETED_NAME,
      email: '',
      mobileNumber: '',
      profileImage: null,
      anonymizedAt: now,
      updatedAt: now,
    });
  });
});

/// <reference types="node" />

// Commission tab example line (admin/src/commission/commissionExample.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateCommission, commissionExample } from '../../admin/src/commission/commissionExample.ts';
import { commissionCentavos } from '../../src/utils/commission.ts';

const peso = (amount: number) => `₱${amount.toFixed(2)}`;

describe('commissionExample', () => {
  it('reads like the spec example', () => {
    assert.equal(
      commissionExample({ percentage: 10, paymentPeriodDays: 3, gracePeriodDays: 2 }, peso),
      'On a ₱100.00 fare, the driver owes ₱10.00; pay within 3 days, then 2 grace days.',
    );
  });

  it('uses the singular and "no grace days"', () => {
    assert.equal(
      commissionExample({ percentage: 12.5, paymentPeriodDays: 1, gracePeriodDays: 0 }, peso),
      'On a ₱100.00 fare, the driver owes ₱12.50; pay within 1 day, then no grace days.',
    );
    assert.match(commissionExample({ percentage: 5, paymentPeriodDays: 7, gracePeriodDays: 1 }, peso), /then 1 grace day\.$/);
  });
});

describe('calculateCommission', () => {
  it('matches the amount the app records (to the centavo)', () => {
    for (const [fare, percentage] of [
      [100, 10],
      [52.15, 12.5],
      [37.45, 7.25],
      [80, 0.01],
    ]) {
      assert.equal(calculateCommission(fare, percentage), commissionCentavos(fare, percentage) / 100);
    }
  });
});

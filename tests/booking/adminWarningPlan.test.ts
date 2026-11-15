/// <reference types="node" />

// Admin warning payloads and labels (admin/src/warnings/warningPlan.ts). Run with
// `npm run test:unit`. The Firestore rules tests use the same payloads.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearedReasonUpdate,
  newWarningDoc,
  validateWarningReason,
  warningCountLabel,
  warningSummaryLabel,
  withdrawnWarningUpdate,
} from '../../admin/src/warnings/warningPlan.ts';

const NOW = 'server-time';

describe('newWarningDoc', () => {
  it('builds an active, unacknowledged warning with a trimmed reason', () => {
    assert.deepEqual(
      newWarningDoc(
        { userId: 'd1', role: 'driver', complaintId: 'b1_p1', bookingId: 'b1', reason: '  Be on time.  ' },
        'admin1',
        NOW,
      ),
      {
        userId: 'd1',
        role: 'driver',
        complaintId: 'b1_p1',
        bookingId: 'b1',
        reason: 'Be on time.',
        adminId: 'admin1',
        createdAt: NOW,
        status: 'active',
        acknowledgedAt: null,
      },
    );
  });

  it('drops the booking when there is no complaint', () => {
    const warning = newWarningDoc(
      { userId: 'd1', role: 'driver', complaintId: null, bookingId: 'b1', reason: 'x' },
      'admin1',
      NOW,
    );
    assert.equal(warning.bookingId, null);
  });
});

describe('admin updates', () => {
  it('withdraws with time and admin', () => {
    assert.deepEqual(withdrawnWarningUpdate(NOW, 'admin1'), {
      status: 'withdrawn',
      withdrawnAt: NOW,
      withdrawnBy: 'admin1',
    });
  });

  it('clears the reason on account deletion', () => {
    assert.deepEqual(clearedReasonUpdate(NOW), { reason: '', reasonClearedAt: NOW });
  });
});

describe('validateWarningReason', () => {
  it('requires 1–500 characters after trimming', () => {
    assert.ok(validateWarningReason('   '));
    assert.ok(validateWarningReason('x'.repeat(501)));
    assert.equal(validateWarningReason(` ${'x'.repeat(500)} `), null);
  });
});

describe('labels', () => {
  it('counts warnings', () => {
    assert.equal(warningCountLabel(0), 'No warnings');
    assert.equal(warningCountLabel(1), '1 warning');
    assert.equal(warningCountLabel(3), '3 warnings');
  });

  it('counts active warnings and shows withdrawn ones apart', () => {
    assert.equal(
      warningSummaryLabel([{ status: 'active' }, { status: 'active' }, { status: 'withdrawn' }], '3 complaints'),
      '2 warnings (1 withdrawn) · 3 complaints',
    );
    assert.equal(warningSummaryLabel([], 'No complaints'), 'No warnings · No complaints');
  });
});

/// <reference types="node" />

// Driver admin suspension in the app (src/utils/adminSuspension.ts) and the admin website's
// action payloads (admin/src/drivers/driverActionPlan.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adminMessageText,
  liftSuspensionUpdate,
  newAdminMessageDoc,
  suspensionEndMillis as adminSuspensionEnd,
  suspensionUpdate,
  validateActionReason,
} from '../../admin/src/drivers/driverActionPlan.ts';
import { isSuspensionActive, suspensionTitle } from '../../src/utils/adminSuspension.ts';

const NOW = Date.UTC(2026, 10, 16, 2);
const DAY = 24 * 60 * 60 * 1000;

describe('isSuspensionActive', () => {
  const base = { suspendedAt: new Date(NOW - 1000), suspendedUntil: null, reason: 'r', liftedAt: null };
  it('is false without a suspension', () => {
    assert.equal(isSuspensionActive(null, NOW), false);
    assert.equal(isSuspensionActive({ ...base, suspendedAt: null }, NOW), false);
  });
  it('is true until lifted when there is no end', () => {
    assert.equal(isSuspensionActive(base, NOW), true);
    assert.equal(isSuspensionActive({ ...base, liftedAt: new Date(NOW - 1) }, NOW), false);
  });
  it('ends by itself at suspendedUntil', () => {
    assert.equal(isSuspensionActive({ ...base, suspendedUntil: new Date(NOW + 1) }, NOW), true);
    assert.equal(isSuspensionActive({ ...base, suspendedUntil: new Date(NOW) }, NOW), false);
  });
  it('titles the banner', () => {
    const format = (d: Date) => d.toISOString().slice(0, 10);
    assert.equal(suspensionTitle({ ...base, suspendedUntil: new Date(NOW + DAY) }, format), 'Suspended until 2026-11-17');
    assert.equal(suspensionTitle(base, format), 'Suspended until TriGo lifts it');
  });
});

describe('admin driver action payloads', () => {
  it('computes the end of each duration', () => {
    assert.equal(adminSuspensionEnd('1d', NOW), NOW + DAY);
    assert.equal(adminSuspensionEnd('3d', NOW), NOW + 3 * DAY);
    assert.equal(adminSuspensionEnd('7d', NOW), NOW + 7 * DAY);
    assert.equal(adminSuspensionEnd('until_lifted', NOW), null);
  });

  it('builds the suspension and lift updates', () => {
    assert.deepEqual(suspensionUpdate('  Late pickups. ', 'until', 'admin1', 'now'), {
      suspendedAt: 'now',
      suspendedUntil: 'until',
      suspensionReason: 'Late pickups.',
      suspendedBy: 'admin1',
      suspensionLiftedAt: null,
      suspensionLiftedBy: null,
    });
    assert.deepEqual(liftSuspensionUpdate('admin1', 'now'), { suspensionLiftedAt: 'now', suspensionLiftedBy: 'admin1' });
  });

  it('builds messages; only a suspension keeps its end', () => {
    const suspended = newAdminMessageDoc(
      { userId: 'd1', kind: 'suspended', reason: ' r ', until: 'ts', untilLabel: 'Nov 20, 2026' },
      'admin1',
      'now',
    );
    assert.deepEqual(Object.keys(suspended).sort(), [
      'body', 'createdAt', 'createdBy', 'kind', 'readAt', 'reason', 'title', 'until', 'userId',
    ]);
    assert.equal(suspended.reason, 'r');
    assert.equal(suspended.until, 'ts');
    assert.equal(suspended.readAt, null);
    assert.match(suspended.body, /until Nov 20, 2026/);
    assert.match(suspended.body, /finish a current trip/);
    const lifted = newAdminMessageDoc(
      { userId: 'd1', kind: 'suspension_lifted', reason: 'r', until: 'ts', untilLabel: null },
      'admin1',
      'now',
    );
    assert.equal(lifted.until, null);
    assert.match(adminMessageText('suspended', null).body, /until the TriGo team lifts it/);
    for (const kind of ['suspended', 'suspension_lifted', 'revoked', 'restored'] as const) {
      const text = adminMessageText(kind, null);
      assert.ok(text.title.length > 0 && text.title.length <= 120);
      assert.ok(text.body.length > 0 && text.body.length <= 1000);
    }
  });

  it('validates the reason', () => {
    assert.ok(validateActionReason('   '));
    assert.ok(validateActionReason('x'.repeat(501)));
    assert.equal(validateActionReason('x'.repeat(500)), null);
  });
});

/// <reference types="node" />

// Ride-request notification helpers (src/utils/requestNotification.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildNotificationData,
  decideAlert,
  formatRequestNotification,
  formatSummaryNotification,
  isRideRequestNotificationId,
  MAX_PLACE_LABEL_LENGTH,
  NO_SHOWN_NOTIFICATIONS,
  parseNotificationData,
  placeLabel,
  planGoneRequests,
  planNewRequests,
  REQUEST_NOTIFICATION_TITLE,
  requestNotificationId,
  SUMMARY_NOTIFICATION_ID,
  truncate,
  type NotificationTarget,
  type ShownNotifications,
} from '../../src/utils/requestNotification.ts';

describe('decideAlert', () => {
  it('only vibrates while the app is on screen', () => {
    assert.deepEqual(decideAlert('active', 1), { vibrate: true, notify: 'none' });
    assert.deepEqual(decideAlert('active', 3), { vibrate: true, notify: 'none' });
  });

  it('only notifies in the background: one detailed or one summary', () => {
    assert.deepEqual(decideAlert('background', 1), { vibrate: false, notify: 'single' });
    assert.deepEqual(decideAlert('background', 2), { vibrate: false, notify: 'summary' });
    assert.deepEqual(decideAlert('inactive', 1), { vibrate: false, notify: 'single' });
  });

  it('never vibrates and notifies together (no double buzz)', () => {
    for (const state of ['active', 'background', 'inactive', 'unknown'] as const) {
      for (const count of [1, 2, 5]) {
        const { vibrate, notify } = decideAlert(state, count);
        assert.equal(vibrate && notify !== 'none', false, `${state} ${count}`);
      }
    }
  });

  it('does nothing without new requests', () => {
    assert.deepEqual(decideAlert('active', 0), { vibrate: false, notify: 'none' });
    assert.deepEqual(decideAlert('background', 0), { vibrate: false, notify: 'none' });
  });
});

describe('notification text', () => {
  it('formats the planned example', () => {
    assert.deepEqual(
      formatRequestNotification({
        fare: 85.44,
        pickupLabel: 'Santo Tomas',
        destinationLabel: 'Poblacion',
        distanceToPickupKm: 2.06,
      }),
      { title: REQUEST_NOTIFICATION_TITLE, body: '₱85.44 · Santo Tomas → Poblacion · 2.1 km to pickup' },
    );
  });

  it('keeps centavos and leaves out the distance when unknown', () => {
    assert.equal(
      formatRequestNotification({ fare: 40, pickupLabel: 'A', destinationLabel: 'B', distanceToPickupKm: null })
        .body,
      '₱40.00 · A → B',
    );
    assert.equal(
      formatRequestNotification({ fare: 40, pickupLabel: 'A', destinationLabel: 'B', distanceToPickupKm: NaN })
        .body,
      '₱40.00 · A → B',
    );
  });

  it('summarises several requests', () => {
    assert.deepEqual(formatSummaryNotification(3), {
      title: '3 new ride requests',
      body: 'Open TriGo to see them in Requests.',
    });
  });
});

describe('placeLabel / truncate', () => {
  it('prefers the barangay name', () => {
    assert.equal(placeLabel('Purok 3, Santo Tomas, Trinidad, Bohol', 'Santo Tomas'), 'Santo Tomas');
  });

  it('falls back to the first part of the address', () => {
    assert.equal(placeLabel('Tagbilaran City, Bohol, Philippines', null), 'Tagbilaran City');
    assert.equal(placeLabel('Tagbilaran City', '  '), 'Tagbilaran City');
  });

  it('shortens long labels with an ellipsis', () => {
    const label = placeLabel('Holy Name University Main Campus Building, Tagbilaran', null);
    assert.equal(label.length, MAX_PLACE_LABEL_LENGTH);
    assert.ok(label.endsWith('…'));
    assert.equal(truncate('  short  ', 10), 'short');
  });

  it('never returns an empty label', () => {
    assert.equal(placeLabel('', null), 'Unknown place');
  });
});

describe('identifiers', () => {
  it('gives each request its own ID and one shared summary ID', () => {
    assert.equal(requestNotificationId('standard', 'abc'), 'ride-request:standard:abc');
    assert.notEqual(requestNotificationId('standard', 'abc'), requestNotificationId('out_of_area', 'abc'));
    assert.equal(SUMMARY_NOTIFICATION_ID, 'ride-request:summary');
  });
});

describe('tap data', () => {
  const driverId = 'driverUid123';
  const targets: NotificationTarget[] = [
    { kind: 'standard', bookingId: 'Ab3dEf6hIj9kLm2nOp5q' },
    { kind: 'out_of_area', requestId: 'Zy8xWv7uTs6rQp5oNm4l' },
    { kind: 'list' },
  ];

  it('round-trips every target for the same driver', () => {
    for (const target of targets) {
      assert.deepEqual(parseNotificationData(buildNotificationData(target, driverId), driverId), target);
    }
  });

  it('stores strings only', () => {
    for (const target of targets) {
      for (const value of Object.values(buildNotificationData(target, driverId))) {
        assert.equal(typeof value, 'string');
      }
    }
  });

  it('ignores a notification posted for another driver or when signed out', () => {
    const data = buildNotificationData(targets[0], driverId);
    assert.equal(parseNotificationData(data, 'someoneElse'), null);
    assert.equal(parseNotificationData(data, null), null);
  });

  it('rejects malformed or foreign data', () => {
    assert.equal(parseNotificationData(null, driverId), null);
    assert.equal(parseNotificationData('ride-request', driverId), null);
    assert.equal(parseNotificationData({ type: 'other', kind: 'list', driverId }, driverId), null);
    assert.equal(parseNotificationData({ type: 'ride-request', kind: 'trip', id: 'a', driverId }, driverId), null);
    assert.equal(parseNotificationData({ type: 'ride-request', kind: 'standard', id: '', driverId }, driverId), null);
    assert.equal(
      parseNotificationData({ type: 'ride-request', kind: 'standard', id: '../trip/x', driverId }, driverId),
      null,
    );
    assert.equal(
      parseNotificationData({ type: 'ride-request', kind: 'out_of_area', id: 42, driverId }, driverId),
      null,
    );
  });
});

describe('isRideRequestNotificationId', () => {
  it('matches singles and the summary only', () => {
    assert.equal(isRideRequestNotificationId(requestNotificationId('standard', 'b1')), true);
    assert.equal(isRideRequestNotificationId(requestNotificationId('out_of_area', 'r1')), true);
    assert.equal(isRideRequestNotificationId(SUMMARY_NOTIFICATION_ID), true);
    assert.equal(isRideRequestNotificationId('chat:message:1'), false);
    assert.equal(isRideRequestNotificationId(''), false);
  });
});

describe('planNewRequests', () => {
  const a = requestNotificationId('standard', 'a');
  const b = requestNotificationId('out_of_area', 'b');
  const c = requestNotificationId('standard', 'c');

  it('on screen: vibrates once and remembers nothing', () => {
    const plan = planNewRequests(NO_SHOWN_NOTIFICATIONS, [a, b], 'active');
    assert.deepEqual(plan, { vibrate: true, actions: [], next: NO_SHOWN_NOTIFICATIONS });
  });

  it('on screen with nothing new: does nothing', () => {
    assert.equal(planNewRequests(NO_SHOWN_NOTIFICATIONS, [], 'active').vibrate, false);
  });

  it('in the background: one request gets its own notification', () => {
    const plan = planNewRequests(NO_SHOWN_NOTIFICATIONS, [a], 'background');
    assert.deepEqual(plan, {
      vibrate: false,
      actions: [{ type: 'post-single', id: a }],
      next: { ids: [a], summaryShown: false },
    });
  });

  it('several at once: one summary', () => {
    const plan = planNewRequests(NO_SHOWN_NOTIFICATIONS, [a, b, a], 'background');
    assert.deepEqual(plan, {
      vibrate: false,
      actions: [{ type: 'post-summary', count: 2 }],
      next: { ids: [a, b], summaryShown: true },
    });
  });

  it('a second request replaces the single with a summary of both', () => {
    const shown: ShownNotifications = { ids: [a], summaryShown: false };
    const plan = planNewRequests(shown, [b], 'inactive');
    assert.deepEqual(plan.actions, [
      { type: 'dismiss', id: a },
      { type: 'post-summary', count: 2 },
    ]);
    assert.deepEqual(plan.next, { ids: [a, b], summaryShown: true });
  });

  it('more requests update the summary count', () => {
    const shown: ShownNotifications = { ids: [a, b], summaryShown: true };
    const plan = planNewRequests(shown, [c], 'background');
    assert.deepEqual(plan.actions, [{ type: 'post-summary', count: 3 }]);
    assert.deepEqual(plan.next, { ids: [a, b, c], summaryShown: true });
  });

  it('ignores requests already notified', () => {
    const shown: ShownNotifications = { ids: [a], summaryShown: false };
    assert.deepEqual(planNewRequests(shown, [a], 'background'), {
      vibrate: false,
      actions: [],
      next: shown,
    });
  });
});

describe('planGoneRequests', () => {
  const a = requestNotificationId('standard', 'a');
  const b = requestNotificationId('out_of_area', 'b');
  const c = requestNotificationId('standard', 'c');

  it('removes the single of a request that is gone', () => {
    const plan = planGoneRequests({ ids: [a], summaryShown: false }, [a]);
    assert.deepEqual(plan, {
      actions: [{ type: 'dismiss', id: a }],
      next: { ids: [], summaryShown: false },
    });
  });

  it('ignores requests that were never notified', () => {
    const shown: ShownNotifications = { ids: [a], summaryShown: false };
    assert.deepEqual(planGoneRequests(shown, [b]), { actions: [], next: shown });
  });

  it('keeps the summary while one of its requests is still open', () => {
    const plan = planGoneRequests({ ids: [a, b, c], summaryShown: true }, [a, c]);
    assert.deepEqual(plan, { actions: [], next: { ids: [b], summaryShown: true } });
  });

  it('removes the summary once all of its requests are gone', () => {
    const plan = planGoneRequests({ ids: [a, b], summaryShown: true }, [b, a]);
    assert.deepEqual(plan, {
      actions: [{ type: 'dismiss', id: SUMMARY_NOTIFICATION_ID }],
      next: NO_SHOWN_NOTIFICATIONS,
    });
  });
});

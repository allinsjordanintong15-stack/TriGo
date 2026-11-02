/// <reference types="node" />

// Ride-request notification helpers (src/utils/requestNotification.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildNotificationData,
  decideAlert,
  formatRequestNotification,
  formatSummaryNotification,
  MAX_PLACE_LABEL_LENGTH,
  parseNotificationData,
  placeLabel,
  REQUEST_NOTIFICATION_TITLE,
  requestNotificationId,
  SUMMARY_NOTIFICATION_ID,
  truncate,
  type NotificationTarget,
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

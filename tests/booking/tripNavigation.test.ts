/// <reference types="node" />

// Driver trip navigation helpers (src/utils/tripNavigation.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  googleMapsDirectionsUrl,
  isActiveTripStatus,
  navigationTarget,
} from '../../src/utils/tripNavigation.ts';

describe('navigationTarget', () => {
  it('heads to the pickup before the trip starts', () => {
    assert.equal(navigationTarget('accepted'), 'pickup');
    assert.equal(navigationTarget('arrived'), 'pickup');
  });

  it('heads to the destination once the trip is in progress', () => {
    assert.equal(navigationTarget('in_progress'), 'destination');
  });

  it('offers no navigation for pending or finished bookings', () => {
    assert.equal(navigationTarget('pending'), null);
    assert.equal(navigationTarget('completed'), null);
    assert.equal(navigationTarget('cancelled'), null);
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('builds a Maps directions URL to the point, 6 decimals, driving', () => {
    assert.equal(
      googleMapsDirectionsUrl({ latitude: 10.0797123456, longitude: 124.3436 }),
      'https://www.google.com/maps/dir/?api=1&destination=10.079712%2C124.343600&travelmode=driving',
    );
  });

  it('keeps negative coordinates', () => {
    assert.match(googleMapsDirectionsUrl({ latitude: -1.5, longitude: -2.25 }), /destination=-1\.500000%2C-2\.250000&/);
  });
});

describe('isActiveTripStatus', () => {
  it('is true only while the driver is on the trip', () => {
    assert.deepEqual(
      (['pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'] as const).map(isActiveTripStatus),
      [false, true, true, true, false, false],
    );
  });
});

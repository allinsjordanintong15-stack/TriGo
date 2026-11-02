/// <reference types="node" />

// Ride-request notification channels (src/utils/notificationChannels.ts): the current
// channel is new (channel settings cannot change once created) and the old one is deleted.
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LEGACY_RIDE_REQUEST_CHANNEL_IDS,
  legacyChannelsToDelete,
  RIDE_REQUEST_CHANNEL_ID,
} from '../../src/utils/notificationChannels.ts';

describe('ride-request notification channels', () => {
  it('the current channel is not one of the old ones (its settings could not change otherwise)', () => {
    assert.equal(RIDE_REQUEST_CHANNEL_ID, 'ride-requests-private');
    assert.ok(!LEGACY_RIDE_REQUEST_CHANNEL_IDS.includes(RIDE_REQUEST_CHANNEL_ID));
    assert.ok(LEGACY_RIDE_REQUEST_CHANNEL_IDS.includes('ride-requests'));
  });

  it('deletes the old channel when it is on the phone', () => {
    assert.deepEqual(legacyChannelsToDelete(['ride-requests', 'ride-requests-private']), ['ride-requests']);
  });

  it('deletes nothing else: not the current channel, not other apps’ or Expo’s channels', () => {
    assert.deepEqual(legacyChannelsToDelete(['ride-requests-private', 'expo_notifications_fallback_notification_channel']), []);
    assert.deepEqual(legacyChannelsToDelete([]), []);
  });
});

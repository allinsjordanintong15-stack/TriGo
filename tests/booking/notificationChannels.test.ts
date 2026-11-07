/// <reference types="node" />

// Ride-request notification channels (src/utils/notificationChannels.ts): the current
// channel is new (channel settings cannot change once created) and the old one is deleted.
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LEGACY_RIDE_REQUEST_CHANNEL_IDS,
  legacyChannelsToDelete,
  RIDE_REQUEST_CHANNEL_ID,
} from '../../src/utils/notificationChannels.ts';

describe('ride-request notification channels', () => {
  it('the current channel is not one of the old ones (its settings could not change otherwise)', () => {
    assert.equal(RIDE_REQUEST_CHANNEL_ID, 'ride-requests-private-v2');
    assert.ok(!LEGACY_RIDE_REQUEST_CHANNEL_IDS.includes(RIDE_REQUEST_CHANNEL_ID));
    assert.deepEqual([...LEGACY_RIDE_REQUEST_CHANNEL_IDS], ['ride-requests', 'ride-requests-private']);
  });

  it('deletes both old channels when they are on the phone', () => {
    assert.deepEqual(
      legacyChannelsToDelete(['ride-requests', 'ride-requests-private', 'ride-requests-private-v2']),
      ['ride-requests', 'ride-requests-private'],
    );
    assert.deepEqual(legacyChannelsToDelete(['ride-requests-private', 'ride-requests-private-v2']), [
      'ride-requests-private',
    ]);
  });

  it('deletes nothing else: not the current channel, not other apps’ or Expo’s channels', () => {
    assert.deepEqual(legacyChannelsToDelete(['ride-requests-private-v2', 'expo_notifications_fallback_notification_channel']), []);
    assert.deepEqual(legacyChannelsToDelete([]), []);
  });

  // expo-notifications reads a string `sound` as a custom sound file name ('default'
  // included): "Custom sound 'default' not found in native app".
  it("the service never passes sound: 'default' (channel: no sound key; content: sound: true)", () => {
    const service = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'services', 'localNotificationService.ts'),
      'utf8',
    );
    assert.doesNotMatch(service, /sound:\s*['"]/);
    const channel = service.slice(service.indexOf('setNotificationChannelAsync('));
    assert.doesNotMatch(channel.slice(0, channel.indexOf('});')), /\bsound\s*:/);
    assert.match(service, /sound: true/);
  });
});

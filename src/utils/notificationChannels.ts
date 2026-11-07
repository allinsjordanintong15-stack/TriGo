// Android notification channel IDs for ride requests. A channel's settings (importance,
// sound, vibration, lock-screen visibility) are fixed once it exists on a phone, so a
// change of settings needs a new ID, and the old channel is deleted. No imports, so plain
// Node tests can load this file.

/**
 * Current channel: lock-screen visibility PRIVATE, so on a phone with a secure lock screen
 * the fare and places are hidden until the phone is unlocked; the phone's default
 * notification sound (no `sound` in the channel settings).
 */
export const RIDE_REQUEST_CHANNEL_ID = 'ride-requests-private-v2';

/** Earlier ride-request channels, deleted when the current one is set up. */
export const LEGACY_RIDE_REQUEST_CHANNEL_IDS: readonly string[] = [
  // Until 2026-11: lock-screen visibility PUBLIC (details shown on the lock screen).
  'ride-requests',
  // 2026-11-02 to 2026-11-07: created with sound 'default', which expo-notifications reads
  // as a custom sound file that does not exist ("Custom sound 'default' not found").
  'ride-requests-private',
];

/** The legacy channels that still exist on this phone (only those are deleted). */
export function legacyChannelsToDelete(existingChannelIds: readonly string[]): string[] {
  return LEGACY_RIDE_REQUEST_CHANNEL_IDS.filter((id) => existingChannelIds.includes(id));
}

// Which open requests are new since the driver last looked, for the new-request vibration.
// Alias-free and without imports, so plain Node tests can load this file.

/** Android: wait 0 ms, vibrate 400 ms, pause 200 ms, vibrate 400 ms. iOS vibrates once. */
export const NEW_REQUEST_VIBRATION_PATTERN = [0, 400, 200, 400];

/** At most one vibration this often, e.g. when a standard and an out-of-area request arrive together. */
export const MIN_VIBRATION_GAP_MS = 3000;

/** Seen-set key: standard bookings and out-of-area requests can share a document ID. */
export function standardRequestKey(bookingId: string): string {
  return `booking:${bookingId}`;
}

export function outOfAreaRequestKey(requestId: string): string {
  return `request:${requestId}`;
}

/** True while the request is still open: it has an expiry and that is after `now`. */
export function isUnexpired(expiresAt: Date | null, now: number): boolean {
  return expiresAt !== null && expiresAt.getTime() > now;
}

/**
 * The keys in `keys` not in `seen` (each once, in order). On the baseline snapshot (the
 * first one after the driver became able to receive requests) nothing is new: the
 * requests already open then are only remembered, never alerted.
 */
export function findNewRequestKeys(
  seen: ReadonlySet<string>,
  keys: readonly string[],
  isBaseline: boolean,
): string[] {
  if (isBaseline) return [];
  const fresh: string[] = [];
  for (const key of keys) {
    if (!seen.has(key) && !fresh.includes(key)) fresh.push(key);
  }
  return fresh;
}

// Turns a failed Firestore read into a message an admin can act on, and logs the original
// error to the browser console (codes: https://firebase.google.com/docs/reference/js/firestore_.firestoreerrorcode).

const MESSAGES: Record<string, string> = {
  // A composite index is missing or still building (new indexes take a few minutes).
  'failed-precondition': "This list isn't ready yet: a database index is still being set up. Try again in a few minutes.",
  'permission-denied': "You don't have permission to view this list.",
};

const CONNECTION_CODES = new Set(['unavailable', 'deadline-exceeded']);

/** `connectionMessage` is the page's own "check your connection" text. */
export function listLoadErrorMessage(error: unknown, connectionMessage: string): string {
  console.error('Admin list failed to load:', error);
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && code in MESSAGES) return MESSAGES[code];
  // No code at all usually means the request never reached Firestore (offline, blocked).
  if (code === undefined || (typeof code === 'string' && CONNECTION_CODES.has(code))) return connectionMessage;
  return 'Something went wrong while loading this list. Reload the page; if it keeps happening, tell the TriGo team.';
}

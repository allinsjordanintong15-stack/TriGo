// Whether a user must accept the Privacy Notice and Terms (again), and the "You agreed to …"
// line on Profile → Privacy Policy & Terms. Relative .ts imports only, so plain Node tests
// can load this file.

import { LEGAL_VERSION } from '../../shared/legal/meta.ts';
import { formatDate } from './dateTime.ts';

interface ConsentLike {
  version: string;
  acceptedAt: Date;
}

/**
 * True when the user has not accepted the current version: no consent recorded (accounts
 * from before consent existed) or an older version. The app then shows the full-screen
 * re-consent notice.
 */
export function needsLegalConsent(
  consent: ConsentLike | null | undefined,
  currentVersion: string = LEGAL_VERSION,
): boolean {
  return !consent || consent.version !== currentVersion;
}

/** "You agreed to version 1.0 on Nov 7, 2026." or "You have not agreed to these yet." */
export function legalConsentLine(consent: ConsentLike | null | undefined): string {
  if (!consent) return 'You have not agreed to these yet.';
  return `You agreed to version ${consent.version} on ${formatDate(consent.acceptedAt)}.`;
}

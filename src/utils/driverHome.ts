// Driver Home screen text that depends on account state. Relative imports of files without
// imports, so plain Node tests can load this file (tests/booking/driverHome.test.ts).

import { COMMISSION_DUE_SOON_HOURS } from '../constants/commission.ts';
import type { CommissionStatus, CommissionStatusSummary } from './commission.ts';
import type { QuotaStatus } from './dailyQuota.ts';

const HOUR_MS = 60 * 60 * 1000;

/**
 * True when Home should show the gold "Commission due" banner: the running period is owed
 * (status 'due') and COMMISSION_DUE_SOON_HOURS or less are left until its due time.
 * Always false for other statuses; the overdue and suspended banners do not use this.
 */
export function isCommissionDueSoon(
  summary: Pick<CommissionStatusSummary, 'status' | 'dueAtMillis'>,
  nowMillis: number,
  dueSoonHours: number = COMMISSION_DUE_SOON_HOURS,
): boolean {
  return (
    summary.status === 'due' &&
    summary.dueAtMillis !== null &&
    summary.dueAtMillis - nowMillis <= dueSoonHours * HOUR_MS
  );
}

export interface AcceptRestriction {
  title: string;
  message: string;
}

/**
 * Why a driver who may stay online cannot accept new requests right now, shown next to
 * the duty switch; null when nothing blocks accepting. Going online is never blocked by
 * these (firestore.rules only refuse new accepts and out-of-area proposals).
 */
export function getAcceptRestriction(
  commission: CommissionStatus | null,
  quota: QuotaStatus | null,
): AcceptRestriction | null {
  const suspended = commission === 'suspended';
  const atLimit = quota?.reached === true;
  if (!suspended && !atLimit) return null;

  const reasons: string[] = [];
  if (suspended) {
    reasons.push(
      'Your commission is overdue and the grace period has ended. Pay on the Earnings tab; you can accept again once TriGo confirms your payment.',
    );
  }
  if (atLimit && quota) {
    reasons.push(
      `You reached today's limit of ${quota.limit} accepted passengers. You can accept again after 12:00 AM.`,
    );
  }

  return {
    title: 'You can stay online, but cannot accept new requests',
    message: `${reasons.join(' ')} You can still finish your current trip.`,
  };
}

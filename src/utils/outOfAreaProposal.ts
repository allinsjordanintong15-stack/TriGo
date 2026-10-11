import { OutOfAreaRequest } from '@/types';

/**
 * Where a driver's fare proposal stands:
 * - waiting: the passenger can still accept or decline
 * - accepted: the passenger accepted; the booking is created in a later step
 * - declined / cancelled / expired / unavailable: the request no longer holds the driver,
 *   so their reservation (drivers/{uid}.currentRequestId) can be released.
 */
export type ProposalState =
  'waiting' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'unavailable';

export type ProposalOutcome = Exclude<ProposalState, 'waiting' | 'accepted'>;

/**
 * Mirrors requestHoldsDriver in firestore.rules. `request` is null when it cannot be read
 * (taken by another driver) or no longer exists.
 */
export function getProposalState(
  request: OutOfAreaRequest | null,
  driverId: string,
  now: number,
): ProposalState {
  if (!request) return 'unavailable';
  if (request.status === 'cancelled') return 'cancelled';
  if (request.status === 'expired') return 'expired';
  if (request.status === 'rejected') return 'declined';
  if (request.driverId !== driverId) {
    // Back in the open pool without this driver: the passenger declined the fare.
    return request.status === 'searching' && request.driverId === null ? 'declined' : 'unavailable';
  }
  if (request.status === 'accepted') return 'accepted';
  if (request.status === 'negotiating' || request.status === 'driver_interested') {
    return request.expiresAt !== null && request.expiresAt.getTime() <= now ? 'expired' : 'waiting';
  }
  return 'unavailable';
}

export function isProposalOutcome(state: ProposalState): state is ProposalOutcome {
  return state !== 'waiting' && state !== 'accepted';
}

export const PROPOSAL_OUTCOME_TEXT: Record<ProposalOutcome, { title: string; message: string }> = {
  declined: {
    title: 'Fare declined',
    message: 'The passenger declined your fare.',
  },
  cancelled: {
    title: 'Cancelled by passenger',
    message: 'The passenger cancelled this request.',
  },
  expired: {
    title: 'Request expired',
    message: 'The passenger did not respond in time.',
  },
  unavailable: {
    title: 'Request no longer available',
    message: 'This request was taken or closed.',
  },
};

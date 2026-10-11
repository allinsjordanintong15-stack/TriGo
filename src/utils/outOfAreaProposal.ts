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

/**
 * Where the driver's offer stands for the passenger:
 * - open: the passenger can still accept (negotiating, before expiresAt)
 * - expired: past expiresAt (or no expiry, on old requests); the rules deny accepting
 * - withdrawn: no offer on the request any more (the driver withdrew)
 * - accepted / cancelled: the request is closed
 */
export type PassengerOfferState = 'open' | 'expired' | 'withdrawn' | 'accepted' | 'cancelled';

export function getPassengerOfferState(request: OutOfAreaRequest, now: number): PassengerOfferState {
  if (request.status === 'accepted') return 'accepted';
  if (request.status === 'cancelled' || request.status === 'rejected') return 'cancelled';
  if (request.status === 'expired') return 'expired';
  if (request.expiresAt === null || request.expiresAt.getTime() <= now) return 'expired';
  if (request.status !== 'negotiating' || !request.fareAgreement || !request.driverId) {
    return 'withdrawn';
  }
  return 'open';
}

export const PASSENGER_OFFER_TEXT: Record<
  Exclude<PassengerOfferState, 'open' | 'accepted'>,
  { title: string; message: string }
> = {
  expired: {
    title: 'Request expired',
    message: 'Your request expired before the booking was confirmed. Please request a new ride.',
  },
  withdrawn: {
    title: 'Offer no longer available',
    message: "The driver withdrew their offer. We'll keep looking for another driver.",
  },
  cancelled: {
    title: 'Request closed',
    message: 'This request is no longer open.',
  },
};

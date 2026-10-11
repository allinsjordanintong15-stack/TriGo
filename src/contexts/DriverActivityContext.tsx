import { useDriverAccess } from '@/hooks/useDriverAccess';
import {
  BookingServiceError,
  subscribeToBooking,
  subscribeToOutOfAreaRequest,
} from '@/services/bookingService';
import {
  claimOutOfAreaBooking,
  subscribeToDriverActiveBookings,
} from '@/services/driverBookingService';
import {
  getHiddenRequestIds,
  hideOutOfAreaRequest,
  releaseCancelledBooking,
} from '@/services/driverService';
import { releaseOutOfAreaRequest } from '@/services/fareAgreementService';
import { Booking, OutOfAreaRequest } from '@/types';
import {
  getProposalState,
  isProposalOutcome,
  ProposalOutcome,
  ProposalState,
} from '@/utils/outOfAreaProposal';
import { router } from 'expo-router';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Re-check expiry this long after expiresAt, so the server clock has passed it too. */
const EXPIRY_GRACE_MS = 2000;
/** Wait before releasing, so the driver's own withdraw (which already releases) lands first. */
const RELEASE_DELAY_MS = 1000;
/** Retry a release the rules refused because the server clock had not reached expiresAt. */
const EXPIRED_RELEASE_RETRY_MS = 10000;

export interface FinishedProposal {
  requestId: string;
  outcome: ProposalOutcome;
  /** The request as last seen, for addresses; null if it could not be read. */
  request: OutOfAreaRequest | null;
}

export interface DriverActivityContextValue {
  /** Bookings assigned to this driver that are still in progress (accepted → in_progress). */
  activeBookings: Booking[];
  /** False until the first active-bookings snapshot arrives for a verified driver. */
  loaded: boolean;
  hasActiveTrip: boolean;
  /** The request at drivers/{uid}.currentRequestId, once read (null if unreadable). */
  heldRequest: OutOfAreaRequest | null;
  /** Where the held proposal stands; null when there is none or it is still loading. */
  proposalState: ProposalState | null;
  /** The last proposal that ended for this driver (declined, cancelled, expired…). */
  finishedProposal: FinishedProposal | null;
  dismissFinishedProposal: () => void;
  /** Requests whose fare the passenger declined, hidden from this driver on this device. */
  hiddenRequestIds: string[];
}

const DriverActivityContext = createContext<DriverActivityContextValue | undefined>(undefined);

interface HeldRequestSnapshot {
  requestId: string;
  request: OutOfAreaRequest | null;
}

export function DriverActivityProvider({ children }: { children: ReactNode }) {
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;

  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Firestore rules only let verified drivers read bookings and requests.
  const subscriptionKey = driverId && canPerformDriverActions ? driverId : null;

  useEffect(() => {
    setActiveBookings([]);
    setLoadedFor(null);

    if (!subscriptionKey) return;

    return subscribeToDriverActiveBookings(
      subscriptionKey,
      (bookings) => {
        setActiveBookings(bookings);
        setLoadedFor(subscriptionKey);
      },
      () => {
        setActiveBookings([]);
        setLoadedFor(subscriptionKey);
      },
    );
  }, [subscriptionKey]);

  // Passenger cancellations cannot touch drivers/{uid}, so the driver app releases itself:
  // only when currentBookingId points to a booking that is now `cancelled` do we clear it
  // and restore availability. Completion and driver cancellation clear it in their own commit.
  const currentBookingId = driverRecord?.currentBookingId ?? null;
  const driverRecordRef = useRef(driverRecord);
  driverRecordRef.current = driverRecord;
  const releasingFor = useRef<string | null>(null);

  useEffect(() => {
    if (!currentBookingId) {
      releasingFor.current = null;
      return;
    }

    return subscribeToBooking(
      currentBookingId,
      (booking) => {
        const record = driverRecordRef.current;
        if (
          booking.status !== 'cancelled' ||
          !record ||
          record.currentBookingId !== booking.bookingId ||
          releasingFor.current === booking.bookingId
        ) {
          return;
        }

        releasingFor.current = booking.bookingId;
        releaseCancelledBooking(record).catch(() => {
          // Allow a retry on the next snapshot or app start.
          releasingFor.current = null;
        });
      },
      () => {
        // Booking unreadable (e.g. offline); try again when the subscription restarts.
      },
    );
  }, [currentBookingId]);

  // ─── Out-of-area proposal (drivers/{uid}.currentRequestId) ─────────────────
  // The passenger's decline or cancel, another driver taking the request, or expiry
  // cannot touch drivers/{uid}, so the driver app releases its own reservation once the
  // request no longer holds it (firestore.rules: requestHoldsDriver).

  const currentRequestId = driverRecord?.currentRequestId ?? null;
  const [held, setHeld] = useState<HeldRequestSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [releaseAttempt, setReleaseAttempt] = useState(0);
  const [finishedProposal, setFinishedProposal] = useState<FinishedProposal | null>(null);
  const [hiddenRequestIds, setHiddenRequestIds] = useState<string[]>([]);

  useEffect(() => {
    setHiddenRequestIds([]);
    if (!driverId) return;
    let active = true;
    getHiddenRequestIds(driverId).then((ids) => {
      if (active) setHiddenRequestIds(ids);
    });
    return () => {
      active = false;
    };
  }, [driverId]);

  useEffect(() => {
    setHeld(null);
    if (!currentRequestId || !subscriptionKey) return;

    // A new proposal replaces the last finished one.
    setFinishedProposal(null);

    return subscribeToOutOfAreaRequest(
      currentRequestId,
      (request) => setHeld({ requestId: currentRequestId, request }),
      (error) => {
        // Missing, or no longer readable because another driver holds it now. Other
        // errors (e.g. offline) keep the last state until the listener restarts.
        const code = (error as { code?: string }).code;
        if (error instanceof BookingServiceError || code === 'permission-denied') {
          setHeld({ requestId: currentRequestId, request: null });
        }
      },
    );
  }, [currentRequestId, subscriptionKey]);

  const heldForCurrent = held !== null && held.requestId === currentRequestId ? held : null;
  const proposalState =
    heldForCurrent && driverId ? getProposalState(heldForCurrent.request, driverId, now) : null;

  // Local expiry timer: re-evaluate just after expiresAt, wherever the driver is in the app.
  const heldExpiresAt =
    proposalState === 'waiting' ? (heldForCurrent?.request?.expiresAt?.getTime() ?? null) : null;
  useEffect(() => {
    if (heldExpiresAt === null) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(heldExpiresAt - Date.now(), 0) + EXPIRY_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [heldExpiresAt]);

  useEffect(() => {
    if (!heldForCurrent || !proposalState || !isProposalOutcome(proposalState)) return;

    const { requestId, request } = heldForCurrent;
    const outcome = proposalState;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const releaseTimer = setTimeout(() => {
      const record = driverRecordRef.current;
      // Already released (e.g. the driver withdrew, which releases in the same commit).
      if (!record || record.currentRequestId !== requestId) return;

      releaseOutOfAreaRequest(record)
        .then(async () => {
          setFinishedProposal({ requestId, outcome, request });
          if (outcome === 'declined') {
            setHiddenRequestIds(await hideOutOfAreaRequest(record.driverId, requestId));
          }
        })
        .catch(() => {
          // Expiry can be refused while the server clock is still before expiresAt;
          // other outcomes are retried on the next snapshot.
          if (outcome === 'expired') {
            retryTimer = setTimeout(() => {
              setNow(Date.now());
              setReleaseAttempt((attempt) => attempt + 1);
            }, EXPIRED_RELEASE_RETRY_MS);
          }
        });
    }, RELEASE_DELAY_MS);

    return () => {
      clearTimeout(releaseTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [heldForCurrent, proposalState, releaseAttempt]);

  // ─── Accepted proposal: claim the passenger's booking (bookings/{requestId}) ────────
  // The passenger accepts by creating the booking unassigned; this driver claims it,
  // which moves the reservation to currentBookingId, then opens the trip. Runs whenever
  // the app is open, so a booking accepted while the app was closed is claimed on the next
  // start. If the passenger cancelled the booking instead, release the reservation.
  const acceptedRequestId =
    proposalState === 'accepted' && heldForCurrent ? heldForCurrent.requestId : null;
  const claimingFor = useRef<string | null>(null);

  useEffect(() => {
    if (!acceptedRequestId) {
      claimingFor.current = null;
      return;
    }

    const requestId = acceptedRequestId;
    const request = heldForCurrent?.request ?? null;

    function release(outcome: ProposalOutcome) {
      const record = driverRecordRef.current;
      if (!record || record.currentRequestId !== requestId) return;
      releaseOutOfAreaRequest(record)
        .then(() => setFinishedProposal({ requestId, outcome, request }))
        .catch(() => {
          // Retried on the next snapshot or app start.
        });
    }

    return subscribeToBooking(
      requestId,
      (booking) => {
        const record = driverRecordRef.current;
        if (!record || record.currentRequestId !== requestId) return;

        if (booking.status === 'cancelled') {
          release('cancelled');
          return;
        }
        if (
          booking.status !== 'pending' ||
          booking.driverId !== null ||
          claimingFor.current === requestId
        ) {
          return;
        }

        claimingFor.current = requestId;
        claimOutOfAreaBooking(requestId, record.driverId)
          .then(() => {
            router.push({ pathname: '/driver/trip/[bookingId]', params: { bookingId: requestId } });
          })
          .catch(() => {
            // A passenger cancel that won the race shows up as a cancelled snapshot;
            // anything else (e.g. offline) is retried on the next snapshot.
            claimingFor.current = null;
          });
      },
      (error) => {
        // An accepted request without its booking (created before bookings were made in
        // the accept commit) holds nobody: release.
        if (error instanceof BookingServiceError) release('unavailable');
      },
    );
    // heldForCurrent changes on every request snapshot; only a new accepted request matters.
  }, [acceptedRequestId]);

  const dismissFinishedProposal = useCallback(() => setFinishedProposal(null), []);

  const value = useMemo<DriverActivityContextValue>(
    () => ({
      activeBookings,
      loaded: subscriptionKey !== null && loadedFor === subscriptionKey,
      hasActiveTrip: activeBookings.length > 0,
      heldRequest: heldForCurrent?.request ?? null,
      proposalState,
      finishedProposal,
      dismissFinishedProposal,
      hiddenRequestIds,
    }),
    [
      activeBookings,
      loadedFor,
      subscriptionKey,
      heldForCurrent,
      proposalState,
      finishedProposal,
      dismissFinishedProposal,
      hiddenRequestIds,
    ],
  );

  return <DriverActivityContext.Provider value={value}>{children}</DriverActivityContext.Provider>;
}

export function useDriverActivity(): DriverActivityContextValue {
  const context = useContext(DriverActivityContext);
  if (!context) {
    throw new Error('useDriverActivity must be used within a DriverActivityProvider.');
  }
  return context;
}

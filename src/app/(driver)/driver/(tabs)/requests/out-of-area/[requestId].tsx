import { FareCard } from '@/components/booking/FareCard';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { formatExpiresIn } from '@/components/driver/OutOfAreaRequestCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToOutOfAreaRequest } from '@/services/bookingService';
import {
  createProposal,
  FareAgreementServiceError,
  withdrawProposal,
} from '@/services/fareAgreementService';
import { OutOfAreaRequest } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import {
  getProposalState,
  isProposalOutcome,
  PROPOSAL_OUTCOME_TEXT,
  ProposalState,
} from '@/utils/outOfAreaProposal';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

function goBackToRequests() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/requests');
  }
}

export default function OutOfAreaProposalScreen() {
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = params.requestId ?? '';
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip, finishedProposal, dismissFinishedProposal } = useDriverActivity();

  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!requestId) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    return subscribeToOutOfAreaRequest(
      requestId,
      (updated) => {
        setRequest(updated);
        setUnavailable(false);
        setLoading(false);
      },
      () => {
        // Once another driver takes it, this driver can no longer read the request.
        setUnavailable(true);
        setLoading(false);
      },
    );
  }, [requestId]);

  // Keeps the expiry countdown current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const finished = finishedProposal?.requestId === requestId ? finishedProposal : null;

  function leave() {
    if (finished) dismissFinishedProposal();
    goBackToRequests();
  }

  const header = <ScreenHeader title="Out-of-Area Request" onBack={leave} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  const driverId = driverRecord?.driverId ?? null;
  const visibleRequest = unavailable ? null : request;
  // This driver's proposal: reserved on it, or (older proposals) named on the request.
  const isMine =
    driverId !== null &&
    (driverRecord?.currentRequestId === requestId || visibleRequest?.driverId === driverId);
  const isOpen =
    visibleRequest !== null &&
    visibleRequest.status === 'searching' &&
    visibleRequest.driverId === null &&
    visibleRequest.expiresAt !== null &&
    visibleRequest.expiresAt.getTime() > now;

  const state: ProposalState | 'open' =
    isMine && driverId
      ? getProposalState(visibleRequest, driverId, now)
      : finished
        ? finished.outcome
        : isOpen
          ? 'open'
          : 'unavailable';
  // Details to show: the live request, or the last copy kept when the proposal ended.
  const shown = visibleRequest ?? finished?.request ?? null;

  if (!shown) {
    const text =
      PROPOSAL_OUTCOME_TEXT[state !== 'open' && isProposalOutcome(state) ? state : 'unavailable'];
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon="alert-circle-outline" title={text.title} message={text.message} />
      </View>
    );
  }

  // The admin per-km fare is final. Requests this driver already holds show the stored
  // fare (older requests may carry an amount proposed before the fare was locked).
  const fare = shown.fareAgreement?.driverProposedFare ?? shown.standardEstimatedFare;

  // Why this driver cannot accept right now, mirroring the Firestore rule.
  let blockedReason = '';
  if (!canPerformDriverActions) {
    blockedReason = 'Your account must be verified before you can accept requests.';
  } else if (hasActiveTrip || driverRecord?.currentBookingId) {
    blockedReason = 'Finish your current trip before accepting a request.';
  } else if (driverRecord?.currentRequestId) {
    blockedReason = 'You are already waiting on another passenger. Withdraw first.';
  } else if (!driverRecord?.isOnline || !driverRecord.isAvailable) {
    blockedReason = 'Go online and be available on the Home tab to accept requests.';
  } else if (driverRecord.vehicleType !== shown.vehicleType) {
    blockedReason = 'This request is for a different vehicle type.';
  }

  async function handleAcceptRequest() {
    if (!request || !driverId) return;

    setSubmitting(true);
    setError('');
    try {
      await createProposal({
        requestId: request.requestId,
        standardEstimatedFare: request.standardEstimatedFare,
        driverId,
      });
    } catch (err) {
      setError(
        err instanceof FareAgreementServiceError
          ? err.message
          : 'Unable to accept this request. Please try again.',
      );
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  async function handleWithdraw() {
    if (!driverRecord) return;

    setSubmitting(true);
    setError('');
    try {
      await withdrawProposal(requestId, driverRecord);
      setShowWithdraw(false);
      goBackToRequests();
    } catch (err) {
      setError(
        err instanceof FareAgreementServiceError
          ? err.message
          : 'Unable to withdraw. Please try again.',
      );
      setShowWithdraw(false);
    } finally {
      setSubmitting(false);
    }
  }

  const outcome = state !== 'open' && isProposalOutcome(state) ? state : null;
  const badge =
    state === 'waiting'
      ? 'Accepted · waiting for passenger'
      : state === 'accepted'
        ? 'Passenger accepted · starting trip'
        : outcome
          ? PROPOSAL_OUTCOME_TEXT[outcome].title
          : 'Out-of-area trip';
  const expiresLabel =
    state === 'open' || state === 'waiting' ? formatExpiresIn(shown.expiresAt, now) : '';

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {outcome ? (
          <View style={[styles.card, styles.outcomeCard]}>
            <Text style={styles.outcomeTitle}>{PROPOSAL_OUTCOME_TEXT[outcome].title}</Text>
            <Text style={styles.outcomeMessage}>
              {PROPOSAL_OUTCOME_TEXT[outcome].message}
              {driverRecord?.currentRequestId === requestId
                ? ' Releasing you for other requests…'
                : ' You can take other requests again.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text style={[styles.badge, outcome ? styles.badgeMuted : null]}>{badge}</Text>
            {expiresLabel ? <Text style={styles.expires}>{expiresLabel}</Text> : null}
          </View>
          <RouteTimeline
            pickupAddress={shown.pickupLocation.address}
            destinationAddress={shown.destination.address}
          />
        </View>

        <TripStatsRow distanceKm={shown.distanceKm} vehicleType={shown.vehicleType} />

        <FareCard estimatedFare={fare} agreedFare={fare} isOutOfArea />

        {state === 'accepted' ? (
          <Text style={styles.hint}>
            The passenger confirmed. The trip opens automatically once it is assigned to you.
          </Text>
        ) : null}

        {state === 'open' && blockedReason ? <ErrorBanner message={blockedReason} /> : null}
        <ErrorBanner message={error} />
      </ScrollView>

      {state === 'open' ? (
        <StickyActionBar
          buttonTitle={`Accept request at ${formatPhilippinePeso(fare)}`}
          onPress={() => setShowConfirm(true)}
          disabled={Boolean(blockedReason)}
          loading={submitting}
        />
      ) : state === 'waiting' ? (
        <StickyActionBar
          buttonTitle="Withdraw"
          variant="secondary"
          onPress={() => setShowWithdraw(true)}
          loading={submitting}
        />
      ) : outcome ? (
        <StickyActionBar buttonTitle="Back to requests" onPress={leave} />
      ) : null}

      <ConfirmationDialog
        visible={showConfirm}
        title="Accept this request?"
        message={`The fare for this trip is ${formatPhilippinePeso(fare)}. You will be unavailable for other requests until the passenger confirms or you withdraw.`}
        confirmLabel="Accept"
        cancelLabel="Back"
        loading={submitting}
        onConfirm={handleAcceptRequest}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmationDialog
        visible={showWithdraw}
        title="Withdraw from this request?"
        message="The request goes back to other drivers and you become available again."
        confirmLabel="Withdraw"
        cancelLabel="Keep"
        destructive
        loading={submitting}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdraw(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
    flexShrink: 1,
  },
  badgeMuted: {
    color: colors.textSecondary,
    backgroundColor: colors.border,
  },
  outcomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  outcomeTitle: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  outcomeMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  expires: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.error,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

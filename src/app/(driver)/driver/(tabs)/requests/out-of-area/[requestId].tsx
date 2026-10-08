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
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToOutOfAreaRequest } from '@/services/bookingService';
import {
  createProposal,
  FareAgreementServiceError,
  validateDriverProposedFare,
  withdrawProposal,
} from '@/services/fareAgreementService';
import { OutOfAreaRequest } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Pesos with up to two decimals, e.g. "650" or "650.50". */
const PESO_PATTERN = /^\d+(\.\d{1,2})?$/;

function goBackToRequests() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/requests');
  }
}

/** Parsed fare, or an error message for the input. Empty input is not an error yet. */
function parseFare(input: string, referenceFare: number): { fare: number | null; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { fare: null, error: '' };
  if (!PESO_PATTERN.test(trimmed)) {
    return { fare: null, error: 'Enter an amount in pesos, e.g. 650 or 650.50.' };
  }

  const fare = Number(trimmed);
  const validationError = validateDriverProposedFare(referenceFare, fare);
  return validationError ? { fare: null, error: validationError } : { fare, error: '' };
}

export default function OutOfAreaProposalScreen() {
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = params.requestId ?? '';
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip } = useDriverActivity();

  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [fareInput, setFareInput] = useState('');
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
        // Once another driver takes it (or it is cancelled), this driver can no longer
        // read the request.
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

  const header = <ScreenHeader title="Out-of-Area Request" onBack={goBackToRequests} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  const driverId = driverRecord?.driverId ?? null;
  const isMine = request !== null && driverId !== null && request.driverId === driverId;
  const isExpired = request?.expiresAt ? request.expiresAt.getTime() <= now : false;
  const isOpen =
    request !== null &&
    request.status === 'searching' &&
    request.driverId === null &&
    request.expiresAt !== null &&
    !isExpired;

  if (!request || unavailable || (!isOpen && !isMine)) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="alert-circle-outline"
          title="Request no longer available"
          message="It may have been taken by another driver, cancelled or expired."
        />
      </View>
    );
  }

  const isPending = isMine && ['negotiating', 'driver_interested'].includes(request.status);
  const proposedFare = request.fareAgreement?.driverProposedFare ?? null;
  const { fare, error: fareError } = parseFare(fareInput, request.standardEstimatedFare);

  // Why this driver cannot propose right now, mirroring the Firestore rule.
  let blockedReason = '';
  if (!canPerformDriverActions) {
    blockedReason = 'Your account must be verified before you can propose a fare.';
  } else if (hasActiveTrip || driverRecord?.currentBookingId) {
    blockedReason = 'Finish your current trip before proposing a fare.';
  } else if (driverRecord?.currentRequestId) {
    blockedReason = 'You already have a pending fare proposal. Withdraw it first.';
  } else if (!driverRecord?.isOnline || !driverRecord.isAvailable) {
    blockedReason = 'Go online and be available on the Home tab to propose a fare.';
  } else if (driverRecord.vehicleType !== request.vehicleType) {
    blockedReason = 'This request is for a different vehicle type.';
  }

  async function handleSendProposal() {
    if (!request || !driverId || fare === null) return;

    setSubmitting(true);
    setError('');
    try {
      await createProposal({
        requestId: request.requestId,
        standardEstimatedFare: request.standardEstimatedFare,
        driverProposedFare: fare,
        driverId,
      });
      setFareInput('');
    } catch (err) {
      setError(
        err instanceof FareAgreementServiceError
          ? err.message
          : 'Unable to send your proposal. Please try again.',
      );
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  async function handleWithdraw() {
    if (!request || !driverRecord) return;

    setSubmitting(true);
    setError('');
    try {
      await withdrawProposal(request.requestId, driverRecord);
      setShowWithdraw(false);
      goBackToRequests();
    } catch (err) {
      setError(
        err instanceof FareAgreementServiceError
          ? err.message
          : 'Unable to withdraw your proposal. Please try again.',
      );
      setShowWithdraw(false);
    } finally {
      setSubmitting(false);
    }
  }

  const expiresLabel = formatExpiresIn(request.expiresAt, now);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>
              {isPending
                ? 'Proposal sent · waiting for passenger'
                : isMine && request.status === 'accepted'
                  ? 'Fare accepted by passenger'
                  : 'Out-of-area trip'}
            </Text>
            {expiresLabel && !isMine ? <Text style={styles.expires}>{expiresLabel}</Text> : null}
          </View>
          <RouteTimeline
            pickupAddress={request.pickupLocation.address}
            destinationAddress={request.destination.address}
          />
        </View>

        <TripStatsRow distanceKm={request.distanceKm} vehicleType={request.vehicleType} />

        {isMine && proposedFare !== null ? (
          <FareCard
            estimatedFare={request.standardEstimatedFare}
            agreedFare={proposedFare}
            isOutOfArea
            label={request.status === 'accepted' ? 'Agreed fare' : 'Your proposed fare'}
          />
        ) : (
          <FareCard
            estimatedFare={request.standardEstimatedFare}
            agreedFare={null}
            isOutOfArea={false}
            label="Reference fare"
            fareBasisLabel="Reference only. The passenger agrees to the fare you propose."
          />
        )}

        {isOpen ? (
          <View style={styles.card}>
            <TextInputField
              label="Your fare (₱)"
              value={fareInput}
              onChangeText={(text) => {
                setFareInput(text);
                setError('');
              }}
              placeholder={request.standardEstimatedFare.toFixed(2)}
              keyboardType="decimal-pad"
              maxLength={9}
              error={fareError}
              editable={!blockedReason && !submitting}
            />
            <Text style={styles.hint}>
              The passenger sees this fare and can accept or decline it. There is no counter-offer.
            </Text>
          </View>
        ) : null}

        {isOpen && blockedReason ? <ErrorBanner message={blockedReason} /> : null}
        <ErrorBanner message={error} />
      </ScrollView>

      {isOpen ? (
        <StickyActionBar
          buttonTitle={
            fare !== null ? `Send Proposal · ${formatPhilippinePeso(fare)}` : 'Send Proposal'
          }
          onPress={() => setShowConfirm(true)}
          disabled={fare === null || Boolean(blockedReason)}
          loading={submitting}
        />
      ) : isPending ? (
        <StickyActionBar
          buttonTitle="Withdraw proposal"
          variant="secondary"
          onPress={() => setShowWithdraw(true)}
          loading={submitting}
        />
      ) : null}

      <ConfirmationDialog
        visible={showConfirm && fare !== null}
        title="Send this fare?"
        message={`You are proposing ${fare !== null ? formatPhilippinePeso(fare) : ''} for this trip. You will be unavailable for other requests until the passenger responds or you withdraw.`}
        confirmLabel="Send"
        cancelLabel="Back"
        loading={submitting}
        onConfirm={handleSendProposal}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmationDialog
        visible={showWithdraw}
        title="Withdraw proposal?"
        message="The request goes back to other drivers and you become available again."
        confirmLabel="Withdraw"
        cancelLabel="Keep"
        destructive
        loading={submitting}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdraw(false)}
      />
    </KeyboardAvoidingView>
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

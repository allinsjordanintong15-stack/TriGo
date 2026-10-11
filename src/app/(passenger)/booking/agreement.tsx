import { FareCard } from '@/components/booking/FareCard';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { BookingServiceError, subscribeToOutOfAreaRequest } from '@/services/bookingService';
import { declineProposal } from '@/services/fareAgreementService';
import { OutOfAreaRequest } from '@/types';
import { getPassengerOfferState, PASSENGER_OFFER_TEXT } from '@/utils/outOfAreaProposal';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

/** How long to wait for the driver's offer before showing a way back instead of a spinner. */
const OFFER_LOAD_TIMEOUT_MS = 15 * 1000;

const SEARCH_HREF = '/(passenger)/booking/out-of-area-search';

/**
 * The driver's fare offer. Accepting only moves on to the confirmation screen; the booking
 * is created (and the fare accepted) when the passenger taps Confirm Booking there.
 */
export default function FareAgreementScreen() {
  const { tripRoute, activeOutOfAreaRequestId } = useBookingDraft();
  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      setRequest,
      (err) => {
        setError(
          err instanceof BookingServiceError ? err.message : 'Unable to load the driver\'s offer.',
        );
      },
    );

    return unsubscribe;
  }, [activeOutOfAreaRequestId]);

  // Ticks the expiry countdown (and the switch to the expired state).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const agreement = request?.fareAgreement ?? null;

  // Missing offer: give the snapshot a moment, then stop spinning.
  useEffect(() => {
    if (agreement) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), OFFER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [agreement]);

  function backToSearch() {
    router.dismissTo(SEARCH_HREF);
  }

  async function handleDecline() {
    if (!activeOutOfAreaRequestId || declining) return;

    setDeclining(true);
    setError('');

    try {
      await declineProposal(activeOutOfAreaRequestId);
      backToSearch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to decline the fare. Please try again.',
      );
    } finally {
      setDeclining(false);
    }
  }

  if (!activeOutOfAreaRequestId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Driver's Offer" />
        <EmptyState icon="car-outline" title="No active out-of-area request." />
        <StickyActionBar buttonTitle="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const offerState = request ? getPassengerOfferState(request, now) : null;

  if (offerState === 'accepted' && request) {
    // Reached only by navigating back after confirming: the booking already exists.
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Driver's Offer" />
        <EmptyState
          icon="checkmark-circle-outline"
          title="Fare accepted"
          message="Your booking has been created."
        />
        <StickyActionBar
          buttonTitle="View Booking"
          onPress={() =>
            router.replace({
              pathname: '/(passenger)/booking/status',
              params: { bookingId: request.requestId },
            })
          }
        />
      </View>
    );
  }

  if (offerState === 'expired' || offerState === 'withdrawn' || offerState === 'cancelled') {
    const text = PASSENGER_OFFER_TEXT[offerState];
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Driver's Offer" />
        <EmptyState icon="time-outline" title={text.title} message={text.message} />
        <StickyActionBar buttonTitle="Back to Search" onPress={backToSearch} />
      </View>
    );
  }

  if (!request || !agreement) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Driver's Offer" />
        {timedOut || error ? (
          <>
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load the driver's offer"
              message={error || 'Check your internet connection, then go back to your request.'}
            />
            <StickyActionBar buttonTitle="Back to Search" onPress={backToSearch} />
          </>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading the driver's offer…</Text>
          </View>
        )}
      </View>
    );
  }

  const expiresInMs = request.expiresAt ? request.expiresAt.getTime() - now : 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Driver's Offer" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.badge}>Out-of-Area Trip</Text>
          <RouteTimeline
            pickupAddress={request.pickupLocation.address}
            destinationAddress={request.destination.address}
          />
        </View>

        <TripStatsRow
          distanceKm={request.distanceKm}
          vehicleType={request.vehicleType}
          durationMin={tripRoute?.durationMin ?? null}
        />

        <FareCard
          estimatedFare={request.standardEstimatedFare}
          agreedFare={agreement.driverProposedFare}
          isOutOfArea
          agreedNote="Proposed by your driver. Accept to review and confirm your booking."
        />

        <Text style={styles.expiry}>Offer expires in {formatCountdown(expiresInMs)}</Text>
      </ScrollView>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <StickyActionBar
        buttonTitle="Accept Fare"
        onPress={() => router.push('/(passenger)/booking/confirmation')}
        secondaryTitle="Decline"
        onSecondaryPress={handleDecline}
        secondaryLoading={declining}
      />
    </View>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
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
  badge: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
    backgroundColor: colors.goldLight,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  expiry: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

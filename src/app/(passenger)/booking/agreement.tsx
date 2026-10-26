import { DriverCard } from '@/components/booking/DriverCard';
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
import { getDriverRecord } from '@/services/driverService';
import { declineProposal } from '@/services/fareAgreementService';
import { DriverRecord, OutOfAreaRequest } from '@/types';
import { getPassengerOfferState, PASSENGER_OFFER_TEXT } from '@/utils/outOfAreaProposal';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

/** How long to wait for the driver's details before showing a way back instead of a spinner. */
const OFFER_LOAD_TIMEOUT_MS = 15 * 1000;

const SEARCH_HREF = '/(passenger)/booking/out-of-area-search';

/**
 * A driver accepted the request at the admin per-km fare (final). Confirm only moves on
 * to the confirmation screen; the booking is created when the passenger taps Confirm
 * Booking there. Choose another driver declines this one and keeps searching.
 */
export default function FareAgreementScreen() {
  const { tripRoute, activeOutOfAreaRequestId } = useBookingDraft();
  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [driverRecord, setDriverRecord] = useState<DriverRecord | null>(null);

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      setRequest,
      (err) => {
        setError(
          err instanceof BookingServiceError ? err.message : 'Unable to load your driver.',
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

  // Who is offering: name, vehicle and plate from drivers/{uid}, so the passenger knows
  // what to look for. Optional: if the record cannot be read the card is left out.
  const offeringDriverId = request?.driverId ?? null;
  useEffect(() => {
    setDriverRecord(null);
    if (!offeringDriverId) return;

    let active = true;
    getDriverRecord(offeringDriverId)
      .then((record) => {
        if (active) setDriverRecord(record);
      })
      .catch(() => {
        // Passengers can only read verified drivers; the offer itself still shows.
      });

    return () => {
      active = false;
    };
  }, [offeringDriverId]);

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
        err instanceof Error ? err.message : 'Unable to choose another driver. Please try again.',
      );
    } finally {
      setDeclining(false);
    }
  }

  if (!activeOutOfAreaRequestId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Confirm Your Driver" />
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
        <ScreenHeader title="Confirm Your Driver" />
        <EmptyState
          icon="checkmark-circle-outline"
          title="Driver confirmed"
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
        <ScreenHeader title="Confirm Your Driver" />
        <EmptyState icon="time-outline" title={text.title} message={text.message} />
        <StickyActionBar buttonTitle="Back to Search" onPress={backToSearch} />
      </View>
    );
  }

  if (!request || !agreement) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Confirm Your Driver" />
        {timedOut || error ? (
          <>
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load your driver"
              message={error || 'Check your internet connection, then go back to your request.'}
            />
            <StickyActionBar buttonTitle="Back to Search" onPress={backToSearch} />
          </>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your driver…</Text>
          </View>
        )}
      </View>
    );
  }

  const expiresInMs = request.expiresAt ? request.expiresAt.getTime() - now : 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Confirm Your Driver" />

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

        <Text style={styles.intro}>A driver accepted your out-of-area request.</Text>

        {driverRecord ? <DriverCard driver={driverRecord} /> : null}

        <FareCard
          estimatedFare={agreement.driverProposedFare}
          agreedFare={agreement.driverProposedFare}
          isOutOfArea
        />

        <Text style={styles.expiry}>Confirm within {formatCountdown(expiresInMs)}</Text>
      </ScrollView>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <StickyActionBar
        buttonTitle="Confirm"
        onPress={() => router.push('/(passenger)/booking/confirmation')}
        secondaryTitle="Choose another driver"
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
  intro: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
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

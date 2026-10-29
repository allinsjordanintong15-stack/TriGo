import { FareCard } from '@/components/booking/FareCard';
import { RoutePreviewMap } from '@/components/booking/RoutePreviewMap';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import {
  acceptProposalAndCreateBooking,
  BookingServiceError,
  createStandardBooking,
  FareChangedError,
  ProposalUnavailableError,
  subscribeToOutOfAreaRequest,
} from '@/services/bookingService';
import { OutOfAreaRequest } from '@/types';
import { buildConfirmationQuote } from '@/utils/booking';
import { formatPhilippinePeso } from '@/utils/fare';
import {
  getPassengerOfferState,
  PASSENGER_OFFER_TEXT,
  PassengerOfferState,
  UnavailableOfferReason,
} from '@/utils/outOfAreaProposal';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BookingConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const handleBack = useScreenBack();
  const { passenger } = useAuth();
  const {
    tripQuote,
    tripRoute,
    activeOutOfAreaRequestId,
    fareConfig,
    setTripQuote,
    setBarangayTariffs,
    setActiveBookingId,
    setActiveOutOfAreaRequestId,
  } = useBookingDraft();

  const [outOfAreaRequest, setOutOfAreaRequest] = useState<OutOfAreaRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set when Confirm Booking found the driver's offer gone (withdrawn, expired, closed) or
  // the driver no longer verified (the request is then back to searching).
  const [unavailable, setUnavailable] = useState<UnavailableOfferReason | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      setOutOfAreaRequest,
      () => {},
    );

    return unsubscribe;
  }, [activeOutOfAreaRequestId]);

  // Out-of-area offers expire; re-check every few seconds while this screen is open.
  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [activeOutOfAreaRequestId]);

  if (!tripQuote) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No trip to confirm.</Text>
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const confirmation = buildConfirmationQuote(tripQuote, outOfAreaRequest);
  const isOutOfAreaConfirmation =
    confirmation.isOutOfArea && activeOutOfAreaRequestId !== null;
  // Out-of-area confirmations wait for the request snapshot (and the driver's fare).
  const waitingForAgreedFare = isOutOfAreaConfirmation && confirmation.agreedFare === null;
  const total = isOutOfAreaConfirmation ? confirmation.agreedFare : confirmation.estimatedFare;
  const liveOfferState =
    isOutOfAreaConfirmation && outOfAreaRequest && !loading
      ? getPassengerOfferState(outOfAreaRequest, now)
      : null;
  const unavailableState =
    unavailable ?? (liveOfferState && isUnavailableOffer(liveOfferState) ? liveOfferState : null);

  async function handleConfirm() {
    if (!passenger || !tripQuote) return;

    setLoading(true);
    setError('');

    try {
      let bookingId: string;

      if (isOutOfAreaConfirmation) {
        if (!outOfAreaRequest) return;
        // Accepts the driver's fare and creates the booking in one commit.
        bookingId = await acceptProposalAndCreateBooking(passenger.uid, outOfAreaRequest);
        setActiveOutOfAreaRequestId(null);
      } else {
        bookingId = (await createStandardBooking(passenger.uid, tripQuote, fareConfig.fares))
          .bookingId;
      }

      setActiveBookingId(bookingId);
      router.replace({
        pathname: '/(passenger)/booking/status',
        params: { bookingId },
      });
    } catch (err) {
      if (err instanceof ProposalUnavailableError) {
        setUnavailable(err.state);
        return;
      }
      if (err instanceof FareChangedError) {
        // Show the new fare; the passenger must press Confirm again to book it.
        setTripQuote(err.quote);
        if (err.tariffs) setBarangayTariffs(err.tariffs);
        setError(err.message);
        return;
      }
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to create your booking. Please check your internet connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (unavailableState) {
    const text = PASSENGER_OFFER_TEXT[unavailableState];
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Confirm Out-of-Area Ride" />
        <EmptyState icon="time-outline" title={text.title} message={text.message} />
        <StickyActionBar
          buttonTitle="Back to Search"
          onPress={() => router.dismissTo('/(passenger)/booking/out-of-area-search')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isOutOfAreaConfirmation ? 'Confirm Out-of-Area Ride' : 'Confirm Your Ride'}
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapCard}>
          <RoutePreviewMap
            pickup={tripQuote.pickupLocation}
            destination={tripQuote.destination}
            routeCoordinates={tripRoute?.coordinates ?? null}
          />
        </View>

        <View style={styles.card}>
          <Text style={[styles.badge, isOutOfAreaConfirmation ? styles.badgeOutOfArea : null]}>
            {isOutOfAreaConfirmation ? 'Out-of-Area Trip' : 'Standard Trip'}
          </Text>
          <RouteTimeline
            pickupAddress={tripQuote.pickupLocation.address}
            destinationAddress={tripQuote.destination.address}
          />
        </View>

        <TripStatsRow
          distanceKm={tripQuote.distanceKm}
          vehicleType={tripQuote.vehicleType}
          durationMin={tripRoute?.durationMin ?? null}
        />

        <FareCard
          estimatedFare={confirmation.estimatedFare}
          agreedFare={confirmation.agreedFare}
          isOutOfArea={isOutOfAreaConfirmation}
        />
      </ScrollView>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <StickyActionBar
        buttonTitle={
          total !== null ? `Confirm Booking · ${formatPhilippinePeso(total)}` : 'Confirm Booking'
        }
        loading={loading}
        disabled={waitingForAgreedFare}
        onPress={handleConfirm}
      />
    </View>
  );
}

type UnavailableOfferState = Exclude<PassengerOfferState, 'open' | 'accepted'>;

function isUnavailableOffer(state: PassengerOfferState): state is UnavailableOfferState {
  return state === 'expired' || state === 'withdrawn' || state === 'cancelled';
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
  mapCard: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  badge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  badgeOutOfArea: {
    color: colors.primaryDark,
    backgroundColor: colors.goldLight,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
  },
  empty: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});

import { FareCard } from '@/components/booking/FareCard';
import { RoutePreviewMap } from '@/components/booking/RoutePreviewMap';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import {
  BookingServiceError,
  createOutOfAreaBooking,
  createStandardBooking,
  subscribeToOutOfAreaRequest,
} from '@/services/bookingService';
import { OutOfAreaRequest } from '@/types';
import { buildConfirmationQuote } from '@/utils/booking';
import { formatPhilippinePeso } from '@/utils/fare';
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
    setActiveBookingId,
    setActiveOutOfAreaRequestId,
  } = useBookingDraft();

  const [outOfAreaRequest, setOutOfAreaRequest] = useState<OutOfAreaRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      setOutOfAreaRequest,
      () => {},
    );

    return unsubscribe;
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
  // Out-of-area confirmations wait for the request snapshot (and its agreed fare).
  const waitingForAgreedFare = isOutOfAreaConfirmation && confirmation.agreedFare === null;
  const total = isOutOfAreaConfirmation ? confirmation.agreedFare : confirmation.estimatedFare;

  async function handleConfirm() {
    if (!passenger || !tripQuote) return;

    setLoading(true);
    setError('');

    try {
      let booking;

      if (isOutOfAreaConfirmation && outOfAreaRequest) {
        booking = await createOutOfAreaBooking(passenger.uid, tripQuote, outOfAreaRequest);
        setActiveOutOfAreaRequestId(null);
      } else {
        booking = await createStandardBooking(passenger.uid, tripQuote);
      }

      setActiveBookingId(booking.bookingId);
      router.replace({
        pathname: '/(passenger)/booking/status',
        params: { bookingId: booking.bookingId },
      });
    } catch (err) {
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to create your booking. Please check your internet connection and try again.',
      );
    } finally {
      setLoading(false);
    }
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

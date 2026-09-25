import { TripSummaryCard } from '@/components/booking/TripSummaryCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors, spacing, typography } from '@/constants/theme';
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
  const { passenger } = useAuth();
  const {
    tripQuote,
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
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={styles.title}>
        {isOutOfAreaConfirmation ? 'Confirm Out-of-Area Ride' : 'Confirm Your Ride'}
      </Text>
      <Text style={styles.subtitle}>
        {isOutOfAreaConfirmation
          ? 'Review your agreed fare and trip details before confirming.'
          : 'Review your trip details before searching for a driver.'}
      </Text>

      <ErrorBanner message={error} />

      <TripSummaryCard
        quote={tripQuote}
        bookingTypeLabel={
          isOutOfAreaConfirmation ? 'Out-of-Area Trip' : 'Standard TriGo Booking'
        }
        showFare={false}
      />

      <View style={styles.fareCard}>
        <Text style={styles.fareLabel}>Standard Estimated Fare</Text>
        <Text style={styles.fareValue}>{formatPhilippinePeso(confirmation.estimatedFare)}</Text>

        {confirmation.agreedFare !== null ? (
          <>
            <Text style={styles.fareLabel}>Agreed Fare</Text>
            <Text style={styles.agreedFare}>{formatPhilippinePeso(confirmation.agreedFare)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.fareLabel}>Estimated Fare</Text>
            <Text style={styles.agreedFare}>
              {formatPhilippinePeso(confirmation.estimatedFare)}
            </Text>
          </>
        )}

        <Text style={styles.fareNote}>
          {confirmation.agreedFare !== null
            ? 'This out-of-area fare was agreed upon by you and the driver.'
            : 'This is an estimate only, not a fixed fare.'}
        </Text>
      </View>

      <Button
        title={isOutOfAreaConfirmation ? 'Confirm Booking' : 'Confirm Booking'}
        loading={loading}
        onPress={handleConfirm}
      />
      <View style={styles.spacer} />
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
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
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  fareCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  fareLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  fareValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  agreedFare: {
    ...typography.title,
    fontSize: 24,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  fareNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  spacer: { height: spacing.sm },
});

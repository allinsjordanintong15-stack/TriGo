import { TripSummaryCard } from '@/components/booking/TripSummaryCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { BookingServiceError, createStandardBooking } from '@/services/bookingService';
import { useAuth } from '@/hooks/useAuth';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BookingConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const { tripQuote } = useBookingDraft();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!tripQuote || tripQuote.isOutOfArea) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No standard trip to confirm.</Text>
        <Button title="Back to Home" onPress={() => router.replace('/(passenger)/home' as Href)} />
      </View>
    );
  }

  async function handleConfirm() {
    if (!passenger || !tripQuote) return;

    setLoading(true);
    setError('');

    try {
      await createStandardBooking(passenger.uid, tripQuote);
    } catch (err) {
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to confirm booking. Please try again.',
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
      <Text style={styles.title}>Confirm Your Ride</Text>
      <Text style={styles.subtitle}>
        Review your trip details within Trinidad, Bohol before searching for a driver.
      </Text>

      <ErrorBanner message={error} />

      <TripSummaryCard quote={tripQuote} bookingTypeLabel="Standard TriGo Booking" />

      <Button title="Confirm Booking" loading={loading} onPress={handleConfirm} />
      <View style={styles.spacer} />
      <Button title="Back to Home" variant="secondary" onPress={() => router.back()} />
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
  spacer: { height: spacing.sm },
});

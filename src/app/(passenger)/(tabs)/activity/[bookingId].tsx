import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, typography } from '@/constants/theme';
import { subscribeToBooking } from '@/services/bookingService';
import { Booking } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { getBookingStatusDisplay } from '@/utils/bookingStatus';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDateTime(value: Date | null): string {
  if (!value) return '—';
  return value.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function DetailRow({ label, value, highlight }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          highlight ? styles.rowValueHighlight : null,
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? '';
  const goBack = useScreenBack();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToBooking(
      bookingId,
      (updated) => {
        setBooking(updated);
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(err.message ?? 'Unable to load this booking.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [bookingId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Booking Details" onBack={goBack} />
        <LoadingScreen />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Booking Details" onBack={goBack} />
        <View style={styles.content}>
          <ErrorBanner message={error || 'Booking not found.'} />
          <EmptyState icon="alert-circle-outline" title="Booking not found" />
        </View>
      </View>
    );
  }

  const status = getBookingStatusDisplay(booking.status);
  const vehicleLabel =
    booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1);
  const hasAgreedFare = booking.agreedFare !== null && booking.agreedFare !== booking.estimatedFare;
  const hasFinalFare = booking.finalFare !== null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Booking Details" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <StatusBadge status={booking.status} />
          <Text style={styles.statusMessage}>{status.message}</Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Booking ID" value={booking.bookingId} />
          <DetailRow label="Date" value={formatDateTime(booking.createdAt)} />
          <DetailRow label="Pickup" value={booking.pickupLocation.address} />
          <DetailRow label="Destination" value={booking.destination.address} />
          <DetailRow label="Vehicle" value={vehicleLabel} />
          <DetailRow label="Distance" value={`${booking.distanceKm.toFixed(2)} km`} />
          <DetailRow
            label="Estimated Fare"
            value={formatPhilippinePeso(booking.estimatedFare)}
          />
          {hasAgreedFare ? (
            <DetailRow
              label="Agreed Fare"
              value={formatPhilippinePeso(booking.agreedFare as number)}
              highlight
            />
          ) : null}
          {hasFinalFare ? (
            <DetailRow
              label="Final Fare"
              value={formatPhilippinePeso(booking.finalFare as number)}
              highlight
            />
          ) : null}
          <DetailRow
            label="Driver"
            value={
              booking.driverId
                ? 'Driver assigned'
                : booking.status === 'completed'
                  ? 'No driver recorded'
                  : 'Awaiting driver assignment'
            }
          />
        </View>

        {booking.bookingType === 'out_of_area' ? (
          <Text style={styles.note}>
            This was an out-of-area trip. The agreed fare above was confirmed with the driver.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  rowValueHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});

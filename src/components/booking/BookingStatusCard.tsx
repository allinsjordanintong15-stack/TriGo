import { colors, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { getDisplayFare } from '@/utils/booking';
import { getBookingStatusDisplay } from '@/utils/bookingStatus';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface BookingStatusCardProps {
  booking: Booking;
  loading?: boolean;
}

export function BookingStatusCard({ booking, loading = false }: BookingStatusCardProps) {
  const statusDisplay = getBookingStatusDisplay(booking.status);
  const displayFare = getDisplayFare(booking);

  return (
    <View style={styles.card}>
      <View style={styles.statusHeader}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.statusDot} />
        )}
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusTitle}>{statusDisplay.title}</Text>
          <Text style={styles.statusMessage}>{statusDisplay.message}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Pickup</Text>
      <Text style={styles.value}>{booking.pickupLocation.address}</Text>

      <Text style={styles.label}>Destination</Text>
      <Text style={styles.value}>{booking.destination.address}</Text>

      <Text style={styles.label}>Vehicle</Text>
      <Text style={styles.value}>
        {booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1)}
      </Text>

      <Text style={styles.label}>Distance</Text>
      <Text style={styles.value}>{booking.distanceKm.toFixed(2)} km</Text>

      <Text style={styles.label}>
        {booking.agreedFare !== null ? 'Agreed Fare' : 'Estimated Fare'}
      </Text>
      <Text style={styles.fare}>{formatPhilippinePeso(displayFare)}</Text>

      {booking.agreedFare !== null && booking.estimatedFare !== booking.agreedFare ? (
        <Text style={styles.fareNote}>
          Standard estimated fare was {formatPhilippinePeso(booking.estimatedFare)}.
        </Text>
      ) : (
        <Text style={styles.fareNote}>This is an estimate only, not a fixed fare.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  fare: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  fareNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { formatPaymentMethod } from '@/utils/bookingStatus';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TripHistoryCardProps {
  trip: Booking;
  onPress: () => void;
}

function formatTripDate(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TripHistoryCard({ trip, onPress }: TripHistoryCardProps) {
  const isCompleted = trip.status === 'completed';
  const endedAt = trip.completedAt ?? trip.cancelledAt ?? trip.updatedAt;
  const summary = isCompleted
    ? `${trip.finalFare !== null ? formatPhilippinePeso(trip.finalFare) : '—'} · ${formatPaymentMethod(trip.paymentMethod)}`
    : trip.cancelledBy === 'driver'
      ? 'Cancelled by you'
      : trip.cancelledBy === 'passenger'
        ? 'Cancelled by passenger'
        : 'Cancelled';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Trip to ${trip.destination.address}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <StatusBadge status={trip.status} />
        <Text style={styles.date}>{formatTripDate(endedAt)}</Text>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {trip.pickupLocation.address}
      </Text>
      <Text style={styles.arrow}>↓</Text>
      <Text style={styles.address} numberOfLines={1}>
        {trip.destination.address}
      </Text>

      <View style={styles.bottomRow}>
        <Text style={[styles.summary, isCompleted ? styles.summaryFare : null]}>{summary}</Text>
        <Ionicons name="chevron-forward" color={colors.textMuted} size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  address: {
    ...typography.body,
    color: colors.text,
  },
  arrow: {
    ...typography.caption,
    color: colors.textMuted,
    marginVertical: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  summary: {
    ...typography.label,
    color: colors.textSecondary,
  },
  summaryFare: {
    color: colors.primary,
  },
});

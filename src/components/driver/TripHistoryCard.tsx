import { Ionicons } from '@expo/vector-icons';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { formatPaymentMethod } from '@/utils/bookingStatus';
import { formatDateTime } from '@/utils/dateTime';
import { formatPhilippinePeso } from '@/utils/fare';
import { getFareBasisLabel } from '@/utils/fareBasisLabel';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TripHistoryCardProps {
  trip: Booking;
  onPress: () => void;
}

function cancelledLabel(trip: Booking): string {
  if (trip.cancelledBy === 'driver') return 'Cancelled by you';
  if (trip.cancelledBy === 'passenger') return 'Cancelled by passenger';
  return 'Cancelled';
}

/**
 * One finished trip in the driver's Trips tab, laid out like the passenger Activity card:
 * status and fare, a compact pickup → destination timeline, then when it ended and how
 * it was paid (or who cancelled).
 */
export function TripHistoryCard({ trip, onPress }: TripHistoryCardProps) {
  const isCompleted = trip.status === 'completed';
  const endedAt = trip.completedAt ?? trip.cancelledAt ?? trip.updatedAt;
  const endedLabel = formatDateTime(endedAt);
  const outcome = isCompleted ? formatPaymentMethod(trip.paymentMethod) : cancelledLabel(trip);
  const fareBasis = getFareBasisLabel(trip);
  const fare = isCompleted && trip.finalFare !== null ? formatPhilippinePeso(trip.finalFare) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isCompleted ? 'Completed' : 'Cancelled'} trip to ${trip.destination.address}, ${endedLabel}${fare ? `, ${fare}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <StatusBadge status={trip.status} />
        {fare ? <Text style={styles.fare}>{fare}</Text> : null}
      </View>

      <RouteTimeline
        compact
        pickupAddress={trip.pickupLocation.address}
        destinationAddress={trip.destination.address}
      />

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{endedLabel}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {outcome}
        </Text>
        <Ionicons name="chevron-forward" color={colors.textMuted} size={16} style={styles.chevron} />
      </View>

      {fareBasis ? (
        <Text style={styles.fareBasis} numberOfLines={1}>
          {fareBasis}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.9,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fare: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  metaDot: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  chevron: {
    marginLeft: 'auto',
  },
  fareBasis: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

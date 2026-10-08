import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { Booking } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getDisplayFare } from '@/utils/booking';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface PassengerBookingHistoryCardProps {
  booking: Booking;
  onPress?: () => void;
}

function formatDate(value: Date | null): string {
  if (!value) return '—';
  return value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PassengerBookingHistoryCard({
  booking,
  onPress,
}: PassengerBookingHistoryCardProps) {
  const vehicleLabel = booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <StatusBadge status={booking.status} />
        <Text style={styles.fare}>{formatPhilippinePeso(getDisplayFare(booking))}</Text>
      </View>

      <RouteTimeline
        compact
        pickupAddress={booking.pickupLocation.address}
        destinationAddress={booking.destination.address}
      />

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{vehicleLabel}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.meta}>{formatDate(booking.createdAt)}</Text>
      </View>
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
  },
  metaDot: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { Booking } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';
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

      <View style={styles.route}>
        <View style={styles.routePoints}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <Ionicons name="location" color={colors.primary} size={12} />
        </View>
        <View style={styles.routeText}>
          <Text style={styles.address} numberOfLines={1}>
            {booking.pickupLocation.address}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {booking.destination.address}
          </Text>
        </View>
      </View>

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
    borderRadius: 16,
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
  route: {
    flexDirection: 'row',
  },
  routePoints: {
    width: 16,
    alignItems: 'center',
    marginRight: spacing.sm,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  routeText: {
    flex: 1,
  },
  address: {
    ...typography.body,
    color: colors.text,
    marginBottom: 2,
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

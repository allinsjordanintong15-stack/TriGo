import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { getDisplayFare } from '@/utils/booking';
import { formatPhilippinePeso } from '@/utils/fare';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ActiveTripBannerProps {
  booking: Booking;
  onPress: () => void;
}

/** The driver's current trip on Home; tapping it opens the trip screen. */
export function ActiveTripBanner({ booking, onPress }: ActiveTripBannerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Current trip to ${booking.destination.address}. Open trip.`}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <Text style={styles.caption}>Current trip</Text>
        <StatusBadge status={booking.status} />
      </View>

      <RouteTimeline
        pickupAddress={booking.pickupLocation.address}
        destinationAddress={booking.destination.address}
        compact
      />

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.fareLabel}>Fare</Text>
          <Text style={styles.fare}>{formatPhilippinePeso(getDisplayFare(booking))}</Text>
        </View>
        <View style={styles.open}>
          <Text style={styles.openText}>Open trip</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    gap: spacing.md,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: {
    ...typography.label,
    color: colors.primaryDark,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  fareLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fare: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openText: {
    ...typography.label,
    color: colors.primary,
  },
});

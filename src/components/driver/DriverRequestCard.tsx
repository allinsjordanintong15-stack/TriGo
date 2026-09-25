import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface DriverRequestCardProps {
  booking: Booking;
  /** Straight-line distance from the driver to the pickup, when the driver's position is known. */
  distanceToPickupKm: number | null;
  onPress: () => void;
}

export function formatRequestAge(createdAt: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : createdAt.toLocaleDateString();
}

export function DriverRequestCard({ booking, distanceToPickupKm, onPress }: DriverRequestCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ride request to ${booking.destination.address}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <Text style={styles.fare}>{formatPhilippinePeso(booking.estimatedFare)}</Text>
        <Text style={styles.age}>{formatRequestAge(booking.createdAt)}</Text>
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
        <Text style={styles.meta}>Trip {booking.distanceKm.toFixed(1)} km</Text>
        {distanceToPickupKm !== null ? (
          <>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.meta}>{distanceToPickupKm.toFixed(1)} km to pickup</Text>
          </>
        ) : null}
        <Ionicons
          name="chevron-forward"
          color={colors.textMuted}
          size={16}
          style={styles.chevron}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fare: {
    ...typography.title,
    fontSize: 20,
    color: colors.primary,
  },
  age: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  route: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  routePoints: {
    alignItems: 'center',
    marginRight: spacing.sm,
    paddingTop: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  line: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  address: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  chevron: {
    marginLeft: 'auto',
  },
});

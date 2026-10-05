import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { OutOfAreaRequest } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface OutOfAreaRequestCardProps {
  request: OutOfAreaRequest;
  /** Straight-line distance from the driver to the pickup. */
  distanceToPickupKm: number;
  /** Current time in ms, ticked by the list so every countdown stays in step. */
  now: number;
  onPress: () => void;
}

export function formatExpiresIn(expiresAt: Date | null, now: number): string {
  if (!expiresAt) return '';
  const seconds = Math.floor((expiresAt.getTime() - now) / 1000);
  if (seconds <= 0) return 'Expired';
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `Expires in ${minutes}:${rest}`;
}

export function OutOfAreaRequestCard({
  request,
  distanceToPickupKm,
  now,
  onPress,
}: OutOfAreaRequestCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Out-of-area request to ${request.destination.address}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Ionicons name="navigate-outline" color={colors.primaryDark} size={12} />
          <Text style={styles.badgeText}>Out-of-area</Text>
        </View>
        <Text style={styles.expires}>{formatExpiresIn(request.expiresAt, now)}</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.routePoints}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <Ionicons name="location" color={colors.primary} size={12} />
        </View>
        <View style={styles.routeText}>
          <Text style={styles.address} numberOfLines={1}>
            {request.pickupLocation.address}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {request.destination.address}
          </Text>
        </View>
      </View>

      <View style={styles.fareRow}>
        <Text style={styles.fareLabel}>Reference fare</Text>
        <Text style={styles.fare}>{formatPhilippinePeso(request.standardEstimatedFare)}</Text>
        <Text style={styles.fareNote}>reference only</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Road {request.distanceKm.toFixed(1)} km</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.meta}>{distanceToPickupKm.toFixed(1)} km to pickup</Text>
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
    borderWidth: 1,
    borderColor: colors.accent,
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  expires: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.error,
    fontVariant: ['tabular-nums'],
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
  fareRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fareLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fare: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  fareNote: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.textMuted,
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

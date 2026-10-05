import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { getVehicleOption } from '@/constants/vehicles';
import { DriverRecord } from '@/types';
import { Image, StyleSheet, Text, View } from 'react-native';

interface DriverCardProps {
  /** Null while the assigned driver's record is loading or unreadable. */
  driver: DriverRecord | null;
}

const AVATAR_SIZE = 48;

/** The assigned driver: photo or initials, name, vehicle, plate and rating when known. */
export function DriverCard({ driver }: DriverCardProps) {
  if (!driver) {
    return (
      <View style={styles.card}>
        <Text style={styles.caption}>Your driver</Text>
        <Text style={styles.name}>Driver assigned</Text>
      </View>
    );
  }

  const vehicle = getVehicleOption(driver.vehicleType);
  const plate = driver.vehiclePlate.trim();

  return (
    <View style={[styles.card, styles.row]}>
      {driver.profileImage ? (
        <Image source={{ uri: driver.profileImage }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.initialsAvatar]}>
          <Text style={styles.initials}>{getInitials(driver.fullName)}</Text>
        </View>
      )}

      <View style={styles.details}>
        <Text style={styles.caption}>Your driver</Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {driver.fullName || 'TriGo driver'}
          </Text>
          {driver.rating > 0 ? (
            <Text style={styles.rating}>★ {driver.rating.toFixed(1)}</Text>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {vehicle.icon} {vehicle.label}
          {plate ? ` · ${plate}` : ''}
        </Text>
      </View>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  initialsAvatar: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.label,
    fontSize: 16,
    color: colors.primary,
  },
  details: {
    flex: 1,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
    flexShrink: 1,
  },
  rating: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.gold,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

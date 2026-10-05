import { colors, radius, spacing, typography } from '@/constants/theme';
import { getVehicleOption } from '@/constants/vehicles';
import { VehicleType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TripStatsRowProps {
  distanceKm: number;
  vehicleType: VehicleType;
  /** Estimated driving time; the time cell is hidden when it is not known. */
  durationMin?: number | null;
}

export function TripStatsRow({ distanceKm, vehicleType, durationMin = null }: TripStatsRowProps) {
  const vehicle = getVehicleOption(vehicleType);

  return (
    <View style={styles.row}>
      <Stat
        icon={<StatIcon name="navigate-outline" />}
        value={`${distanceKm.toFixed(2)} km`}
        label="Distance"
      />
      {durationMin != null && durationMin > 0 ? (
        <Stat
          icon={<StatIcon name="time-outline" />}
          value={`~${durationMin} min`}
          label="Est. time"
        />
      ) : null}
      <Stat
        icon={<Text style={styles.emoji}>{vehicle.icon}</Text>}
        value={vehicle.label}
        label="Vehicle"
      />
    </View>
  );
}

function StatIcon({ name }: { name: ComponentProps<typeof Ionicons>['name'] }) {
  return <Ionicons name={name} size={18} color={colors.primary} />;
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  iconWrap: {
    height: 24,
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emoji: {
    fontSize: 20,
  },
  value: {
    ...typography.label,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

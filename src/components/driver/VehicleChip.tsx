import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { VEHICLE_OPTIONS } from '@/constants/vehicles';
import { DriverRecord, VehicleType } from '@/types';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Same icon set as Ionicons (@expo/vector-icons), which has no motorcycle or tricycle. */
const VEHICLE_ICONS: Record<VehicleType, IconName> = {
  motorcycle: 'motorbike',
  tricycle: 'rickshaw',
};

/**
 * "Tricycle · ABC 1234" pill. A stored type the app does not know shows "Vehicle"; a
 * missing plate is left out. Brand, model and color are not needed (null on older records).
 */
export function VehicleChip({
  vehicle,
}: {
  vehicle: Pick<DriverRecord, 'vehicleType' | 'vehiclePlate'>;
}) {
  const typeLabel =
    VEHICLE_OPTIONS.find((option) => option.type === vehicle.vehicleType)?.label ?? 'Vehicle';
  const icon: IconName = VEHICLE_ICONS[vehicle.vehicleType] ?? 'car-outline';
  const plate = (vehicle.vehiclePlate ?? '').trim();
  const text = plate ? `${typeLabel} · ${plate}` : typeLabel;

  return (
    <View accessible accessibilityLabel={`Vehicle: ${text}`} style={styles.chip}>
      <MaterialCommunityIcons name={icon} color={colors.primaryDark} size={16} />
      <Text style={styles.label} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    flexShrink: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryDark,
    flexShrink: 1,
  },
});

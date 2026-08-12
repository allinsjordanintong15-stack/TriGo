import { colors, spacing, typography } from '@/constants/theme';
import { VehicleType } from '@/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'tricycle', label: 'Tricycle', icon: '🛺' },
  { type: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
];

interface VehicleSelectorProps {
  selected: VehicleType | null;
  onSelect: (vehicleType: VehicleType) => void;
}

export function VehicleSelector({ selected, onSelect }: VehicleSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose vehicle</Text>
      <View style={styles.row}>
        {VEHICLE_OPTIONS.map((option) => {
          const isSelected = selected === option.type;
          return (
            <Pressable
              key={option.type}
              style={[styles.card, isSelected ? styles.cardSelected : null]}
              onPress={() => onSelect(option.type)}
            >
              <Text style={styles.icon}>{option.icon}</Text>
              <Text style={[styles.label, isSelected ? styles.labelSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  icon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  labelSelected: {
    color: colors.primary,
  },
});

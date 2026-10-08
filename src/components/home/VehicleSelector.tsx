import { colors, radius, spacing, typography } from '@/constants/theme';
import { VEHICLE_OPTIONS } from '@/constants/vehicles';
import { VehicleType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
            >
              {isSelected ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                  style={styles.check}
                />
              ) : null}
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
    // Same border width in both states so selecting a card does not shift the layout.
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
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

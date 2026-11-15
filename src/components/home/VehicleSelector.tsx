import { colors, radius, spacing, typography } from '@/constants/theme';
import { VEHICLE_OPTIONS } from '@/constants/vehicles';
import { VehicleType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface VehicleSelectorProps {
  selected: VehicleType | null;
  onSelect: (vehicleType: VehicleType) => void;
  /**
   * Short side-by-side options (icon and label in one row, ~56 dp tall) without the
   * "Choose vehicle" title, for the booking sheet. Off by default.
   */
  compact?: boolean;
}

export function VehicleSelector({ selected, onSelect, compact = false }: VehicleSelectorProps) {
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {!compact ? <Text style={styles.title}>Choose vehicle</Text> : null}
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={compact ? 'Choose vehicle' : undefined}
      >
        {VEHICLE_OPTIONS.map((option) => {
          const isSelected = selected === option.type;
          return (
            <Pressable
              key={option.type}
              style={[
                styles.card,
                compact ? styles.cardCompact : null,
                isSelected ? styles.cardSelected : null,
              ]}
              onPress={() => onSelect(option.type)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
            >
              {isSelected && !compact ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                  style={styles.check}
                />
              ) : null}
              <Text style={compact ? styles.iconCompact : styles.icon}>{option.icon}</Text>
              <Text
                style={[styles.label, isSelected ? styles.labelSelected : null]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {/* Compact: the check sits in the row instead of the corner. */}
              {isSelected && compact ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              ) : null}
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
  containerCompact: {
    marginBottom: spacing.sm,
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
  cardCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
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
  iconCompact: {
    fontSize: 22,
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

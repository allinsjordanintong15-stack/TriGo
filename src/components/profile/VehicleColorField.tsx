import { TextInputField } from '@/components/ui/TextInputField';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { VEHICLE_COLORS } from '@/constants/vehicles';
import { VEHICLE_COLOR_MAX_LENGTH } from '@/validations/driverApplication';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface VehicleColorFieldProps {
  value: string;
  onChange: (color: string) => void;
  error?: string;
}

function isListedColor(value: string): boolean {
  return (VEHICLE_COLORS as readonly string[]).includes(value);
}

/** Common colors as chips, plus "Other" to type any color (e.g. "Blue/White"). */
export function VehicleColorField({ value, onChange, error }: VehicleColorFieldProps) {
  // A stored color that is not in the list (e.g. on resubmission) opens "Other".
  const [otherSelected, setOtherSelected] = useState(() => value !== '' && !isListedColor(value));

  function selectColor(color: string) {
    setOtherSelected(false);
    onChange(color);
  }

  function selectOther() {
    if (otherSelected) return;
    setOtherSelected(true);
    onChange('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Color</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {VEHICLE_COLORS.map((color) => {
          const selected = !otherSelected && value === color;
          return (
            <Chip key={color} label={color} selected={selected} onPress={() => selectColor(color)} />
          );
        })}
        <Chip label="Other" selected={otherSelected} onPress={selectOther} />
      </View>
      {otherSelected ? (
        <TextInputField
          label="Other color"
          value={value}
          onChangeText={onChange}
          error={error}
          autoCapitalize="words"
          placeholder="e.g. Blue/White"
          maxLength={VEHICLE_COLOR_MAX_LENGTH}
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected ? styles.chipSelected : null]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
    >
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    // Same border width in both states so selecting a chip does not shift the layout.
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipLabel: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});

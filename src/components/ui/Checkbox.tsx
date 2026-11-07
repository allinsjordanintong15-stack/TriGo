import { colors, radius, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown under the box and announced with it; also turns the border red. */
  error?: string;
  disabled?: boolean;
}

/** A labelled checkbox with a 48 dp touch target. */
export function Checkbox({ label, checked, onChange, error, disabled }: CheckboxProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={label}
        accessibilityHint={error}
        disabled={disabled}
        style={styles.row}
        hitSlop={4}
        onPress={() => onChange(!checked)}
      >
        <View style={[styles.box, checked ? styles.boxChecked : null, error ? styles.boxError : null]}>
          {checked ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Width of the box plus its gap, to indent content under the label. */
export const CHECKBOX_INDENT = 26 + spacing.md;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.md,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.error,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

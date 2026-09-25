import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface LocationInputProps {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onPress: () => void;
  /** Tighter, single-line layout for use inside the floating map card. */
  compact?: boolean;
  /** Shows a clear (✕) button while the field has a value. */
  onClear?: () => void;
}

export function LocationInput({
  label,
  value,
  placeholder,
  active,
  onPress,
  compact = false,
  onClear,
}: LocationInputProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || placeholder}`}
      style={[
        styles.container,
        compact ? styles.containerCompact : null,
        active ? styles.containerActive : null,
      ]}
      onPress={onPress}
    >
      <View style={[styles.dot, active ? styles.dotActive : null]} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text
          style={[styles.value, compact ? styles.valueCompact : null, !value ? styles.placeholder : null]}
          numberOfLines={compact ? 1 : 2}
        >
          {value || placeholder}
        </Text>
      </View>
      {active ? <Text style={styles.hint}>Tap map</Text> : null}
      {!active && value && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()}`}
          hitSlop={8}
          onPress={onClear}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  containerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
    marginRight: spacing.md,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  valueCompact: {
    fontSize: 15,
  },
  placeholder: {
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

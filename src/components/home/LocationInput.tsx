import { colors, spacing, typography } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface LocationInputProps {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onPress: () => void;
}

export function LocationInput({
  label,
  value,
  placeholder,
  active,
  onPress,
}: LocationInputProps) {
  return (
    <Pressable
      style={[styles.container, active ? styles.containerActive : null]}
      onPress={onPress}
    >
      <View style={[styles.dot, active ? styles.dotActive : null]} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, !value ? styles.placeholder : null]} numberOfLines={2}>
          {value || placeholder}
        </Text>
      </View>
      {active ? <Text style={styles.hint}>Tap map</Text> : null}
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
  placeholder: {
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

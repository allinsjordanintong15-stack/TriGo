import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

interface DutyToggleProps {
  isOnline: boolean;
  /** Shown under the title, e.g. why the driver cannot go online yet. */
  caption: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (online: boolean) => void;
}

/** Large Online / Offline duty switch at the top of the driver Home screen. */
export function DutyToggle({
  isOnline,
  caption,
  loading = false,
  disabled = false,
  onChange,
}: DutyToggleProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isOnline, disabled: inactive, busy: loading }}
      accessibilityLabel={isOnline ? 'Online. Tap to go offline.' : 'Offline. Tap to go online.'}
      disabled={inactive}
      onPress={() => onChange(!isOnline)}
      style={[
        styles.card,
        isOnline ? styles.cardOnline : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View style={[styles.dot, isOnline ? styles.dotOnline : null]} />
      <View style={styles.text}>
        <Text style={[styles.title, isOnline ? styles.titleOnline : null]}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
        <Text style={[styles.caption, isOnline ? styles.captionOnline : null]}>{caption}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={isOnline ? colors.white : colors.primary} />
      ) : (
        <Switch
          value={isOnline}
          disabled={inactive}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.gold }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.border}
          // The whole card is the accessible switch.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  cardOnline: {
    backgroundColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textMuted,
  },
  dotOnline: {
    backgroundColor: colors.gold,
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  titleOnline: {
    color: colors.white,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  captionOnline: {
    color: colors.primaryLight,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { AcceptRestriction } from '@/utils/driverHome';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

interface DutyToggleProps {
  isOnline: boolean;
  /** Shown under the title, e.g. why the driver cannot go online yet. */
  caption: string;
  loading?: boolean;
  disabled?: boolean;
  /**
   * Why the driver cannot accept new requests although they may stay online (commission
   * suspension, daily limit). Shown inside the card, under the switch; never disables it.
   */
  notice?: AcceptRestriction | null;
  onChange: (online: boolean) => void;
}

/** Large Online / Offline duty switch at the top of the driver Home screen. */
export function DutyToggle({
  isOnline,
  caption,
  loading = false,
  disabled = false,
  notice = null,
  onChange,
}: DutyToggleProps) {
  const inactive = disabled || loading;

  return (
    <View
      style={[
        styles.card,
        isOnline ? styles.cardOnline : styles.cardOffline,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: isOnline, disabled: inactive, busy: loading }}
        accessibilityLabel={isOnline ? 'Online. Tap to go offline.' : 'Offline. Tap to go online.'}
        accessibilityHint={caption}
        disabled={inactive}
        onPress={() => onChange(!isOnline)}
        style={styles.row}
      >
        <View style={[styles.dot, isOnline ? styles.dotOnline : null]} />
        <View style={styles.text}>
          <Text style={[styles.label, isOnline ? styles.captionOnline : null]}>Duty status</Text>
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
            // The whole row is the accessible switch.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </Pressable>

      {notice ? (
        <View accessible accessibilityRole="alert" style={styles.notice}>
          <Ionicons name="alert-circle" color={colors.error} size={20} />
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeMessage}>{notice.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardOffline: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  cardOnline: {
    backgroundColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 96,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
  },
  dotOnline: {
    backgroundColor: colors.gold,
  },
  text: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  title: {
    ...typography.title,
    fontSize: 26,
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
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.errorBackground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noticeText: {
    flex: 1,
  },
  noticeTitle: {
    ...typography.label,
    color: colors.error,
  },
  noticeMessage: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
    marginTop: 2,
  },
});

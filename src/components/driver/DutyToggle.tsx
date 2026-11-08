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

/**
 * Large Online / Offline duty switch at the top of the driver Home screen.
 *
 * Android: the card keeps the same border width in every state and does not clip its
 * children (no overflow: 'hidden'), so going online only changes colors. Changing the
 * border and background of a clipped, elevated view left the content undrawn (a plain
 * green block) on Android.
 */
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
          <Text style={[styles.label, isOnline ? styles.onGreenSoft : null]}>Duty status</Text>
          <Text style={[styles.title, isOnline ? styles.onGreen : null]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          <Text style={[styles.caption, isOnline ? styles.onGreenSoft : null]}>{caption}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={isOnline ? colors.white : colors.primary} />
        ) : (
          <Switch
            value={isOnline}
            disabled={inactive}
            onValueChange={onChange}
            // On: gold track on the green card. Off: grey track on white. White thumb in
            // both states (thumbColor works on Android and iOS; ios_backgroundColor is the
            // iOS off-track fill).
            trackColor={{ false: colors.textMuted, true: colors.gold }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.textMuted}
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
    // Same width in every state; only the color changes.
    borderWidth: 2,
    ...shadow.card,
  },
  cardOffline: {
    backgroundColor: colors.white,
    borderColor: colors.primaryLight,
  },
  cardOnline: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Unverified: a flat grey card (no opacity, so the caption saying why stays readable).
  cardDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
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
  // Gold with a white ring, so it stands out on the green card.
  dotOnline: {
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.white,
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
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  onGreen: {
    color: colors.white,
  },
  onGreenSoft: {
    color: colors.background,
  },
  // A light box inset in the card, readable on both white and green.
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.errorBackground,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
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

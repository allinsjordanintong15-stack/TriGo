import { colors, radius, spacing, typography } from '@/constants/theme';
import { acceptedTodayText, DAILY_LIMIT_REACHED_MESSAGE, QuotaStatus } from '@/utils/dailyQuota';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface DailyQuotaCardProps {
  status: QuotaStatus;
  /** Requests tab: shown only once the limit is reached (a gate). Home: always. */
  onlyWhenReached?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Accepted today: X of N" against the admin's daily acceptance limit, and once it is
 * reached the gate message (no accepting or proposing until 12:00 AM; the current trip can
 * still be finished).
 */
export function DailyQuotaCard({ status, onlyWhenReached = false, style }: DailyQuotaCardProps) {
  if (onlyWhenReached && !status.reached) return null;

  return (
    <View
      accessible
      accessibilityRole={status.reached ? 'alert' : 'summary'}
      style={[styles.container, status.reached ? styles.reached : styles.open, style]}
    >
      <Text style={[styles.title, status.reached ? styles.reachedText : null]}>
        {acceptedTodayText(status)}
      </Text>
      {status.reached ? (
        <Text style={styles.message}>
          {DAILY_LIMIT_REACHED_MESSAGE} You can still finish your current trip.
        </Text>
      ) : (
        <Text style={styles.message}>
          {status.remaining === 1
            ? '1 more passenger can be accepted today.'
            : `${status.remaining} more passengers can be accepted today.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
  },
  open: {
    backgroundColor: colors.surface,
    borderLeftColor: colors.primary,
  },
  reached: {
    backgroundColor: colors.errorBackground,
    borderLeftColor: colors.error,
  },
  title: {
    ...typography.label,
    color: colors.primaryDark,
  },
  reachedText: {
    color: colors.error,
  },
  message: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});

import { colors, radius, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import { centavosToPesos, commissionStatus, formatPeriodEndDay } from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface CommissionBannerProps {
  state: CommissionAccountState;
  onOpen: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Overdue commission notice on Home and Requests: a warning during the grace period, and
 * once it has ended a suspended notice (no new requests until the overdue amount is
 * confirmed paid). Nothing otherwise.
 */
export function CommissionBanner({ state, onOpen, style }: CommissionBannerProps) {
  if (state.loading || state.error || !state.account) return null;
  const summary = commissionStatus(state.account, Date.now());
  if (summary.status !== 'overdue' && summary.status !== 'suspended') return null;

  const suspended = summary.status === 'suspended';
  const amount = formatPhilippinePeso(centavosToPesos(summary.overdueCentavos));
  const graceEnd =
    summary.graceEndsAtMillis !== null ? formatPeriodEndDay(summary.graceEndsAtMillis) : '';

  return (
    <View style={[styles.container, suspended ? styles.suspended : styles.warning, style]}>
      <Text style={[styles.title, suspended ? styles.suspendedText : null]}>
        {suspended ? 'Suspended: commission overdue' : 'Commission overdue'}
      </Text>
      <Text style={styles.message}>
        {suspended
          ? `Your grace period ended on ${graceEnd}. You cannot accept new requests until TriGo confirms your payment of ${amount}. You can still finish your current trip.`
          : `Pay ${amount} by the end of ${graceEnd} to keep accepting new requests.`}
      </Text>
      <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={8} style={styles.linkWrap}>
        <Text style={[styles.link, suspended ? styles.suspendedText : null]}>
          Go to Earnings to pay
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
  },
  warning: {
    backgroundColor: colors.goldLight,
    borderLeftColor: colors.accent,
  },
  suspended: {
    backgroundColor: colors.errorBackground,
    borderLeftColor: colors.error,
  },
  title: {
    ...typography.label,
    color: colors.primaryDark,
  },
  suspendedText: {
    color: colors.error,
  },
  message: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  linkWrap: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

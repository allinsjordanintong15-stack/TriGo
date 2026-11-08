import { colors, radius, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import { centavosToPesos, commissionStatus, formatPeriodEndDay } from '@/utils/commission';
import { formatTimeLeft } from '@/utils/dateTime';
import { isCommissionDueSoon } from '@/utils/driverHome';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface CommissionBannerProps {
  state: CommissionAccountState;
  onOpen: () => void;
  /** Home: also show the running period's amount while it is still due (gold notice). */
  showDue?: boolean;
  /** A ticking clock (useNow) keeps the time left current; defaults to render time. */
  now?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Commission notice on Home and Requests: a warning during the grace period, and once it
 * has ended a suspended notice (no new requests until the overdue amount is confirmed
 * paid). With `showDue`, also a gold notice once the running period's due time is
 * COMMISSION_DUE_SOON_HOURS or less away (isCommissionDueSoon). The state
 * comes from commissionStatus(); nothing is shown when paid up.
 */
export function CommissionBanner({
  state,
  onOpen,
  showDue = false,
  now,
  style,
}: CommissionBannerProps) {
  if (state.loading || state.error || !state.account) return null;
  const nowMillis = now ?? Date.now();
  const summary = commissionStatus(state.account, nowMillis);
  const timeLeft = (deadline: number | null) =>
    deadline !== null && deadline > nowMillis ? formatTimeLeft(deadline - nowMillis) : null;

  if (summary.status === 'due') {
    // Only close to the due time; until then the Home "Commission owed" tile shows it.
    if (!showDue || summary.dueAtMillis === null || !isCommissionDueSoon(summary, nowMillis)) {
      return null;
    }
    const amount = formatPhilippinePeso(centavosToPesos(summary.balanceCentavos));
    const left = timeLeft(summary.dueAtMillis);
    return (
      <View style={[styles.container, styles.due, style]}>
        <Text style={styles.title}>{left ? `Commission due in ${left}` : 'Commission due'}</Text>
        <Text style={styles.message}>
          {`Pay ${amount} by the end of ${formatPeriodEndDay(summary.dueAtMillis)}.`}
        </Text>
        <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.link}>Go to Earnings to pay</Text>
        </Pressable>
      </View>
    );
  }

  if (summary.status !== 'overdue' && summary.status !== 'suspended') return null;

  const suspended = summary.status === 'suspended';
  const amount = formatPhilippinePeso(centavosToPesos(summary.overdueCentavos));
  const graceEnd =
    summary.graceEndsAtMillis !== null ? formatPeriodEndDay(summary.graceEndsAtMillis) : '';
  // Overdue only: the grace period is still running. A suspension has no deadline left.
  const graceLeft = suspended ? null : timeLeft(summary.graceEndsAtMillis);

  return (
    <View style={[styles.container, suspended ? styles.suspended : styles.warning, style]}>
      <Text style={[styles.title, suspended ? styles.suspendedText : null]}>
        {suspended ? 'Suspended: commission overdue' : 'Commission overdue'}
      </Text>
      <Text style={styles.message}>
        {suspended
          ? `Your grace period ended on ${graceEnd}. You cannot accept new requests until TriGo confirms your payment of ${amount}. You can still finish your current trip.`
          : `Pay ${amount} by the end of ${graceEnd}${graceLeft ? ` (${graceLeft} left)` : ''} to keep accepting new requests.`}
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
  due: {
    backgroundColor: colors.goldLight,
    borderLeftColor: colors.gold,
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
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import {
  centavosToPesos,
  CommissionStatus,
  commissionStatus,
  CommissionStatusSummary,
  formatManilaDay,
  formatPeriodEndDay,
  periodEndMillis,
} from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const STATUS_LABELS: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Grace period over',
};

const STATUS_COLORS: Record<CommissionStatus, { bg: string; text: string }> = {
  paid_up: { bg: colors.primaryLight, text: colors.primary },
  due: { bg: colors.goldLight, text: colors.primaryDark },
  overdue: { bg: colors.accent, text: colors.primaryDark },
  suspended: { bg: colors.errorBackground, text: colors.error },
};

function peso(centavos: number): string {
  return formatPhilippinePeso(centavosToPesos(centavos));
}

/** "10%", "7.5%". */
export function formatPercentage(percentage: number): string {
  return `${Number(percentage.toFixed(2))}%`;
}

function statusMessage(summary: CommissionStatusSummary): string {
  const due = summary.dueAtMillis !== null ? formatPeriodEndDay(summary.dueAtMillis) : '';
  const graceEnd =
    summary.graceEndsAtMillis !== null ? formatPeriodEndDay(summary.graceEndsAtMillis) : '';
  switch (summary.status) {
    case 'paid_up':
      return 'You have no commission to pay.';
    case 'due':
      return `Pay by the end of ${due}.`;
    case 'overdue':
      return `Your payment was due by the end of ${due}. Please pay by the end of ${graceEnd} (grace period).`;
    case 'suspended':
      return `Your grace period ended on ${graceEnd}. Please pay as soon as possible.`;
  }
}

interface CommissionCardProps {
  state: CommissionAccountState;
  /** Home shows the balance and status only, with a link to the Earnings tab. */
  variant: 'summary' | 'full';
  onOpen?: () => void;
}

/**
 * The driver's commission: what they owe TriGo on completed trips and by when. Read-only
 * (paying in the app comes with commission payments).
 */
export function CommissionCard({ state, variant, onOpen }: CommissionCardProps) {
  const { loading, error, settings, account } = state;
  const rate = settings
    ? `${formatPercentage(settings.percentage)} of the fare on each completed trip`
    : null;

  let body;
  if (error) {
    body = <Text style={styles.unavailable}>{error}</Text>;
  } else if (loading) {
    body = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  } else if (!account) {
    body = (
      <Text style={styles.message}>
        {settings
          ? `No commission yet. TriGo records ${formatPercentage(settings.percentage)} of the fare when you complete a trip.`
          : 'TriGo does not charge commission at the moment.'}
      </Text>
    );
  } else {
    const summary = commissionStatus(account, Date.now());
    const { current } = account;
    const colorsFor = STATUS_COLORS[summary.status];
    body = (
      <>
        <View style={styles.amountRow}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>
              {summary.overdueCentavos > 0 ? 'Overdue' : 'Balance'}
            </Text>
            <Text style={styles.amount}>
              {peso(summary.overdueCentavos > 0 ? summary.overdueCentavos : summary.balanceCentavos)}
            </Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: colorsFor.bg, color: colorsFor.text }]}>
            {STATUS_LABELS[summary.status]}
          </Text>
        </View>
        <Text style={styles.message}>{statusMessage(summary)}</Text>

        {variant === 'full' ? (
          <View style={styles.details}>
            <DetailRow label="Total balance" value={peso(summary.balanceCentavos)} />
            <DetailRow label="Recorded so far" value={peso(account.accruedCentavos)} />
            <DetailRow label="Paid so far" value={peso(account.paidCentavos)} />
            <DetailRow
              label={`Period ${current.seq}`}
              value={`${formatManilaDay(current.startAtMillis)} – ${formatPeriodEndDay(
                periodEndMillis(current.startAtMillis, current.periodDays),
              )}`}
            />
            {rate ? <Text style={styles.note}>Commission: {rate}.</Text> : null}
            <Text style={styles.note}>
              A new period starts with your first completed trip after the current one ends.
              Paying by GCash in the app is coming soon.
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Commission</Text>
      {body}
      {onOpen ? (
        <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.link}>View earnings</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  amountBlock: {
    flex: 1,
  },
  amountLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  amount: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
  },
  message: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.label,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
  },
  unavailable: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  loading: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  linkWrap: {
    marginTop: spacing.md,
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

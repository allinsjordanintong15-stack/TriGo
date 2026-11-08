import { Button } from '@/components/ui/Button';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import {
  CommissionAccountTimes,
  centavosToPesos,
  CommissionStatus,
  commissionStatus,
  CommissionStatusSummary,
  formatManilaDay,
  formatPeriodEndDay,
  periodEndMillis,
} from '@/utils/commission';
import { formatPayBy, overdueNotice } from '@/utils/commissionText';
import { formatPhilippinePeso } from '@/utils/fare';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const STATUS_LABELS: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended',
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
      return `Your grace period ended on ${graceEnd}. You cannot accept new requests until TriGo confirms your payment of the overdue amount.`;
  }
}

interface CommissionCardProps {
  state: CommissionAccountState;
  /** Home shows the balance and status only, with a link to the Earnings tab. */
  variant: 'summary' | 'full';
  onOpen?: () => void;
  /** Full variant: "Pay now" (shown while something is owed), e.g. scrolls to the form. */
  onPayNow?: () => void;
  /** Full variant: a ticking clock (useNow) for the time left; defaults to render time. */
  now?: number;
}

/**
 * The driver's commission: what they owe TriGo on completed trips and by when. Paying is
 * a separate card on the Earnings tab (CommissionPaymentForm).
 */
export function CommissionCard({ state, variant, onOpen, onPayNow, now }: CommissionCardProps) {
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
  } else if (variant === 'full') {
    body = (
      <FullCommission
        account={account}
        rate={rate}
        nowMillis={now ?? Date.now()}
        onPayNow={onPayNow}
      />
    );
  } else {
    const summary = commissionStatus(account, Date.now());
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

interface FullCommissionProps {
  account: CommissionAccountTimes;
  rate: string | null;
  nowMillis: number;
  onPayNow?: () => void;
}

/** Earnings tab: balance, status, deadline and Pay now; the breakdown folds away. */
function FullCommission({ account, rate, nowMillis, onPayNow }: FullCommissionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const summary = commissionStatus(account, nowMillis);
  const { current } = account;
  const colorsFor = STATUS_COLORS[summary.status];
  const payBy = formatPayBy(summary, nowMillis);
  const owes = summary.balanceCentavos > 0;
  const suspended = summary.status === 'suspended';
  const notice = overdueNotice(summary);

  return (
    <>
      <View style={styles.amountRow}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Balance</Text>
          <Text style={[styles.amount, styles.amountLarge]}>{peso(summary.balanceCentavos)}</Text>
        </View>
        <Text style={[styles.badge, { backgroundColor: colorsFor.bg, color: colorsFor.text }]}>
          {STATUS_LABELS[summary.status]}
        </Text>
      </View>

      {/* Overdue and suspended stay on the card, never only in the details. */}
      {notice ? (
        <View
          accessible
          accessibilityRole="alert"
          style={[styles.alert, suspended ? styles.alertSuspended : styles.alertOverdue]}
        >
          <Text style={[styles.alertTitle, suspended ? styles.alertTitleSuspended : null]}>
            {notice.title}
          </Text>
          <Text style={styles.alertMessage}>{notice.message}</Text>
        </View>
      ) : (
        <Text style={styles.message}>
          {summary.status === 'paid_up' ? statusMessage(summary) : payBy}
        </Text>
      )}
      {summary.status === 'overdue' && payBy ? <Text style={styles.payBy}>{payBy}</Text> : null}

      {owes && onPayNow ? (
        <Button title="Pay now" onPress={onPayNow} style={styles.payNow} />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        onPress={() => setShowDetails((shown) => !shown)}
        style={styles.detailsToggle}
      >
        <Text style={styles.link}>{showDetails ? 'Hide details' : 'View details'}</Text>
        <Ionicons
          name={showDetails ? 'chevron-up' : 'chevron-down'}
          color={colors.primary}
          size={18}
        />
      </Pressable>

      {showDetails ? (
        <View style={styles.details}>
          <DetailRow
            label={`Period ${current.seq}`}
            value={`${formatManilaDay(current.startAtMillis)} – ${formatPeriodEndDay(
              periodEndMillis(current.startAtMillis, current.periodDays),
            )}`}
          />
          <DetailRow label="Total commission (all time)" value={peso(account.accruedCentavos)} />
          <DetailRow label="Paid so far (confirmed)" value={peso(account.paidCentavos)} />
          {rate ? <Text style={styles.note}>Commission: {rate}.</Text> : null}
          <Text style={styles.note}>
            A new period starts with your first completed trip after the current one ends.
            {owes
              ? ' Pay by GCash below; your balance goes down once TriGo confirms the payment.'
              : ''}
          </Text>
        </View>
      ) : null}
    </>
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
  amountLarge: {
    fontSize: 32,
  },
  alert: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  alertOverdue: {
    backgroundColor: colors.goldLight,
    borderLeftColor: colors.accent,
  },
  alertSuspended: {
    backgroundColor: colors.errorBackground,
    borderLeftColor: colors.error,
  },
  alertTitle: {
    ...typography.label,
    color: colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  alertTitleSuspended: {
    color: colors.error,
  },
  alertMessage: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  payBy: {
    ...typography.label,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  payNow: {
    marginTop: spacing.md,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 48,
    marginTop: spacing.xs,
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
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

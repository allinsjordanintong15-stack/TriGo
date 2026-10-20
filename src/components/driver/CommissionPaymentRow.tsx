import { colors, radius, spacing, typography } from '@/constants/theme';
import { CommissionPayment, CommissionPaymentStatus } from '@/services/commissionService';
import { centavosToPesos } from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { StyleSheet, Text, View } from 'react-native';

const STATUS_LABELS: Record<CommissionPaymentStatus, string> = {
  pending: 'Waiting for review',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<CommissionPaymentStatus, { bg: string; text: string }> = {
  pending: { bg: colors.goldLight, text: colors.primaryDark },
  confirmed: { bg: colors.primaryLight, text: colors.primary },
  rejected: { bg: colors.errorBackground, text: colors.error },
};

function formatDate(date: Date | null): string {
  return date
    ? date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
}

/** One reported GCash payment in the Earnings tab's payment history. */
export function CommissionPaymentRow({ payment }: { payment: CommissionPayment }) {
  const statusColors = STATUS_COLORS[payment.status];
  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        <Text style={styles.amount}>
          {formatPhilippinePeso(centavosToPesos(payment.amountCentavos))}
        </Text>
        <Text style={[styles.badge, { backgroundColor: statusColors.bg, color: statusColors.text }]}>
          {STATUS_LABELS[payment.status]}
        </Text>
      </View>
      <Text style={styles.meta} selectable>
        Ref. {payment.reference} · {formatDate(payment.submittedAt)}
      </Text>
      {payment.status === 'rejected' && payment.rejectionReason ? (
        <Text style={styles.reason}>Reason: {payment.rejectionReason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amount: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
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
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  reason: {
    ...typography.caption,
    color: colors.error,
    backgroundColor: colors.errorBackground,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
});

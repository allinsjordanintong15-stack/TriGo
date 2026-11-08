import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import { FaresCollected } from '@/services/driverBookingService';
import { centavosToPesos, commissionStatus, CommissionStatus } from '@/utils/commission';
import { QuotaStatus } from '@/utils/dailyQuota';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface TodaySummaryProps {
  /** Null when the limit has not been read (or cannot be). */
  dailyQuota: QuotaStatus | null;
  /** Fares collected today; null while loading. */
  faresToday: FaresCollected | null;
  faresError: boolean;
  commission: CommissionAccountState;
  /** Clock for the commission balance (useNow). */
  now: number;
}

type TileValue =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'value'; value: string; caption: string; alert?: boolean };

const COMMISSION_CAPTION: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended',
};

function quotaTile(dailyQuota: QuotaStatus | null): TileValue {
  if (!dailyQuota) return { kind: 'unavailable' };
  return {
    kind: 'value',
    value: `${dailyQuota.acceptedToday} of ${dailyQuota.limit}`,
    caption: dailyQuota.reached ? 'Limit reached' : `${dailyQuota.remaining} left`,
    alert: dailyQuota.reached,
  };
}

function faresTile(today: FaresCollected | null, error: boolean): TileValue {
  if (error) return { kind: 'unavailable' };
  if (today === null) return { kind: 'loading' };
  return {
    kind: 'value',
    value: formatPhilippinePeso(today.total),
    caption: `${today.trips} trip${today.trips === 1 ? '' : 's'}`,
  };
}

function commissionTile(commission: CommissionAccountState, now: number): TileValue {
  if (commission.loading) return { kind: 'loading' };
  if (commission.error) return { kind: 'unavailable' };
  // No commission recorded yet (or none set by the admin): nothing is owed.
  if (!commission.account) {
    return { kind: 'value', value: formatPhilippinePeso(0), caption: 'Nothing owed' };
  }
  const summary = commissionStatus(commission.account, now);
  return {
    kind: 'value',
    value: formatPhilippinePeso(centavosToPesos(summary.balanceCentavos)),
    caption: COMMISSION_CAPTION[summary.status],
    alert: summary.status === 'overdue' || summary.status === 'suspended',
  };
}

/** Today at a glance on driver Home: accepted vs limit, fares collected, commission owed. */
export function TodaySummary({
  dailyQuota,
  faresToday,
  faresError,
  commission,
  now,
}: TodaySummaryProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading} accessibilityRole="header">
        Today
      </Text>
      <View style={styles.row}>
        <Tile label="Accepted today" tile={quotaTile(dailyQuota)} />
        <View style={styles.divider} />
        <Tile label="Fares collected" tile={faresTile(faresToday, faresError)} />
        <View style={styles.divider} />
        <Tile label="Commission owed" tile={commissionTile(commission, now)} />
      </View>
    </View>
  );
}

function Tile({ label, tile }: { label: string; tile: TileValue }) {
  const spoken =
    tile.kind === 'loading'
      ? `${label}: loading`
      : tile.kind === 'unavailable'
        ? `${label}: unavailable`
        : `${label}: ${tile.value}, ${tile.caption}`;

  return (
    <View accessible accessibilityLabel={spoken} style={styles.tile}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {tile.kind === 'loading' ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : tile.kind === 'unavailable' ? (
        <Text style={styles.unavailable}>—</Text>
      ) : (
        <>
          <Text
            style={[styles.value, tile.alert ? styles.alert : null]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {tile.value}
          </Text>
          <Text style={[styles.caption, tile.alert ? styles.alert : null]} numberOfLines={1}>
            {tile.caption}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  heading: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  tile: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    minHeight: 34,
  },
  value: {
    ...typography.label,
    fontSize: 18,
    color: colors.primary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  alert: {
    color: colors.error,
  },
  unavailable: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  loading: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});

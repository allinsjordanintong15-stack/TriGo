import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { FaresCollected } from '@/services/driverBookingService';
import { QuotaStatus } from '@/utils/dailyQuota';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface TodaySummaryProps {
  /** Null when the limit has not been read (or cannot be). */
  dailyQuota: QuotaStatus | null;
  /** Fares collected today; null while loading. */
  faresToday: FaresCollected | null;
  faresError: boolean;
}

type TileValue =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'value'; value: string; caption: string; alert?: boolean };

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

/**
 * Today at a glance on driver Home: accepted vs limit and fares collected. The commission
 * balance is the header chip (CommissionChip).
 */
export function TodaySummary({ dailyQuota, faresToday, faresError }: TodaySummaryProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading} accessibilityRole="header">
        Today
      </Text>
      <View style={styles.row}>
        <Tile label="Accepted today" tile={quotaTile(dailyQuota)} />
        <View style={styles.divider} />
        <Tile label="Fares collected" tile={faresTile(faresToday, faresError)} />
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
    marginHorizontal: spacing.md,
  },
  tile: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  value: {
    ...typography.label,
    fontSize: 22,
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

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { FaresCollected } from '@/services/driverBookingService';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface FaresCollectedCardProps {
  /** Null while loading. */
  today: FaresCollected | null;
  thisWeek: FaresCollected | null;
  error: boolean;
  onViewHistory: () => void;
}

/**
 * Fares collected on the driver's completed trips (sum of finalFare). These are gross
 * amounts: commission is not shown until the commission feature exists.
 */
export function FaresCollectedCard({
  today,
  thisWeek,
  error,
  onViewHistory,
}: FaresCollectedCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Fares collected</Text>
      <Text style={styles.subtitle}>Before commission</Text>

      <View style={styles.columns}>
        <Period label="Today" value={today} error={error} />
        <View style={styles.divider} />
        <Period label="This week" value={thisWeek} error={error} />
      </View>

      <Pressable accessibilityRole="button" onPress={onViewHistory} hitSlop={8}>
        <Text style={styles.link}>View trip history</Text>
      </Pressable>
    </View>
  );
}

function Period({
  label,
  value,
  error,
}: {
  label: string;
  value: FaresCollected | null;
  error: boolean;
}) {
  return (
    <View style={styles.period}>
      <Text style={styles.periodLabel}>{label}</Text>
      {error ? (
        <Text style={styles.unavailable}>Unavailable</Text>
      ) : value === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          <Text style={styles.amount}>{formatPhilippinePeso(value.total)}</Text>
          <Text style={styles.trips}>
            {value.trips} trip{value.trips === 1 ? '' : 's'}
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
    padding: spacing.lg,
    ...shadow.card,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  columns: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  period: {
    flex: 1,
  },
  periodLabel: {
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
  trips: {
    ...typography.caption,
    color: colors.textSecondary,
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
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

import { CommissionCard, formatPercentage } from '@/components/driver/CommissionCard';
import { FaresCollectedCard } from '@/components/driver/FaresCollectedCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useCommissionAccount } from '@/hooks/useCommissionAccount';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { useFaresCollected } from '@/hooks/useFaresCollected';
import {
  CommissionCursor,
  CommissionRecord,
  CommissionServiceError,
  fetchDriverCommissions,
} from '@/services/commissionService';
import { centavosToPesos } from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function errorMessage(err: unknown): string {
  return err instanceof CommissionServiceError
    ? err.message
    : 'Unable to load your commission history. Please try again.';
}

function formatCompletedAt(date: Date | null): string {
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

/**
 * Earnings: fares collected (before commission), the commission owed to TriGo, and the
 * commission recorded on each completed trip. Read-only.
 */
export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { driverRecord } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;
  const fares = useFaresCollected(driverId);
  const commission = useCommissionAccount(driverId);

  const [commissions, setCommissions] = useState<CommissionRecord[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const cursor = useRef<CommissionCursor | null>(null);

  // Reload the first page whenever the tab gains focus, so just-finished trips appear.
  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      fetchDriverCommissions(driverId)
        .then((page) => {
          if (!active) return;
          cursor.current = page.cursor;
          setCommissions(page.commissions);
          setHasMore(page.hasMore);
          setError('');
        })
        .catch((err) => {
          if (!active) return;
          setCommissions((current) => current ?? []);
          setError(errorMessage(err));
        });

      return () => {
        active = false;
      };
    }, [driverId]),
  );

  async function loadMore() {
    if (!driverId || !cursor.current) return;

    setLoadingMore(true);
    try {
      const page = await fetchDriverCommissions(driverId, cursor.current);
      cursor.current = page.cursor;
      setCommissions((current) => {
        const known = new Set((current ?? []).map((item) => item.bookingId));
        return [...(current ?? []), ...page.commissions.filter((item) => !known.has(item.bookingId))];
      });
      setHasMore(page.hasMore);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Earnings" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {driverRecord ? (
          <>
            <FaresCollectedCard
              today={fares.today}
              thisWeek={fares.thisWeek}
              error={fares.error}
              onViewHistory={() => router.navigate('/driver/trips')}
            />

            <CommissionCard state={commission} variant="full" />

            <Text style={styles.sectionTitle}>Commission per trip</Text>
            <ErrorBanner message={error} />

            {commissions === null && !error ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : null}

            {commissions !== null && commissions.length === 0 && !error ? (
              <Text style={styles.muted}>
                Commission is recorded here when you complete a trip.
              </Text>
            ) : null}

            {(commissions ?? []).map((item) => (
              <CommissionRow
                key={item.bookingId}
                item={item}
                onPress={() =>
                  router.push({
                    pathname: '/driver/trip/[bookingId]',
                    params: { bookingId: item.bookingId },
                  })
                }
              />
            ))}

            {hasMore ? (
              <Button title="Load More" variant="secondary" loading={loadingMore} onPress={loadMore} />
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>Your driver account is not set up yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function CommissionRow({ item, onPress }: { item: CommissionRecord; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Commission ${formatPhilippinePeso(centavosToPesos(item.amountCentavos))} on a ${formatPhilippinePeso(item.finalFare)} trip`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowDate}>
          {formatCompletedAt(item.completedAt)}
          {item.bookingType === 'out_of_area' ? ' · Out-of-area' : ''}
        </Text>
        <Text style={styles.rowFare}>
          Fare {formatPhilippinePeso(item.finalFare)} × {formatPercentage(item.percentage)}
        </Text>
      </View>
      <Text style={styles.rowAmount}>{formatPhilippinePeso(centavosToPesos(item.amountCentavos))}</Text>
      <Ionicons name="chevron-forward" color={colors.textMuted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowMain: {
    flex: 1,
  },
  rowDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rowFare: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  rowAmount: {
    ...typography.label,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
});

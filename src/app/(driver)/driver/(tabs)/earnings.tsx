import { CommissionCard, formatPercentage } from '@/components/driver/CommissionCard';
import { CommissionPaymentForm } from '@/components/driver/CommissionPaymentForm';
import { CommissionPaymentRow } from '@/components/driver/CommissionPaymentRow';
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
  CommissionPayment,
  CommissionRecord,
  CommissionServiceError,
  fetchDriverCommissions,
  fetchDriverPayments,
  getPaymentSettings,
  PaymentCursor,
  PaymentSettings,
} from '@/services/commissionService';
import { centavosToPesos, commissionStatus } from '@/utils/commission';
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
 * Earnings: fares collected (before commission), the commission owed to TriGo, paying it
 * by GCash (reported here, confirmed by an admin), the driver's payments and the
 * commission recorded on each completed trip.
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

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null | undefined>(undefined);
  const [payments, setPayments] = useState<CommissionPayment[] | null>(null);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [loadingMorePayments, setLoadingMorePayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  const paymentsCursor = useRef<PaymentCursor | null>(null);

  // TriGo's GCash account and the first page of payments: on focus and after submitting.
  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      getPaymentSettings()
        .then((settings) => {
          if (active) setPaymentSettings(settings);
        })
        .catch(() => {
          if (active) setPaymentSettings((current) => current ?? null);
        });

      fetchDriverPayments(driverId)
        .then((page) => {
          if (!active) return;
          paymentsCursor.current = page.cursor;
          setPayments(page.payments);
          setPaymentsHasMore(page.hasMore);
          setPaymentsError('');
        })
        .catch((err) => {
          if (!active) return;
          setPayments((current) => current ?? []);
          setPaymentsError(errorMessage(err));
        });

      return () => {
        active = false;
      };
    }, [driverId, paymentsVersion]),
  );

  async function loadMorePayments() {
    if (!driverId || !paymentsCursor.current) return;

    setLoadingMorePayments(true);
    try {
      const page = await fetchDriverPayments(driverId, paymentsCursor.current);
      paymentsCursor.current = page.cursor;
      setPayments((current) => {
        const known = new Set((current ?? []).map((item) => item.paymentId));
        return [...(current ?? []), ...page.payments.filter((item) => !known.has(item.paymentId))];
      });
      setPaymentsHasMore(page.hasMore);
      setPaymentsError('');
    } catch (err) {
      setPaymentsError(errorMessage(err));
    } finally {
      setLoadingMorePayments(false);
    }
  }

  const { reload: reloadCommission } = commission;
  const handlePaymentSubmitted = useCallback(() => {
    reloadCommission();
    setPaymentsVersion((current) => current + 1);
  }, [reloadCommission]);

  const summary = commission.account ? commissionStatus(commission.account, Date.now()) : null;
  const pendingCentavos = (payments ?? [])
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amountCentavos, 0);

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

            {driverId && summary && summary.balanceCentavos > 0 ? (
              <CommissionPaymentForm
                driverId={driverId}
                balanceCentavos={summary.balanceCentavos}
                suggestedCentavos={
                  summary.overdueCentavos > 0 ? summary.overdueCentavos : summary.balanceCentavos
                }
                pendingCentavos={pendingCentavos}
                paymentSettings={paymentSettings}
                onSubmitted={handlePaymentSubmitted}
              />
            ) : null}

            {payments && payments.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Your payments</Text>
                {payments.map((payment) => (
                  <CommissionPaymentRow key={payment.paymentId} payment={payment} />
                ))}
                {paymentsHasMore ? (
                  <Button
                    title="Load More"
                    variant="secondary"
                    loading={loadingMorePayments}
                    onPress={loadMorePayments}
                  />
                ) : null}
              </>
            ) : null}
            <ErrorBanner message={paymentsError} />

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

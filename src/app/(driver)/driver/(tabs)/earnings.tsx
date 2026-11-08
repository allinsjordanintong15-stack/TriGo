import { CommissionCard, formatPercentage } from '@/components/driver/CommissionCard';
import { CommissionPaymentForm } from '@/components/driver/CommissionPaymentForm';
import { CommissionPaymentRow } from '@/components/driver/CommissionPaymentRow';
import { FaresCollectedCard } from '@/components/driver/FaresCollectedCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useCommissionAccount } from '@/hooks/useCommissionAccount';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { useFaresCollected } from '@/hooks/useFaresCollected';
import { useNow } from '@/hooks/useNow';
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
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateTime } from '@/utils/dateTime';

function errorMessage(err: unknown): string {
  return err instanceof CommissionServiceError
    ? err.message
    : 'Unable to load your commission history. Please try again.';
}

/** History rows shown at first and added by each "Show more". */
const HISTORY_STEP = 5;

type HistoryTab = 'payments' | 'trips';

const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: 'payments', label: 'Payments' },
  { value: 'trips', label: 'Per trip' },
];

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
  // Keeps the "Pay by … · time left" line current while the tab is open.
  const clock = useNow(60 * 1000);

  const [commissions, setCommissions] = useState<CommissionRecord[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const cursor = useRef<CommissionCursor | null>(null);
  const commissionsLoad = useRef(0);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null | undefined>(undefined);
  const [payments, setPayments] = useState<CommissionPayment[] | null>(null);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [loadingMorePayments, setLoadingMorePayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  const paymentsCursor = useRef<PaymentCursor | null>(null);
  const paymentsLoad = useRef(0);

  const [historyTab, setHistoryTab] = useState<HistoryTab>('payments');
  const [paymentsVisible, setPaymentsVisible] = useState(HISTORY_STEP);
  const [commissionsVisible, setCommissionsVisible] = useState(HISTORY_STEP);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const payFormY = useRef<number | null>(null);

  // TriGo's GCash account and the first page of payments. A newer load (or leaving the
  // tab) makes an older one's result be ignored.
  const loadPayments = useCallback(async () => {
    if (!driverId) return;
    const loadId = ++paymentsLoad.current;

    const settingsLoad = getPaymentSettings()
      .then((settings) => {
        if (loadId === paymentsLoad.current) setPaymentSettings(settings);
      })
      .catch(() => {
        if (loadId === paymentsLoad.current) setPaymentSettings((current) => current ?? null);
      });

    const paymentsPage = fetchDriverPayments(driverId)
      .then((page) => {
        if (loadId !== paymentsLoad.current) return;
        paymentsCursor.current = page.cursor;
        setPayments(page.payments);
        setPaymentsHasMore(page.hasMore);
        setPaymentsError('');
      })
      .catch((err) => {
        if (loadId !== paymentsLoad.current) return;
        setPayments((current) => current ?? []);
        setPaymentsError(errorMessage(err));
      });

    await Promise.all([settingsLoad, paymentsPage]);
  }, [driverId]);

  // On focus and after submitting a payment (paymentsVersion).
  useFocusEffect(
    useCallback(() => {
      void loadPayments();
      return () => {
        paymentsLoad.current += 1;
      };
    }, [loadPayments, paymentsVersion]),
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

  // The first page of per-trip commissions.
  const loadCommissions = useCallback(async () => {
    if (!driverId) return;
    const loadId = ++commissionsLoad.current;
    try {
      const page = await fetchDriverCommissions(driverId);
      if (loadId !== commissionsLoad.current) return;
      cursor.current = page.cursor;
      setCommissions(page.commissions);
      setHasMore(page.hasMore);
      setError('');
    } catch (err) {
      if (loadId !== commissionsLoad.current) return;
      setCommissions((current) => current ?? []);
      setError(errorMessage(err));
    }
  }, [driverId]);

  // Reload the first page whenever the tab gains focus, so just-finished trips appear.
  useFocusEffect(
    useCallback(() => {
      void loadCommissions();
      return () => {
        commissionsLoad.current += 1;
      };
    }, [loadCommissions]),
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

  /** Pull-to-refresh: fares, commission account, payments and per-trip commissions. */
  async function handleRefresh() {
    setRefreshing(true);
    reloadCommission();
    try {
      await Promise.all([fares.reload(), loadPayments(), loadCommissions()]);
    } finally {
      setRefreshing(false);
    }
  }

  /** Shows 5 more loaded rows, fetching the next page once the loaded rows run out. */
  function showMorePayments() {
    const next = paymentsVisible + HISTORY_STEP;
    setPaymentsVisible(next);
    if (next > (payments?.length ?? 0) && paymentsHasMore) void loadMorePayments();
  }

  function showMoreCommissions() {
    const next = commissionsVisible + HISTORY_STEP;
    setCommissionsVisible(next);
    if (next > (commissions?.length ?? 0) && hasMore) void loadMore();
  }

  function scrollToPayForm() {
    if (payFormY.current === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, payFormY.current - spacing.md), animated: true });
  }

  const owes = summary !== null && summary.balanceCentavos > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Earnings" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          driverRecord ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {driverRecord ? (
          <>
            <FaresCollectedCard
              today={fares.today}
              thisWeek={fares.thisWeek}
              error={fares.error}
              onViewHistory={() => router.navigate('/driver/trips')}
            />

            <CommissionCard
              state={commission}
              variant="full"
              now={clock}
              onPayNow={scrollToPayForm}
            />
            {commission.error ? (
              <Button title="Retry" variant="secondary" onPress={reloadCommission} />
            ) : null}

            {driverId && summary && owes ? (
              <View
                onLayout={(event) => {
                  payFormY.current = event.nativeEvent.layout.y;
                }}
              >
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
              </View>
            ) : null}

            {summary && !owes ? (
              <View accessible style={styles.paidUp}>
                <Ionicons name="checkmark-circle" color={colors.primary} size={22} />
                <Text style={styles.paidUpText}>{"You're all paid up."}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle} accessibilityRole="header">
              History
            </Text>
            <SegmentedControl options={HISTORY_TABS} value={historyTab} onChange={setHistoryTab} />

            {historyTab === 'payments' ? (
              <HistoryList
                items={payments}
                visible={paymentsVisible}
                hasMore={paymentsHasMore}
                loadingMore={loadingMorePayments}
                error={paymentsError}
                emptyTitle="No payments yet"
                emptyMessage="GCash payments you report appear here with their status."
                onShowMore={showMorePayments}
                onRetry={() => void loadPayments()}
                renderItem={(payment) => (
                  <CommissionPaymentRow key={payment.paymentId} payment={payment} />
                )}
              />
            ) : (
              <HistoryList
                items={commissions}
                visible={commissionsVisible}
                hasMore={hasMore}
                loadingMore={loadingMore}
                error={error}
                emptyTitle="No commissions yet"
                emptyMessage="Commission is recorded here when you complete a trip."
                onShowMore={showMoreCommissions}
                onRetry={() => void loadCommissions()}
                renderItem={(item) => (
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
                )}
              />
            )}
          </>
        ) : (
          <Text style={styles.muted}>Your driver account is not set up yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

interface HistoryListProps<T> {
  /** Null while the first page loads. */
  items: T[] | null;
  visible: number;
  hasMore: boolean;
  loadingMore: boolean;
  error: string;
  emptyTitle: string;
  emptyMessage: string;
  onShowMore: () => void;
  onRetry: () => void;
  renderItem: (item: T) => React.ReactNode;
}

/** One history tab: loading, error with Retry, empty, then the first rows and Show more. */
function HistoryList<T>({
  items,
  visible,
  hasMore,
  loadingMore,
  error,
  emptyTitle,
  emptyMessage,
  onShowMore,
  onRetry,
  renderItem,
}: HistoryListProps<T>) {
  if (items === null) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  const shown = items.slice(0, visible);
  const canShowMore = visible < items.length || hasMore;

  return (
    <View style={styles.history}>
      {error ? (
        <>
          <ErrorBanner message={error} />
          <Button title="Retry" variant="secondary" onPress={onRetry} />
        </>
      ) : null}

      {items.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      ) : null}

      {shown.map(renderItem)}

      {canShowMore && items.length > 0 ? (
        <Button title="Show more" variant="secondary" loading={loadingMore} onPress={onShowMore} />
      ) : null}
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
          {formatDateTime(item.completedAt)}
          {item.bookingType === 'out_of_area' ? ' · Out-of-area' : ''}
        </Text>
        <Text style={styles.rowFare}>
          Fare {formatPhilippinePeso(item.finalFare)} × {formatPercentage(item.percentage)}
        </Text>
      </View>
      <Text style={styles.rowAmount}>{formatPhilippinePeso(centavosToPesos(item.amountCentavos))}</Text>
      <Ionicons name="chevron-forward" color={colors.textMuted} size={20} />
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
  paidUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  paidUpText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  history: {
    gap: spacing.md,
  },
  loading: {
    marginVertical: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
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

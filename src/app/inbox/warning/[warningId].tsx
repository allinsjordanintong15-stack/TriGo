import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { getBooking } from '@/services/bookingService';
import { acknowledgeWarning } from '@/services/warningService';
import { Booking } from '@/types';
import { formatDateTime } from '@/utils/dateTime';
import { InboxWarning, WARNING_TITLE } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TripState = { bookingId: string; booking: Booking | null; failed: boolean };

/** One warning: reason, date, related trip, and "I understand" (sets acknowledgedAt once). */
export default function WarningDetailScreen() {
  const insets = useSafeAreaInsets();
  const { warningId } = useLocalSearchParams<{ warningId: string }>();
  const { warnings, error, retry } = useInbox();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const warning = warnings?.find((w) => w.warningId === warningId) ?? null;
  const header = <ScreenHeader title="Warning" onBack={goBack} />;

  async function handleAcknowledge() {
    if (!warning) return;
    setSaving(true);
    setSaveError('');
    try {
      await acknowledgeWarning(warning.warningId);
    } catch {
      setSaveError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <ErrorBanner message={error} />
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      </View>
    );
  }

  if (warnings === null) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  // Missing, or withdrawn by the TriGo team (withdrawn warnings leave the inbox).
  if (!warning || warning.status !== 'active') {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="mail-open-outline"
          title="Message not available"
          message="This message was removed by the TriGo team."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="alert-circle" size={24} color={colors.primary} />
            <Text style={styles.title} accessibilityRole="header">
              {WARNING_TITLE}
            </Text>
          </View>
          <Text style={styles.date}>
            {warning.createdAt ? formatDateTime(warning.createdAt) : 'Just now'}
          </Text>

          <Text style={styles.label}>Reason</Text>
          <Text style={styles.reason}>
            {warning.reason || 'The details of this warning are no longer available.'}
          </Text>

          {warning.bookingId ? <RelatedTrip warning={warning} /> : null}
        </View>

        <Text style={styles.note}>
          Please follow the TriGo rules so every trip stays safe and pleasant. The TriGo team
          reviews repeated warnings and may suspend an account. If you think this is a mistake,
          contact TriGo support (Profile).
        </Text>

        <ErrorBanner message={saveError} />

        {warning.acknowledgedAt ? (
          <View style={styles.acknowledged}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.acknowledgedText}>
              You acknowledged this on {formatDateTime(warning.acknowledgedAt)}.
            </Text>
          </View>
        ) : (
          <Button title="I understand" onPress={() => void handleAcknowledge()} loading={saving} />
        )}
      </ScrollView>
    </View>
  );
}

/** The trip the warning is about: route and date; passengers can open its details. */
function RelatedTrip({ warning }: { warning: InboxWarning }) {
  const bookingId = warning.bookingId ?? '';
  const [trip, setTrip] = useState<TripState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBooking(bookingId).then(
      (booking) => !cancelled && setTrip({ bookingId, booking, failed: false }),
      () => !cancelled && setTrip({ bookingId, booking: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const current = trip?.bookingId === bookingId ? trip : null;
  const booking = current?.booking ?? null;
  const canOpen = warning.role === 'passenger' && booking !== null;

  return (
    <View style={styles.trip}>
      <Text style={styles.label}>Related trip</Text>
      {!current ? (
        <Text style={styles.tripText}>Loading trip…</Text>
      ) : booking ? (
        <>
          <Text style={styles.tripText} numberOfLines={2}>
            {booking.pickupLocation.address} → {booking.destination.address}
          </Text>
          <Text style={styles.date}>{formatDateTime(booking.createdAt)}</Text>
          {canOpen ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                router.push({ pathname: '/activity/[bookingId]', params: { bookingId } })
              }
            >
              <Text style={styles.link}>View trip details</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={styles.tripText}>Trip details are not available.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  reason: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  trip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  tripText: {
    ...typography.body,
    color: colors.text,
  },
  link: {
    ...typography.label,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  acknowledged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  acknowledgedText: {
    ...typography.label,
    color: colors.primary,
    flex: 1,
  },
});

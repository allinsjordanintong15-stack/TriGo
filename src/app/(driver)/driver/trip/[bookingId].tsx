import { TripChoiceDialog, TripChoiceOption } from '@/components/driver/TripChoiceDialog';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DRIVER_CANCELLATION_REASONS } from '@/constants/cancellation';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToBooking } from '@/services/bookingService';
import {
  cancelTripAsDriver,
  completeTrip,
  DriverBookingServiceError,
  markArrived,
  startTrip,
} from '@/services/driverBookingService';
import { Booking, PaymentMethod } from '@/types';
import { canDriverCancelBooking, getDisplayFare } from '@/utils/booking';
import { formatPaymentMethod, getBookingDisplay } from '@/utils/bookingStatus';
import { formatPhilippinePeso } from '@/utils/fare';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// TEMP until Task 4: passenger selects method at booking
const PAYMENT_OPTIONS: readonly TripChoiceOption<PaymentMethod>[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
];

const CANCEL_REASON_OPTIONS: readonly TripChoiceOption<string>[] = DRIVER_CANCELLATION_REASONS.map(
  (reason) => ({ value: reason, label: reason }),
);

type PendingAction = 'arrive' | 'start' | 'complete' | 'cancel' | null;

interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function DetailRow({ label, value, highlight }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight ? styles.rowValueHighlight : null]}>{value}</Text>
    </View>
  );
}

function formatTime(date: Date | null): string | null {
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/home');
  }
}

/** Active ride screen for the assigned driver; read-only once the trip has ended. */
export default function DriverTripScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? '';
  const { driverRecord } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [dialog, setDialog] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      setUnavailable(true);
      return;
    }

    return subscribeToBooking(
      bookingId,
      (updated) => {
        setBooking(updated);
        setUnavailable(false);
        setLoading(false);
      },
      () => {
        setUnavailable(true);
        setLoading(false);
      },
    );
  }, [bookingId]);

  async function runAction(action: () => Promise<void>) {
    setSubmitting(true);
    setError('');
    try {
      await action();
      setDialog(null);
    } catch (err) {
      setDialog(null);
      setError(
        err instanceof DriverBookingServiceError
          ? err.message
          : 'Unable to update this trip. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const header = <ScreenHeader title="Trip" onBack={goBack} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  if (unavailable || !booking || !driverId || booking.driverId !== driverId) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="alert-circle-outline"
          title="Trip not available"
          message="This trip could not be found or is not assigned to you."
        />
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button title="Go to Home" variant="secondary" onPress={() => router.replace('/driver/home')} />
        </View>
      </View>
    );
  }

  const display = getBookingDisplay(booking, 'driver');
  const fare = getDisplayFare(booking);
  const canCancel = canDriverCancelBooking(booking);
  const isFinished = booking.status === 'completed' || booking.status === 'cancelled';
  const vehicleLabel = booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1);
  const timeline = [
    { label: 'Accepted', value: formatTime(booking.acceptedAt) },
    { label: 'Arrived at pickup', value: formatTime(booking.arrivedAt) },
    { label: 'Trip started', value: formatTime(booking.startedAt) },
    { label: 'Completed', value: formatTime(booking.completedAt) },
    { label: 'Cancelled', value: formatTime(booking.cancelledAt) },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== null);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <StatusBadge status={booking.status} />
          <Text style={styles.bannerTitle}>{display.title}</Text>
          <Text style={styles.bannerMessage}>{display.message}</Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Pickup" value={booking.pickupLocation.address} />
          <DetailRow label="Destination" value={booking.destination.address} />
          <DetailRow label="Vehicle type" value={vehicleLabel} />
          <DetailRow label="Trip distance" value={`${booking.distanceKm.toFixed(2)} km`} />
          <DetailRow
            label="Booking type"
            value={booking.bookingType === 'standard' ? 'Standard TriGo booking' : 'Out-of-area trip'}
          />
          <DetailRow
            label={
              booking.finalFare !== null
                ? 'Final fare'
                : booking.agreedFare !== null
                  ? 'Agreed fare'
                  : 'Estimated fare'
            }
            value={formatPhilippinePeso(booking.finalFare ?? fare)}
            highlight
          />
          {booking.status === 'completed' ? (
            <DetailRow label="Payment method" value={formatPaymentMethod(booking.paymentMethod)} />
          ) : null}
        </View>

        {timeline.length > 0 ? (
          <View style={styles.card}>
            {timeline.map((entry) => (
              <DetailRow key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </View>
        ) : null}

        <ErrorBanner message={error} />

        {booking.status === 'accepted' ? (
          <Button title="I've Arrived" onPress={() => setDialog('arrive')} />
        ) : null}
        {booking.status === 'arrived' ? (
          <Button title="Start Trip" onPress={() => setDialog('start')} />
        ) : null}
        {booking.status === 'in_progress' ? (
          <Button title="Complete Trip" onPress={() => setDialog('complete')} />
        ) : null}
        {canCancel ? (
          <>
            <View style={styles.spacer} />
            <Button title="Cancel Trip" variant="secondary" onPress={() => setDialog('cancel')} />
          </>
        ) : null}
        {isFinished ? (
          <Button title="Back to Home" onPress={() => router.replace('/driver/home')} />
        ) : null}
      </ScrollView>

      <ConfirmationDialog
        visible={dialog === 'arrive'}
        title="Arrived at pickup?"
        message="The passenger will be told that you are waiting at the pickup location."
        confirmLabel="I've Arrived"
        loading={submitting}
        onConfirm={() => runAction(() => markArrived(booking.bookingId, driverId))}
        onCancel={() => setDialog(null)}
      />
      <ConfirmationDialog
        visible={dialog === 'start'}
        title="Start the trip?"
        message="Only start once the passenger is on board. The passenger can no longer cancel after this."
        confirmLabel="Start Trip"
        loading={submitting}
        onConfirm={() => runAction(() => startTrip(booking.bookingId, driverId))}
        onCancel={() => setDialog(null)}
      />
      <TripChoiceDialog
        visible={dialog === 'complete'}
        title="Complete the trip"
        options={PAYMENT_OPTIONS}
        confirmLabel="Complete"
        loading={submitting}
        onConfirm={(method) => runAction(() => completeTrip(booking.bookingId, driverId, method))}
        onCancel={() => setDialog(null)}
      >
        <Text style={styles.dialogLabel}>Final fare</Text>
        <Text style={styles.dialogFare}>{formatPhilippinePeso(fare)}</Text>
        <Text style={styles.dialogMessage}>How did the passenger pay?</Text>
      </TripChoiceDialog>
      <TripChoiceDialog
        visible={dialog === 'cancel'}
        title="Cancel this trip?"
        options={CANCEL_REASON_OPTIONS}
        confirmLabel="Cancel Trip"
        loading={submitting}
        onConfirm={(reason) =>
          runAction(() => cancelTripAsDriver(booking.bookingId, driverId, reason))
        }
        onCancel={() => setDialog(null)}
      >
        <Text style={styles.dialogMessage}>
          The passenger will be told you cancelled. Choose a reason:
        </Text>
      </TripChoiceDialog>
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
    paddingTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
  banner: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerTitle: {
    ...typography.label,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  bannerMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  rowValueHighlight: {
    ...typography.title,
    fontSize: 20,
    color: colors.primary,
  },
  spacer: {
    height: spacing.sm,
  },
  dialogLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dialogFare: {
    ...typography.title,
    fontSize: 26,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  dialogMessage: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});

import { ContactCallButton } from '@/components/booking/ContactCallButton';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StatusStepper } from '@/components/booking/StatusStepper';
import { TripChoiceDialog, TripChoiceOption } from '@/components/driver/TripChoiceDialog';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DRIVER_CANCELLATION_REASONS } from '@/constants/cancellation';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { useKeepAwakeWhile } from '@/hooks/useKeepAwakeWhile';
import { useTripContact } from '@/hooks/useTripContact';
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
import { formatPaymentMethod, getBookingDisplay, getBookingProgress } from '@/utils/bookingStatus';
import { formatDateTime } from '@/utils/dateTime';
import { formatPhilippinePeso } from '@/utils/fare';
import { getFareBasisLabel } from '@/utils/fareBasisLabel';
import {
  googleMapsDirectionsUrl,
  isActiveTripStatus,
  navigationTarget,
} from '@/utils/tripNavigation';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

/** Keep-awake lock name for this screen (separate from any other lock). */
const KEEP_AWAKE_TAG = 'driver-trip';

const NAVIGATE_ERROR = 'Could not open Google Maps. Check that Maps or a browser is installed.';

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

interface NavigateButtonProps {
  label: string;
  url: string;
  onError: () => void;
}

/** Opens Google Maps directions; tall, bold and outlined so it is easy to hit while riding. */
function NavigateButton({ label, url, onError }: NavigateButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} in Google Maps`}
      style={({ pressed }) => [styles.navigateButton, pressed ? styles.navigatePressed : null]}
      onPress={() => {
        Linking.openURL(url).catch(onError);
      }}
    >
      <Ionicons name="navigate" size={22} color={colors.primary} />
      <Text style={styles.navigateText}>{label}</Text>
    </Pressable>
  );
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/home');
  }
}

/**
 * Active ride screen for the assigned driver; read-only once the trip has ended. The main
 * action for the current step sits in a large sticky footer, and the screen stays on
 * while the trip is active.
 */
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

  // The passenger's card, readable only while this trip is active (see contacts rules).
  const passengerContact = useTripContact(booking?.passengerId ?? null, booking?.status ?? null);

  // Keep the phone's screen on while this driver is on the trip (accepted → in progress).
  const isMyActiveTrip =
    booking !== null &&
    driverId !== null &&
    booking.driverId === driverId &&
    isActiveTripStatus(booking.status);
  useKeepAwakeWhile(isMyActiveTrip, KEEP_AWAKE_TAG);

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
  const fareBasis = getFareBasisLabel(booking);
  const canCancel = canDriverCancelBooking(booking);
  const isFinished = booking.status === 'completed' || booking.status === 'cancelled';
  const vehicleLabel = booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1);
  const passengerName = passengerContact?.fullName || 'TriGo passenger';

  // Pickup until the trip starts, then the destination.
  const target = navigationTarget(booking.status);
  const navigateTo =
    target === 'pickup'
      ? { label: 'Navigate to pickup', point: booking.pickupLocation }
      : target === 'destination'
        ? { label: 'Navigate to destination', point: booking.destination }
        : null;

  // Full dates for the record once the trip has ended (the stepper shows clock times only).
  const tripTimes = isFinished
    ? [
        { label: 'Accepted', value: booking.acceptedAt && formatDateTime(booking.acceptedAt) },
        { label: 'Arrived at pickup', value: booking.arrivedAt && formatDateTime(booking.arrivedAt) },
        { label: 'Trip started', value: booking.startedAt && formatDateTime(booking.startedAt) },
        { label: 'Completed', value: booking.completedAt && formatDateTime(booking.completedAt) },
        { label: 'Cancelled', value: booking.cancelledAt && formatDateTime(booking.cancelledAt) },
      ].filter((entry): entry is { label: string; value: string } => entry.value !== null)
    : [];

  // The one main action for the current step, shown in the sticky footer.
  const primaryAction =
    booking.status === 'accepted'
      ? { title: "I've Arrived", onPress: () => setDialog('arrive') }
      : booking.status === 'arrived'
        ? { title: 'Start Trip', onPress: () => setDialog('start') }
        : booking.status === 'in_progress'
          ? { title: 'Complete Trip', onPress: () => setDialog('complete') }
          : isFinished
            ? { title: 'Back to Home', onPress: () => router.replace('/driver/home') }
            : null;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: primaryAction ? spacing.lg : insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <StatusBadge status={booking.status} />
          <Text style={styles.statusTitle}>{display.title}</Text>
          <Text style={styles.statusMessage}>{display.message}</Text>
          <View style={styles.stepper}>
            <StatusStepper steps={getBookingProgress(booking)} />
          </View>
        </View>

        {passengerContact ? (
          <View style={styles.card}>
            <View style={styles.contactRow}>
              <Avatar name={passengerName} size={48} />
              <View style={styles.contactText}>
                <Text style={styles.caption}>Passenger</Text>
                <Text style={styles.contactName} numberOfLines={1}>
                  {passengerName}
                </Text>
              </View>
            </View>
            <ContactCallButton
              mobileNumber={passengerContact.mobileNumber}
              calleeLabel="the passenger"
              note="Your number is shared only with your passenger during this trip."
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <RouteTimeline
            pickupAddress={booking.pickupLocation.address}
            destinationAddress={booking.destination.address}
          />
          <Text style={styles.routeMeta}>
            {booking.distanceKm.toFixed(1)} km · {vehicleLabel} ·{' '}
            {booking.bookingType === 'standard' ? 'Standard booking' : 'Out-of-area trip'}
          </Text>
          {navigateTo ? (
            <NavigateButton
              label={navigateTo.label}
              url={googleMapsDirectionsUrl(navigateTo.point)}
              onError={() => setError(NAVIGATE_ERROR)}
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.caption}>{booking.finalFare !== null ? 'Final fare' : 'Fare'}</Text>
          <Text style={styles.fareValue}>{formatPhilippinePeso(booking.finalFare ?? fare)}</Text>
          {fareBasis ? <Text style={styles.fareNote}>{fareBasis}</Text> : null}
          {booking.status === 'completed' ? (
            <Text style={styles.fareNote}>Paid by {formatPaymentMethod(booking.paymentMethod)}</Text>
          ) : null}
        </View>

        {tripTimes.length > 0 ? (
          <View style={[styles.card, styles.listCard]}>
            {tripTimes.map((entry) => (
              <DetailRow key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </View>
        ) : null}

        {/* With a sticky footer the error shows there, next to the button that caused it. */}
        {primaryAction ? null : <ErrorBanner message={error} />}

        {canCancel ? (
          <>
            <Button title="Cancel Trip" variant="secondary" onPress={() => setDialog('cancel')} />
            <View style={styles.spacer} />
          </>
        ) : null}
        <Button
          title="Report a Problem"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/driver/report/[bookingId]',
              params: { bookingId: booking.bookingId },
            })
          }
        />
      </ScrollView>

      {primaryAction ? (
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + spacing.md }]}>
          <ErrorBanner message={error} />
          <Button title={primaryAction.title} size="large" onPress={primaryAction.onPress} />
        </View>
      ) : null}

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
  stickyFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  stepper: {
    marginTop: spacing.md,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contactText: {
    flex: 1,
  },
  contactName: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  routeMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  navigatePressed: {
    opacity: 0.85,
  },
  navigateText: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  fareValue: {
    ...typography.title,
    color: colors.primary,
    marginTop: 2,
  },
  fareNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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

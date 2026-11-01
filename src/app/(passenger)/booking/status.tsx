import { DriverCard } from '@/components/booking/DriverCard';
import { FareCard } from '@/components/booking/FareCard';
import { RoutePreviewMap } from '@/components/booking/RoutePreviewMap';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StatusHeader } from '@/components/booking/StatusHeader';
import { StatusStepper } from '@/components/booking/StatusStepper';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import { useTripContact } from '@/hooks/useTripContact';
import {
  BookingServiceError,
  cancelBooking,
  FareChangedError,
  NO_DRIVER_ACCEPTED_REASON,
  rebookExpiredBooking,
  subscribeToBooking,
} from '@/services/bookingService';
import { getDriverRecord } from '@/services/driverService';
import { getRoadRoute, RoadRoute } from '@/services/routingService';
import { Booking, DriverRecord, Location } from '@/types';
import { canPassengerCancelBooking } from '@/utils/booking';
import { isBookingExpired } from '@/utils/bookingExpiry';
import {
  formatPaymentMethod,
  getBookingProgress,
  getPassengerStatusHeader,
  isActiveBookingStatus,
} from '@/utils/bookingStatus';
import { getFareBasisLabel } from '@/utils/fareBasisLabel';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** After this long without the driver confirming, an out-of-area passenger is told they can cancel. */
const DRIVER_CONFIRM_NOTICE_MS = 2 * 60 * 1000;

export default function BookingStatusScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const {
    activeBookingId,
    setActiveBookingId,
    setActiveOutOfAreaRequestId,
    tripQuote,
    tripRoute,
    setTripQuote,
    setTripRoute,
    setBarangayTariffs,
    fareConfig,
  } = useBookingDraft();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? activeBookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rebooking, setRebooking] = useState(false);
  const [error, setError] = useState('');
  const [assignedDriverRecord, setAssignedDriverRecord] = useState<DriverRecord | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [fetchedRoute, setFetchedRoute] = useState<FetchedRoute | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    setActiveBookingId(bookingId);

    const unsubscribe = subscribeToBooking(
      bookingId,
      (updatedBooking) => {
        setBooking(updatedBooking);
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(
          err instanceof BookingServiceError
            ? err.message
            : 'Unable to load booking status. Please try again.',
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [bookingId, setActiveBookingId]);

  // Once a driver accepts, show who they are (name, vehicle, plate) from drivers/{uid}.
  const assignedDriverId = booking?.driverId ?? null;
  useEffect(() => {
    if (!assignedDriverId) {
      setAssignedDriverRecord(null);
      return;
    }

    let active = true;
    getDriverRecord(assignedDriverId)
      .then((record) => {
        if (active) setAssignedDriverRecord(record);
      })
      .catch(() => {
        // Driver details are optional; the status still shows "Driver Found".
      });

    return () => {
      active = false;
    };
  }, [assignedDriverId]);

  // Bookings do not store the route. Reuse the one the booking was priced on when this is
  // the trip just confirmed; otherwise ask ORS once. Without either, a direct line shows.
  const pickupForRoute = booking?.pickupLocation ?? null;
  const destinationForRoute = booking?.destination ?? null;
  const bookingRouteKey =
    pickupForRoute && destinationForRoute ? routeKey(pickupForRoute, destinationForRoute) : null;
  const contextRoute =
    tripRoute &&
    tripQuote &&
    routeKey(tripQuote.pickupLocation, tripQuote.destination) === bookingRouteKey
      ? tripRoute
      : null;
  const needsFetchedRoute = bookingRouteKey !== null && contextRoute === null;

  useEffect(() => {
    if (!needsFetchedRoute || !pickupForRoute || !destinationForRoute || !bookingRouteKey) return;
    if (fetchedRoute?.key === bookingRouteKey) return;

    let active = true;
    getRoadRoute(pickupForRoute, destinationForRoute).then((route) => {
      if (active) setFetchedRoute({ key: bookingRouteKey, route });
    });
    return () => {
      active = false;
    };
    // Only re-run when the trip's endpoints change, not on every booking snapshot.
  }, [bookingRouteKey, needsFetchedRoute]);

  const route =
    contextRoute ?? (fetchedRoute?.key === bookingRouteKey ? fetchedRoute.route : null);

  // The driver's number, readable only while the trip is active (see contacts rules).
  const driverContact = useTripContact(booking?.driverId ?? null, booking?.status ?? null);

  // Tick while pending: an out-of-area booking waits for its agreed driver to confirm, and
  // a standard booking expires if no driver accepts in time.
  const awaitingDriverConfirm =
    booking?.bookingType === 'out_of_area' && booking.status === 'pending';
  const isPending = booking?.status === 'pending';
  useEffect(() => {
    if (!isPending) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 10 * 1000);
    return () => clearInterval(timer);
  }, [isPending]);

  async function handleConfirmCancel() {
    await handleCancel();
    setShowCancelDialog(false);
  }

  async function handleCancel() {
    if (!bookingId || !passenger || !booking) return;

    setCancelling(true);
    setError('');

    try {
      await cancelBooking(bookingId, passenger.uid);
    } catch (err) {
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to cancel booking. Please try again.',
      );
    } finally {
      setCancelling(false);
    }
  }

  // Expired: book the same trip again in one tap; a changed fare is confirmed first.
  async function handleTryAgain() {
    if (!passenger || !booking) return;

    setRebooking(true);
    setError('');

    try {
      const rebooked = await rebookExpiredBooking(
        passenger.uid,
        booking,
        fareConfig.fares,
        fareConfig.booking.requestExpiryMinutes,
      );
      setActiveBookingId(rebooked.bookingId);
      router.replace({
        pathname: '/(passenger)/booking/status',
        params: { bookingId: rebooked.bookingId },
      });
    } catch (err) {
      if (err instanceof FareChangedError) {
        setActiveOutOfAreaRequestId(null);
        setTripQuote(err.quote);
        setTripRoute(route);
        if (err.tariffs) setBarangayTariffs(err.tariffs);
        router.replace({
          pathname: '/(passenger)/booking/confirmation',
          params: { notice: err.message },
        });
        return;
      }
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to book again. Please check your internet connection and try again.',
      );
    } finally {
      setRebooking(false);
    }
  }

  // Expired: close the booking (recorded as cancelled, no driver accepted) and go home.
  async function handleCloseExpired() {
    if (!bookingId || !passenger) return;

    setCancelling(true);
    setError('');

    try {
      await cancelBooking(bookingId, passenger.uid, NO_DRIVER_ACCEPTED_REASON);
      setCancelling(false);
      goHome();
    } catch (err) {
      setCancelling(false);
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to cancel booking. Please try again.',
      );
    }
  }

  function goHome() {
    setActiveBookingId(null);
    router.dismissTo('/home');
  }

  if (!bookingId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No active booking.</Text>
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  if (loading && !booking) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading booking status…</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ErrorBanner message={error || 'Booking not found.'} />
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const assignedDriver =
    assignedDriverRecord && assignedDriverRecord.driverId === booking.driverId
      ? assignedDriverRecord
      : null;
  const isExpired = isBookingExpired(booking, now);
  const canCancel = canPassengerCancelBooking(booking);
  const isActive = isActiveBookingStatus(booking.status) && !isExpired;
  const header = getPassengerStatusHeader(booking, now);
  const isOutOfArea = booking.bookingType === 'out_of_area';
  const isCompleted = booking.status === 'completed';
  const showDriverConfirmNotice =
    awaitingDriverConfirm && now - booking.createdAt.getTime() >= DRIVER_CONFIRM_NOTICE_MS;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Your Ride" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <StatusHeader
            title={header.title}
            message={header.message}
            pulsing={booking.status === 'pending' && !isExpired}
            tone={
              booking.status === 'cancelled' || isExpired
                ? 'cancelled'
                : isActive
                  ? 'active'
                  : 'done'
            }
          />
          {showDriverConfirmNotice ? (
            <Text style={styles.notice}>
              Your driver hasn't confirmed yet. You can keep waiting or cancel.
            </Text>
          ) : null}
          <View style={styles.stepper}>
            <StatusStepper steps={getBookingProgress(booking, now)} />
          </View>
        </View>

        {booking.driverId ? (
          <DriverCard driver={assignedDriver} mobileNumber={driverContact?.mobileNumber ?? null} />
        ) : null}

        <View style={styles.mapCard}>
          <RoutePreviewMap
            pickup={booking.pickupLocation}
            destination={booking.destination}
            routeCoordinates={route?.coordinates ?? null}
          />
        </View>

        <View style={styles.card}>
          <RouteTimeline
            pickupAddress={booking.pickupLocation.address}
            destinationAddress={booking.destination.address}
          />
        </View>

        <TripStatsRow
          distanceKm={booking.distanceKm}
          vehicleType={booking.vehicleType}
          durationMin={route?.durationMin ?? null}
          durationLabel="Trip time"
        />

        <FareCard
          estimatedFare={
            isOutOfArea ? booking.estimatedFare : (booking.finalFare ?? booking.estimatedFare)
          }
          agreedFare={isOutOfArea ? (booking.finalFare ?? booking.agreedFare) : null}
          isOutOfArea={isOutOfArea}
          fareBasisLabel={getFareBasisLabel(booking) ?? undefined}
          label={isCompleted ? 'Final fare' : undefined}
          footer={
            isCompleted && booking.paymentMethod ? (
              <Text style={styles.payment}>
                Payment: {formatPaymentMethod(booking.paymentMethod)}
              </Text>
            ) : null
          }
        />
      </ScrollView>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {isExpired ? (
        <StickyActionBar
          buttonTitle="Try again"
          loading={rebooking}
          disabled={cancelling}
          onPress={handleTryAgain}
          secondaryTitle="Cancel"
          onSecondaryPress={handleCloseExpired}
          secondaryLoading={cancelling}
        />
      ) : canCancel ? (
        <StickyActionBar
          buttonTitle="Cancel Booking"
          variant="secondary"
          loading={cancelling}
          onPress={() => setShowCancelDialog(true)}
        />
      ) : !isActive ? (
        <StickyActionBar
          buttonTitle={booking.cancelledBy === 'driver' ? 'Book Again' : 'Back to Home'}
          onPress={goHome}
        />
      ) : null}

      <ConfirmationDialog
        visible={showCancelDialog}
        title="Cancel booking?"
        message="Are you sure you want to cancel this booking?"
        confirmLabel="Yes, Cancel"
        cancelLabel="No"
        destructive
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelDialog(false)}
      />
    </View>
  );
}

interface FetchedRoute {
  key: string;
  /** Null when ORS had no route; the map then draws a direct line. */
  route: RoadRoute | null;
}

function routeKey(pickup: Location, destination: Location): string {
  return `${pickup.latitude},${pickup.longitude}|${destination.latitude},${destination.longitude}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  stepper: {
    marginTop: spacing.lg,
  },
  notice: {
    ...typography.caption,
    color: colors.primaryDark,
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    lineHeight: 18,
    overflow: 'hidden',
  },
  mapCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  payment: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

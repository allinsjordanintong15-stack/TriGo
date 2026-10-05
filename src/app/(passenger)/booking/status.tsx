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
import {
  BookingServiceError,
  cancelBooking,
  subscribeToBooking,
} from '@/services/bookingService';
import { getDriverRecord } from '@/services/driverService';
import { getRoadRoute, RoadRoute } from '@/services/routingService';
import { Booking, DriverRecord, Location } from '@/types';
import { canPassengerCancelBooking } from '@/utils/booking';
import {
  formatPaymentMethod,
  getBookingProgress,
  getPassengerStatusHeader,
  isActiveBookingStatus,
} from '@/utils/bookingStatus';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BookingStatusScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const { activeBookingId, setActiveBookingId, tripQuote, tripRoute } = useBookingDraft();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? activeBookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [assignedDriverRecord, setAssignedDriverRecord] = useState<DriverRecord | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [fetchedRoute, setFetchedRoute] = useState<FetchedRoute | null>(null);

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
  const canCancel = canPassengerCancelBooking(booking);
  const isActive = isActiveBookingStatus(booking.status);
  const header = getPassengerStatusHeader(booking);
  const isOutOfArea = booking.bookingType === 'out_of_area';
  const isCompleted = booking.status === 'completed';
  const route =
    contextRoute ?? (fetchedRoute?.key === bookingRouteKey ? fetchedRoute.route : null);

  function goHome() {
    setActiveBookingId(null);
    router.dismissTo('/home');
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Your Ride" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <StatusHeader
            title={header.title}
            message={header.message}
            pulsing={booking.status === 'pending'}
            tone={booking.status === 'cancelled' ? 'cancelled' : isActive ? 'active' : 'done'}
          />
          <View style={styles.stepper}>
            <StatusStepper steps={getBookingProgress(booking)} />
          </View>
        </View>

        {booking.driverId ? <DriverCard driver={assignedDriver} /> : null}

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

      {canCancel ? (
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

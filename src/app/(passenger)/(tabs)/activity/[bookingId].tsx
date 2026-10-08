import { DriverCard } from '@/components/booking/DriverCard';
import { FareCard } from '@/components/booking/FareCard';
import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { StatusHeader } from '@/components/booking/StatusHeader';
import { TripStatsRow } from '@/components/booking/TripStatsRow';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { BookingServiceError, subscribeToBooking } from '@/services/bookingService';
import { getDriverRecord } from '@/services/driverService';
import { Booking, DriverRecord } from '@/types';
import {
  formatPaymentMethod,
  formatStepTime,
  getPassengerStatusHeader,
  isActiveBookingStatus,
} from '@/utils/bookingStatus';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const LOAD_ERROR_MESSAGE = 'Unable to load this booking. Check your connection and try again.';

type LoadError = 'not_found' | 'failed' | null;

function formatDate(value: Date): string {
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Short, readable stand-in for the Firestore ID, e.g. "Ref: 7KQ2XA". */
function formatBookingReference(bookingId: string): string {
  return `Ref: ${bookingId.slice(-6).toUpperCase()}`;
}

interface TimelineEntry {
  label: string;
  time: Date;
  cancelled?: boolean;
}

/** Steps the booking actually reached, in order, ending in Completed or Cancelled. */
function getTimelineEntries(booking: Booking): TimelineEntry[] {
  const entries: { label: string; time: Date | null; cancelled?: boolean }[] = [
    { label: 'Requested', time: booking.createdAt },
    { label: 'Accepted', time: booking.acceptedAt },
    { label: 'Driver arrived', time: booking.arrivedAt },
    { label: 'Trip started', time: booking.startedAt },
    { label: 'Completed', time: booking.completedAt },
    {
      label:
        booking.cancelledBy === 'driver'
          ? 'Cancelled by driver'
          : booking.cancelledBy === 'passenger'
            ? 'Cancelled by you'
            : 'Cancelled',
      time: booking.cancelledAt,
      cancelled: true,
    },
  ];
  return entries.filter((entry): entry is TimelineEntry => entry.time !== null);
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? '';
  const goBack = useScreenBack();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [assignedDriverRecord, setAssignedDriverRecord] = useState<DriverRecord | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoadError('not_found');
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToBooking(
      bookingId,
      (updated) => {
        setBooking(updated);
        setLoading(false);
        setLoadError(null);
      },
      (err) => {
        // subscribeToBooking only raises BookingServiceError when the document is missing;
        // anything else (permissions, network) can be retried.
        setLoadError(err instanceof BookingServiceError ? 'not_found' : 'failed');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [bookingId, retryCount]);

  // Same driver details as the live status screen (drivers/{uid}).
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
        // Driver details are optional; the card then shows "Driver assigned".
      });

    return () => {
      active = false;
    };
  }, [assignedDriverId]);

  const retry = () => setRetryCount((count) => count + 1);

  if (loading && !booking) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Booking Details" onBack={goBack} />
        <LoadingScreen />
      </View>
    );
  }

  if (loadError === 'not_found' || (!booking && loadError === null)) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Booking Details" onBack={goBack} />
        <EmptyState icon="alert-circle-outline" title="Booking not found" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Booking Details" onBack={goBack} />
        <View style={styles.content}>
          <ErrorBanner message={LOAD_ERROR_MESSAGE} />
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      </View>
    );
  }

  const header = getPassengerStatusHeader(booking);
  const isActive = isActiveBookingStatus(booking.status);
  const isOutOfArea = booking.bookingType === 'out_of_area';
  const isCompleted = booking.status === 'completed';
  const assignedDriver =
    assignedDriverRecord && assignedDriverRecord.driverId === booking.driverId
      ? assignedDriverRecord
      : null;
  const timeline = getTimelineEntries(booking);
  const bookingDate = formatDate(booking.createdAt);

  const loadedBookingId = booking.bookingId;
  function openLiveStatus() {
    router.push({
      pathname: '/(passenger)/booking/status',
      params: { bookingId: loadedBookingId },
    });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Booking Details" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Live updates stopped (e.g. connection lost); what was loaded stays visible. */}
        {loadError === 'failed' ? (
          <View>
            <ErrorBanner message={LOAD_ERROR_MESSAGE} />
            <Button title="Retry" variant="secondary" onPress={retry} />
          </View>
        ) : null}

        <View style={styles.card}>
          <StatusHeader
            title={header.title}
            message={header.message}
            pulsing={booking.status === 'pending'}
            tone={booking.status === 'cancelled' ? 'cancelled' : isActive ? 'active' : 'done'}
          />
          <Text style={styles.reference}>
            {formatBookingReference(booking.bookingId)} · {bookingDate}
          </Text>
          {isActive ? (
            <Button title="View live status" onPress={openLiveStatus} style={styles.liveButton} />
          ) : null}
        </View>

        {booking.driverId ? <DriverCard driver={assignedDriver} /> : null}

        <View style={styles.card}>
          <RouteTimeline
            pickupAddress={booking.pickupLocation.address}
            destinationAddress={booking.destination.address}
          />
        </View>

        <TripStatsRow distanceKm={booking.distanceKm} vehicleType={booking.vehicleType} />

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Timeline</Text>
          {timeline.map((entry, index) => {
            const entryDate = formatDate(entry.time);
            return (
              <View key={entry.label} style={styles.timelineRow}>
                <View style={styles.timelineMarker}>
                  <View
                    style={[
                      styles.timelineDot,
                      entry.cancelled ? styles.timelineDotCancelled : null,
                    ]}
                  />
                  {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <Text
                  style={[styles.timelineLabel, entry.cancelled ? styles.timelineCancelled : null]}
                >
                  {entry.label}
                </Text>
                <Text style={styles.timelineTime}>
                  {/* Only repeat the date when a step falls on a different day. */}
                  {entryDate === bookingDate ? '' : `${entryDate}, `}
                  {formatStepTime(entry.time)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const TIMELINE_DOT = 10;

const styles = StyleSheet.create({
  container: {
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
  reference: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  liveButton: {
    marginTop: spacing.md,
  },
  payment: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  cardTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 32,
  },
  timelineMarker: {
    width: TIMELINE_DOT,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginRight: spacing.sm,
    paddingTop: 5,
  },
  timelineDot: {
    width: TIMELINE_DOT,
    height: TIMELINE_DOT,
    borderRadius: TIMELINE_DOT / 2,
    backgroundColor: colors.primary,
  },
  timelineDotCancelled: {
    backgroundColor: colors.error,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: colors.border,
  },
  timelineLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  timelineCancelled: {
    color: colors.error,
    fontWeight: '600',
  },
  timelineTime: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
});

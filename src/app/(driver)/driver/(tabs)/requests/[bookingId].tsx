import { formatRequestAge } from '@/components/driver/DriverRequestCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToBooking } from '@/services/bookingService';
import {
  acceptBooking,
  declineBooking,
  DriverBookingServiceError,
} from '@/services/driverBookingService';
import { Booking } from '@/types';
import { calculateDistanceKm } from '@/utils/distance';
import { formatPhilippinePeso } from '@/utils/fare';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
}

function DetailRow({ label, value, highlight, last }: DetailRowProps) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight ? styles.rowValueHighlight : null]}>{value}</Text>
    </View>
  );
}

function goBackToRequests() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/requests');
  }
}

export default function DriverRequestDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? '';
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip } = useDriverActivity();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
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
        // Once another driver accepts (or the passenger cancels), the booking is no
        // longer readable by this driver.
        setUnavailable(true);
        setLoading(false);
      },
    );
  }, [bookingId]);

  const driverId = driverRecord?.driverId ?? null;
  const isMine = booking !== null && driverId !== null && booking.driverId === driverId;
  const isOpen =
    booking !== null &&
    booking.status === 'pending' &&
    booking.driverId === null &&
    booking.bookingType === 'standard';
  const canAccept =
    isOpen &&
    canPerformDriverActions &&
    driverRecord?.isOnline === true &&
    driverRecord.isAvailable &&
    !hasActiveTrip;

  async function handleAccept() {
    if (!booking || !driverId || !canAccept) return;

    setAccepting(true);
    setError('');

    try {
      await acceptBooking(booking.bookingId, driverId);
    } catch (err) {
      setError(
        err instanceof DriverBookingServiceError
          ? err.message
          : 'Unable to accept this request. Please try again.',
      );
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!booking || !driverId) return;

    setDeclining(true);
    await declineBooking(driverId, booking.bookingId);
    setDeclining(false);
    goBackToRequests();
  }

  const header = <ScreenHeader title="Ride Request" onBack={goBackToRequests} />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  if (unavailable || !booking || (!isOpen && !isMine)) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="alert-circle-outline"
          title="Request no longer available"
          message="This ride may have been accepted by another driver or cancelled by the passenger."
        />
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button title="Back to Requests" variant="secondary" onPress={goBackToRequests} />
        </View>
      </View>
    );
  }

  const location = driverRecord?.currentLocation ?? null;
  const distanceToPickupKm = location
    ? calculateDistanceKm({ ...location, address: '' }, booking.pickupLocation)
    : null;
  const vehicleLabel =
    booking.vehicleType.charAt(0).toUpperCase() + booking.vehicleType.slice(1);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {isMine ? (
          <View style={styles.acceptedBanner}>
            <StatusBadge status={booking.status} />
            <Text style={styles.acceptedTitle}>
              {booking.status === 'cancelled'
                ? 'The passenger cancelled this ride'
                : 'You accepted this ride'}
            </Text>
            <Text style={styles.acceptedMessage}>
              {booking.status === 'cancelled'
                ? 'You can set yourself as available again from the Home tab.'
                : 'The passenger can now see that you are their assigned driver. Head to the pickup location.'}
            </Text>
          </View>
        ) : (
          <View style={styles.fareHeader}>
            <Text style={styles.fareLabel}>Estimated fare</Text>
            <Text style={styles.fareValue}>{formatPhilippinePeso(booking.estimatedFare)}</Text>
            <Text style={styles.fareNote}>
              Requested {formatRequestAge(booking.createdAt).toLowerCase()}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <DetailRow label="Pickup" value={booking.pickupLocation.address} />
          <DetailRow label="Destination" value={booking.destination.address} />
          <DetailRow label="Vehicle type" value={vehicleLabel} />
          <DetailRow label="Trip distance" value={`${booking.distanceKm.toFixed(2)} km`} />
          {distanceToPickupKm !== null ? (
            <DetailRow
              label="Distance to pickup"
              value={`${distanceToPickupKm.toFixed(1)} km (straight line)`}
            />
          ) : null}
          <DetailRow
            label="Booking type"
            value={booking.bookingType === 'standard' ? 'Standard TriGo booking' : 'Out-of-area trip'}
          />
          <DetailRow
            label="Estimated fare"
            value={formatPhilippinePeso(booking.estimatedFare)}
            highlight
            last
          />
        </View>

        <ErrorBanner message={error} />

        {isOpen ? (
          <>
            {!canAccept ? (
              <Text style={styles.cannotAccept}>
                {hasActiveTrip
                  ? 'You already have an active trip.'
                  : 'You must be verified, online and available to accept requests.'}
              </Text>
            ) : null}
            <Button
              title="Accept Ride"
              loading={accepting}
              disabled={!canAccept || declining}
              onPress={handleAccept}
            />
            <View style={styles.spacer} />
            <Button
              title="Decline"
              variant="secondary"
              loading={declining}
              disabled={accepting}
              onPress={handleDecline}
            />
          </>
        ) : (
          <Button title="Go to Home" onPress={() => router.replace('/driver/home')} />
        )}
      </ScrollView>
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
  fareHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  fareLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fareValue: {
    ...typography.title,
    fontSize: 34,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  fareNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  acceptedBanner: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  acceptedTitle: {
    ...typography.label,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  acceptedMessage: {
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
  rowLast: {
    borderBottomWidth: 0,
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
  cannotAccept: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  spacer: {
    height: spacing.sm,
  },
});

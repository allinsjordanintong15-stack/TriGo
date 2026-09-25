import { DriverRequestCard } from '@/components/driver/DriverRequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { getDeclinedBookingIds, subscribeToOpenBookings } from '@/services/driverBookingService';
import { Booking } from '@/types';
import { calculateDistanceKm } from '@/utils/distance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DriverRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { status, driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip } = useDriverActivity();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [declinedIds, setDeclinedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const driverId = driverRecord?.driverId ?? null;
  const vehicleType = driverRecord?.vehicleType ?? null;
  const isOnline = driverRecord?.isOnline === true;
  const isAvailable = driverRecord?.isAvailable === true;
  const canReceiveRequests = canPerformDriverActions && isOnline && isAvailable && !hasActiveTrip;

  useEffect(() => {
    setBookings(null);
    setError('');

    if (!canReceiveRequests || !vehicleType) return;

    return subscribeToOpenBookings(
      vehicleType,
      (open) => {
        setBookings(open);
        setError('');
      },
      () => {
        setBookings([]);
        setError('Unable to load ride requests. Please check your connection.');
      },
    );
  }, [canReceiveRequests, vehicleType]);

  // Re-read declined requests whenever the list regains focus (e.g. after declining).
  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;
      getDeclinedBookingIds(driverId).then((ids) => {
        if (active) setDeclinedIds(ids);
      });
      return () => {
        active = false;
      };
    }, [driverId]),
  );

  const visibleRequests = useMemo(() => {
    const location = driverRecord?.currentLocation ?? null;

    return (bookings ?? [])
      .filter((booking) => !declinedIds.includes(booking.bookingId))
      .map((booking) => ({
        booking,
        distanceToPickupKm: location
          ? calculateDistanceKm({ ...location, address: '' }, booking.pickupLocation)
          : null,
      }))
      .sort((a, b) => {
        if (a.distanceToPickupKm !== null && b.distanceToPickupKm !== null) {
          return a.distanceToPickupKm - b.distanceToPickupKm;
        }
        return b.booking.createdAt.getTime() - a.booking.createdAt.getTime();
      });
  }, [bookings, declinedIds, driverRecord?.currentLocation]);

  function renderGate(title: string, message: string, icon: 'shield-outline' | 'power-outline' | 'car-outline') {
    return <EmptyState icon={icon} title={title} message={message} />;
  }

  let body;
  if (status !== 'verified') {
    body = renderGate(
      'Verification required',
      'Ride requests appear once a TriGo administrator verifies your account.',
      'shield-outline',
    );
  } else if (hasActiveTrip) {
    body = renderGate(
      'You have an active trip',
      'Finish or resolve your current trip on the Home tab before accepting another request.',
      'car-outline',
    );
  } else if (!isOnline) {
    body = renderGate(
      'You are offline',
      'Go online from the Home tab to start receiving ride requests.',
      'power-outline',
    );
  } else if (!isAvailable) {
    body = renderGate(
      'You are not available',
      'Set yourself as available on the Home tab to receive ride requests.',
      'power-outline',
    );
  } else if (bookings === null) {
    body = <LoadingScreen />;
  } else if (visibleRequests.length === 0) {
    body = (
      <View style={styles.flex}>
        <ErrorBanner message={error} />
        {renderGate(
          'No ride requests right now',
          `New ${vehicleType ?? ''} requests in Trinidad, Bohol will appear here automatically.`,
          'car-outline',
        )}
      </View>
    );
  } else {
    body = (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={error} />
        <Text style={styles.sectionTitle}>
          {visibleRequests.length} open request{visibleRequests.length === 1 ? '' : 's'}
        </Text>
        {visibleRequests.map(({ booking, distanceToPickupKm }) => (
          <DriverRequestCard
            key={booking.bookingId}
            booking={booking}
            distanceToPickupKm={distanceToPickupKm}
            onPress={() =>
              router.push({
                pathname: '/driver/requests/[bookingId]',
                params: { bookingId: booking.bookingId },
              })
            }
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ride Requests" />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});

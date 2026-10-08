import { DriverRequestCard } from '@/components/driver/DriverRequestCard';
import { OutOfAreaRequestCard } from '@/components/driver/OutOfAreaRequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { getDeclinedBookingIds, subscribeToOpenBookings } from '@/services/driverBookingService';
import { OpenOutOfAreaRequest, subscribeToOpenOutOfAreaRequests } from '@/services/driverService';
import { fetchFareConfig } from '@/services/fareService';
import { Booking } from '@/types';
import { calculateDistanceKm } from '@/utils/distance';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DriverRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { status, driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip } = useDriverActivity();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [declinedIds, setDeclinedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [outOfAreaRequests, setOutOfAreaRequests] = useState<OpenOutOfAreaRequest[] | null>(null);
  const [outOfAreaError, setOutOfAreaError] = useState('');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const driverId = driverRecord?.driverId ?? null;
  const vehicleType = driverRecord?.vehicleType ?? null;
  const isOnline = driverRecord?.isOnline === true;
  const isAvailable = driverRecord?.isAvailable === true;
  const canReceiveRequests = canPerformDriverActions && isOnline && isAvailable && !hasActiveTrip;
  const latitude = driverRecord?.currentLocation?.latitude ?? null;
  const longitude = driverRecord?.currentLocation?.longitude ?? null;

  // Admin-managed radius from fareSettings, merged over the in-code defaults.
  useEffect(() => {
    let active = true;
    fetchFareConfig().then((config) => {
      if (active) setSearchRadiusKm(config.outOfArea.driverSearchRadiusKm);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setOutOfAreaRequests(null);
    setOutOfAreaError('');

    if (!canReceiveRequests || !vehicleType || searchRadiusKm === null) return;
    if (latitude === null || longitude === null) {
      setOutOfAreaRequests([]);
      return;
    }

    return subscribeToOpenOutOfAreaRequests(
      vehicleType,
      { latitude, longitude },
      searchRadiusKm,
      (open) => {
        setOutOfAreaRequests(open);
        setOutOfAreaError('');
      },
      () => {
        setOutOfAreaRequests([]);
        setOutOfAreaError('Unable to load out-of-area requests. Please check your connection.');
      },
    );
  }, [canReceiveRequests, vehicleType, latitude, longitude, searchRadiusKm]);

  // Drives the expiry countdowns and hides requests that expire while the list is open.
  const hasOutOfAreaRequests = (outOfAreaRequests?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasOutOfAreaRequests) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasOutOfAreaRequests]);

  const visibleOutOfAreaRequests = useMemo(
    () =>
      (outOfAreaRequests ?? []).filter(
        ({ request }) => request.expiresAt !== null && request.expiresAt.getTime() > now,
      ),
    [outOfAreaRequests, now],
  );

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
  } else if (driverRecord?.currentRequestId) {
    body = renderGate(
      'Fare proposal pending',
      'Waiting for the passenger to respond. Open it from the Home tab to withdraw.',
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
  } else {
    body = (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Out-of-area requests</Text>
        <ErrorBanner message={outOfAreaError} />
        {outOfAreaRequests === null ? (
          <ActivityIndicator style={styles.sectionLoading} color={colors.primary} />
        ) : latitude === null || longitude === null ? (
          <Text style={styles.sectionEmpty}>
            Your location is unknown. Go offline and back online to share it.
          </Text>
        ) : visibleOutOfAreaRequests.length === 0 ? (
          <Text style={styles.sectionEmpty}>
            No out-of-area requests within {searchRadiusKm ?? ''} km right now.
          </Text>
        ) : (
          visibleOutOfAreaRequests.map(({ request, distanceToPickupKm }) => (
            <OutOfAreaRequestCard
              key={request.requestId}
              request={request}
              distanceToPickupKm={distanceToPickupKm}
              now={now}
              onPress={() =>
                router.push({
                  pathname: '/driver/requests/out-of-area/[requestId]',
                  params: { requestId: request.requestId },
                })
              }
            />
          ))
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
          {bookings === null || visibleRequests.length === 0
            ? 'Ride requests'
            : `${visibleRequests.length} open request${visibleRequests.length === 1 ? '' : 's'}`}
        </Text>
        <ErrorBanner message={error} />
        {bookings === null ? (
          <ActivityIndicator style={styles.sectionLoading} color={colors.primary} />
        ) : visibleRequests.length === 0 ? (
          <EmptyState
            icon="car-outline"
            title="No ride requests right now"
            message={`New ${vehicleType ?? ''} requests in Trinidad, Bohol will appear here automatically.`}
          />
        ) : (
          visibleRequests.map(({ booking, distanceToPickupKm }) => (
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
          ))
        )}
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sectionSpacing: {
    marginTop: spacing.md,
  },
  sectionLoading: {
    marginVertical: spacing.lg,
  },
  sectionEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});

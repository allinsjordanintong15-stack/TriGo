import { TripHistoryCard } from '@/components/driver/TripHistoryCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import {
  DriverBookingServiceError,
  fetchDriverTripHistory,
  TripHistoryCursor,
} from '@/services/driverBookingService';
import { Booking } from '@/types';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function errorMessage(err: unknown): string {
  return err instanceof DriverBookingServiceError
    ? err.message
    : 'Unable to load your trips. Please try again.';
}

/** Completed and cancelled trips, newest first. No earnings totals (open decision #5). */
export default function DriverTripsScreen() {
  const insets = useSafeAreaInsets();
  const { driverRecord } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;

  const [trips, setTrips] = useState<Booking[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const cursor = useRef<TripHistoryCursor | null>(null);

  // Reload the first page whenever the tab gains focus, so just-finished trips appear.
  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      fetchDriverTripHistory(driverId)
        .then((page) => {
          if (!active) return;
          cursor.current = page.cursor;
          setTrips(page.trips);
          setHasMore(page.hasMore);
          setError('');
        })
        .catch((err) => {
          if (!active) return;
          setTrips((current) => current ?? []);
          setError(errorMessage(err));
        });

      return () => {
        active = false;
      };
    }, [driverId]),
  );

  async function loadMore() {
    if (!driverId || !cursor.current) return;

    setLoadingMore(true);
    try {
      const page = await fetchDriverTripHistory(driverId, cursor.current);
      cursor.current = page.cursor;
      setTrips((current) => {
        const known = new Set((current ?? []).map((trip) => trip.bookingId));
        return [...(current ?? []), ...page.trips.filter((trip) => !known.has(trip.bookingId))];
      });
      setHasMore(page.hasMore);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  if (trips === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Trips" />
        <LoadingScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Trips" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={error} />

        {trips.length === 0 && !error ? (
          <EmptyState
            icon="car-outline"
            title="No trips yet"
            message="Completed and cancelled trips will appear here."
          />
        ) : null}

        {trips.map((trip) => (
          <TripHistoryCard
            key={trip.bookingId}
            trip={trip}
            onPress={() =>
              router.push({ pathname: '/driver/trip/[bookingId]', params: { bookingId: trip.bookingId } })
            }
          />
        ))}

        {hasMore ? (
          <Button title="Load More" variant="secondary" loading={loadingMore} onPress={loadMore} />
        ) : null}
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
});

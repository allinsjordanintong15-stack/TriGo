import { PassengerBookingHistoryCard } from '@/components/booking/PassengerBookingHistoryCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToPassengerBookings } from '@/services/bookingService';
import { Booking, BookingStatus } from '@/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const LOAD_ERROR_MESSAGE = 'Unable to load your bookings. Check your connection and try again.';

function isPastStatus(status: BookingStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export default function ActivityScreen() {
  const { passenger } = useAuth();
  const passengerId = passenger?.uid ?? null;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // A different account starts from an empty list; a retry keeps what is already shown.
  useEffect(() => {
    setBookings(null);
  }, [passengerId]);

  useEffect(() => {
    if (!passengerId) return;
    setError('');

    const unsubscribe = subscribeToPassengerBookings(
      passengerId,
      (updated) => {
        setBookings(updated);
        setError('');
      },
      () => setError(LOAD_ERROR_MESSAGE),
    );

    return unsubscribe;
  }, [passengerId, retryCount]);

  const active = (bookings ?? []).filter((b) => !isPastStatus(b.status));
  const past = (bookings ?? []).filter((b) => isPastStatus(b.status));

  function openBooking(bookingId: string) {
    router.push({ pathname: '/activity/[bookingId]', params: { bookingId } });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Activity" />
      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
          <Button title="Retry" variant="secondary" onPress={() => setRetryCount((n) => n + 1)} />
        </View>
      ) : null}
      {bookings === null ? (
        error ? null : <LoadingScreen />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No bookings yet"
          message="Your trips and ride history will appear here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {active.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current</Text>
              {active.map((booking) => (
                <PassengerBookingHistoryCard
                  key={booking.bookingId}
                  booking={booking}
                  onPress={() => openBooking(booking.bookingId)}
                />
              ))}
            </View>
          ) : null}

          {past.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>History</Text>
              {past.map((booking) => (
                <PassengerBookingHistoryCard
                  key={booking.bookingId}
                  booking={booking}
                  onPress={() => openBooking(booking.bookingId)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
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
    paddingBottom: spacing.xl,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
});

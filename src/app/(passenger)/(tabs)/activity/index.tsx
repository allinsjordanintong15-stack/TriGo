import { PassengerBookingHistoryCard } from '@/components/booking/PassengerBookingHistoryCard';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function isPastStatus(status: BookingStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!passenger) return;
    setBookings(null);
    setError('');

    const unsubscribe = subscribeToPassengerBookings(
      passenger.uid,
      (updated) => {
        setBookings(updated);
        setError('');
      },
      (err) => setError(err.message ?? 'Unable to load your bookings.'),
    );

    return unsubscribe;
  }, [passenger]);

  const active = (bookings ?? []).filter((b) => !isPastStatus(b.status));
  const past = (bookings ?? []).filter((b) => isPastStatus(b.status));

  function openBooking(bookingId: string) {
    router.push({ pathname: '/activity/[bookingId]', params: { bookingId } });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Activity" />
      {bookings === null ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.content}>
          <ErrorBanner message={error} />
        </View>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No bookings yet"
          message="Your trips and ride history will appear here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
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

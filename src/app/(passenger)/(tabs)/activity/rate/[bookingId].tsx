import { DriverCard } from '@/components/booking/DriverCard';
import { GivenRating, RateDriverForm } from '@/components/booking/RateDriverForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { RATING_WINDOW_DAYS } from '@/constants/rating';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useOwnRating } from '@/hooks/useOwnRating';
import { getBooking } from '@/services/bookingService';
import { getDriverRecord } from '@/services/driverService';
import { Booking, DriverRecord, Rating } from '@/types';
import { isWithinRatingWindow } from '@/utils/rating';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const THANKS_MS = 1500;

type Loaded =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not_found' }
  | { kind: 'ready'; booking: Booking; driver: DriverRecord | null };

/** "Rate driver" from Booking Details, for a completed trip still within the window. */
export default function RateDriverScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const goBack = useScreenBack();
  const { passenger } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const { state: ratingState, reload: reloadRating, setRated } = useOwnRating(bookingId ?? null);
  const [justRated, setJustRated] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) {
      setLoaded({ kind: 'not_found' });
      return;
    }
    setLoaded({ kind: 'loading' });
    try {
      const booking = await getBooking(bookingId);
      if (!booking || !passenger || booking.passengerId !== passenger.uid) {
        setLoaded({ kind: 'not_found' });
        return;
      }
      const driver = booking.driverId
        ? await getDriverRecord(booking.driverId).catch(() => null)
        : null;
      setLoaded({ kind: 'ready', booking, driver });
    } catch {
      setLoaded({ kind: 'error' });
    }
  }, [bookingId, passenger]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    if (!justRated) return;
    const timer = setTimeout(() => goBackRef.current(), THANKS_MS);
    return () => clearTimeout(timer);
  }, [justRated]);

  function handleRated(rating: Rating) {
    setRated(rating);
    setJustRated(true);
  }

  let body;
  if (loaded.kind === 'loading' || ratingState.kind === 'loading') {
    body = <LoadingScreen />;
  } else if (loaded.kind === 'not_found') {
    body = <EmptyState icon="alert-circle-outline" title="Trip not found" />;
  } else if (loaded.kind === 'error' || ratingState.kind === 'error') {
    body = (
      <View style={styles.content}>
        <ErrorBanner
          message={
            ratingState.kind === 'error'
              ? ratingState.message
              : 'Unable to load this trip. Check your connection and try again.'
          }
        />
        <Button
          title="Retry"
          variant="secondary"
          onPress={() => {
            void load();
            void reloadRating();
          }}
        />
      </View>
    );
  } else {
    const { booking, driver } = loaded;
    body = (
      <ScrollView contentContainerStyle={styles.content}>
        {booking.driverId ? <DriverCard driver={driver} /> : null}
        {ratingState.rating ? (
          <>
            {justRated ? (
              <View style={styles.thanks} accessible accessibilityRole="alert">
                <Ionicons name="heart" color={colors.primary} size={22} />
                <Text style={styles.thanksText}>Thanks for your rating!</Text>
              </View>
            ) : null}
            <GivenRating rating={ratingState.rating} />
          </>
        ) : passenger && isWithinRatingWindow(booking, Date.now()) ? (
          <RateDriverForm booking={booking} passengerId={passenger.uid} onRated={handleRated} />
        ) : (
          <Text style={styles.closed}>
            {`Trips can be rated for ${RATING_WINDOW_DAYS} days after they are completed.`}
          </Text>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Rate driver" onBack={goBack} />
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  thanksText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  closed: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

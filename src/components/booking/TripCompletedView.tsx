import { DriverCard } from '@/components/booking/DriverCard';
import { FareCard } from '@/components/booking/FareCard';
import { GivenRating, RateDriverForm } from '@/components/booking/RateDriverForm';
import { StickyActionBar } from '@/components/booking/StickyActionBar';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { RATING_WINDOW_DAYS } from '@/constants/rating';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useOwnRating } from '@/hooks/useOwnRating';
import { Booking, DriverRecord, Rating } from '@/types';
import { formatPaymentMethod } from '@/utils/bookingStatus';
import { formatDateTime } from '@/utils/dateTime';
import { getFareBasisLabel } from '@/utils/fareBasisLabel';
import { isWithinRatingWindow } from '@/utils/rating';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** After "Thanks for your rating", go home on our own after this long. */
const THANKS_MS = 1500;

interface TripCompletedViewProps {
  booking: Booking;
  driver: DriverRecord | null;
  passengerId: string;
  onHome: () => void;
  onReportProblem: () => void;
}

/** Your Ride once the trip is completed: fare, driver, rate the driver, report a problem. */
export function TripCompletedView({
  booking,
  driver,
  passengerId,
  onHome,
  onReportProblem,
}: TripCompletedViewProps) {
  const { state, reload, setRated } = useOwnRating(booking.bookingId);
  const [justRated, setJustRated] = useState(false);
  const isOutOfArea = booking.bookingType === 'out_of_area';
  const canRate = isWithinRatingWindow(booking, Date.now());

  // The parent's onHome may change on every render; the timer must not restart.
  const onHomeRef = useRef(onHome);
  onHomeRef.current = onHome;
  useEffect(() => {
    if (!justRated) return;
    const timer = setTimeout(() => onHomeRef.current(), THANKS_MS);
    return () => clearTimeout(timer);
  }, [justRated]);

  function handleRated(rating: Rating) {
    setRated(rating);
    setJustRated(true);
  }

  let ratingSection;
  if (state.kind === 'loading') {
    ratingSection = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  } else if (state.kind === 'error') {
    ratingSection = (
      <View style={styles.gap}>
        <ErrorBanner message={state.message} />
        <Button title="Retry" variant="secondary" onPress={() => void reload()} />
      </View>
    );
  } else if (state.rating) {
    ratingSection = (
      <View style={styles.gap}>
        {justRated ? (
          <View style={styles.thanks} accessible accessibilityRole="alert">
            <Ionicons name="heart" color={colors.primary} size={22} />
            <Text style={styles.thanksText}>Thanks for your rating!</Text>
          </View>
        ) : null}
        <GivenRating rating={state.rating} />
      </View>
    );
  } else if (canRate) {
    ratingSection = (
      <RateDriverForm
        booking={booking}
        passengerId={passengerId}
        onRated={handleRated}
        onSkip={onHome}
      />
    );
  } else {
    ratingSection = (
      <Text style={styles.closed}>
        {`Trips can be rated for ${RATING_WINDOW_DAYS} days after they are completed.`}
      </Text>
    );
  }

  // The form has its own Submit and Skip; otherwise one button home.
  const showHomeBar = !(state.kind === 'ready' && !state.rating && canRate);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero} accessible accessibilityRole="header">
          <View style={styles.heroIcon}>
            <Ionicons name="checkmark" color={colors.white} size={28} />
          </View>
          <Text style={styles.heroTitle}>Trip completed</Text>
          <Text style={styles.heroMeta}>{formatDateTime(booking.completedAt)}</Text>
        </View>

        <FareCard
          estimatedFare={
            isOutOfArea ? booking.estimatedFare : (booking.finalFare ?? booking.estimatedFare)
          }
          agreedFare={isOutOfArea ? (booking.finalFare ?? booking.agreedFare) : null}
          isOutOfArea={isOutOfArea}
          fareBasisLabel={getFareBasisLabel(booking) ?? undefined}
          label="Final fare"
          footer={
            booking.paymentMethod ? (
              <Text style={styles.payment}>
                Payment: {formatPaymentMethod(booking.paymentMethod)}
              </Text>
            ) : null
          }
        />

        {booking.driverId ? <DriverCard driver={driver} /> : null}

        {ratingSection}

        <Pressable
          accessibilityRole="link"
          onPress={onReportProblem}
          style={styles.reportLink}
          hitSlop={8}
        >
          <Ionicons name="flag-outline" color={colors.primary} size={18} />
          <Text style={styles.reportText}>Report a problem</Text>
        </Pressable>
      </ScrollView>

      {showHomeBar ? <StickyActionBar buttonTitle="Back to Home" onPress={onHome} /> : null}
    </View>
  );
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
  hero: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  heroMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  payment: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  gap: {
    gap: spacing.md,
  },
  loading: {
    marginVertical: spacing.md,
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
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
  reportText: {
    ...typography.label,
    color: colors.primary,
  },
});

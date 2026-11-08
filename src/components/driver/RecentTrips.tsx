import { TripHistoryCard } from '@/components/driver/TripHistoryCard';
import { colors, spacing, typography } from '@/constants/theme';
import { Booking } from '@/types';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface RecentTripsProps {
  /** Null while loading. */
  trips: Booking[] | null;
  error: string;
  onOpenTrip: (bookingId: string) => void;
  onViewAll: () => void;
}

/** The last few completed trips on driver Home, with a link to the Trips tab. */
export function RecentTrips({ trips, error, onOpenTrip, onViewAll }: RecentTripsProps) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Recent rides
        </Text>
        <Pressable accessibilityRole="link" onPress={onViewAll} hitSlop={8} style={styles.linkWrap}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>

      {trips === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : error ? (
        <Text style={styles.message}>{`${error} Pull down to try again.`}</Text>
      ) : trips.length === 0 ? (
        <Text style={styles.message}>No completed trips yet</Text>
      ) : (
        trips.map((trip) => (
          <TripHistoryCard
            key={trip.bookingId}
            trip={trip}
            onPress={() => onOpenTrip(trip.bookingId)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  linkWrap: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
  loading: {
    marginVertical: spacing.md,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

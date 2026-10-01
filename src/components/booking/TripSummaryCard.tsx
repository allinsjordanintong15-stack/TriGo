import { colors, spacing, typography } from '@/constants/theme';
import { TripQuote } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { StyleSheet, Text, View } from 'react-native';

interface TripSummaryCardProps {
  quote: TripQuote;
  showFare?: boolean;
  bookingTypeLabel?: string;
}

export function TripSummaryCard({
  quote,
  showFare = true,
  bookingTypeLabel,
}: TripSummaryCardProps) {
  return (
    <View style={styles.card}>
      {bookingTypeLabel ? (
        <Text style={styles.badge}>{bookingTypeLabel}</Text>
      ) : null}

      <Text style={styles.label}>Pickup</Text>
      <Text style={styles.value}>{quote.pickupLocation.address}</Text>

      <Text style={styles.label}>Destination</Text>
      <Text style={styles.value}>{quote.destination.address}</Text>

      <Text style={styles.label}>Vehicle</Text>
      <Text style={styles.value}>
        {quote.vehicleType.charAt(0).toUpperCase() + quote.vehicleType.slice(1)}
      </Text>

      <Text style={styles.label}>Distance</Text>
      <Text style={styles.value}>{quote.distanceKm.toFixed(2)} km</Text>

      {showFare ? (
        <>
          <Text style={styles.label}>Standard Estimated Fare</Text>
          <Text style={styles.fare}>{formatPhilippinePeso(quote.standardEstimatedFare)}</Text>
          <Text style={styles.fareNote}>
            This is an estimate only and may change for out-of-area trips.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  badge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  fare: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  fareNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { formatPhilippinePeso } from '@/utils/fare';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface FareCardProps {
  /** Standard fare for the trip; the reference fare on out-of-area trips. */
  estimatedFare: number;
  /** Fare agreed with the driver; only out-of-area trips have one. */
  agreedFare: number | null;
  isOutOfArea: boolean;
  /** Optional line under the fare explaining its basis, e.g. "Based on ₱8/km". */
  fareBasisLabel?: string;
}

export function FareCard({
  estimatedFare,
  agreedFare,
  isOutOfArea,
  fareBasisLabel,
}: FareCardProps) {
  if (isOutOfArea) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Agreed fare</Text>
        {agreedFare !== null ? (
          <Text style={styles.total}>{formatPhilippinePeso(agreedFare)}</Text>
        ) : (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading agreed fare…</Text>
          </View>
        )}
        <Text style={styles.note}>Agreed upon by you and the driver.</Text>

        <View style={styles.divider} />

        <View style={styles.referenceRow}>
          <Text style={styles.referenceLabel}>Reference fare (not binding)</Text>
          <Text style={styles.referenceValue}>{formatPhilippinePeso(estimatedFare)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Fare</Text>
      <Text style={styles.total}>{formatPhilippinePeso(estimatedFare)}</Text>
      {fareBasisLabel ? <Text style={styles.note}>{fareBasisLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  total: {
    ...typography.title,
    fontSize: 32,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  referenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  referenceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  referenceValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

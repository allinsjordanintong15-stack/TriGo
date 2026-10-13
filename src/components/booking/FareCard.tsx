import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { formatPhilippinePeso } from '@/utils/fare';
import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface FareCardProps {
  /** Fare for a standard trip. */
  estimatedFare: number;
  /**
   * Fare stored on an out-of-area booking or request (the admin per-km fare, final).
   * Null while it loads.
   */
  agreedFare: number | null;
  isOutOfArea: boolean;
  /** Optional line under the fare explaining its basis, e.g. "Based on ₱8/km". */
  fareBasisLabel?: string;
  /** Replaces the "Fare" title, e.g. "Final fare". */
  label?: string;
  /** Extra content at the bottom of the card, e.g. the payment method. */
  footer?: ReactNode;
}

export function FareCard({
  estimatedFare,
  agreedFare,
  isOutOfArea,
  fareBasisLabel,
  label,
  footer,
}: FareCardProps) {
  if (isOutOfArea) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{label ?? 'Fare'}</Text>
        {agreedFare !== null ? (
          <Text style={styles.total}>{formatPhilippinePeso(agreedFare)}</Text>
        ) : (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading fare…</Text>
          </View>
        )}
        {fareBasisLabel ? <Text style={styles.note}>{fareBasisLabel}</Text> : null}
        {footer}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label ?? 'Fare'}</Text>
      <Text style={styles.total}>{formatPhilippinePeso(estimatedFare)}</Text>
      {fareBasisLabel ? <Text style={styles.note}>{fareBasisLabel}</Text> : null}
      {footer}
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
});

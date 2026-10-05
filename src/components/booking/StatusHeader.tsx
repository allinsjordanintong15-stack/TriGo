import { PulseDot } from '@/components/booking/PulseDot';
import { colors, spacing, typography } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

interface StatusHeaderProps {
  title: string;
  message: string;
  /** Pulse the status dot, e.g. while waiting for a driver. */
  pulsing?: boolean;
  tone?: 'active' | 'done' | 'cancelled';
}

const TONE_COLORS = {
  active: colors.primary,
  done: colors.primaryDark,
  cancelled: colors.error,
} as const;

export function StatusHeader({ title, message, pulsing = false, tone = 'active' }: StatusHeaderProps) {
  return (
    <View style={styles.row}>
      <PulseDot color={TONE_COLORS[tone]} animated={pulsing} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, tone === 'cancelled' ? styles.titleCancelled : null]}>
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    color: colors.text,
  },
  titleCancelled: {
    color: colors.error,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 22,
  },
});

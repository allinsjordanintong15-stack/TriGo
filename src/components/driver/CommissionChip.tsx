import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { CommissionAccountState } from '@/hooks/useCommissionAccount';
import { centavosToPesos, CommissionStatus, commissionStatus } from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const TONES: Record<CommissionStatus, { background: string; border: string; text: string }> = {
  paid_up: { background: colors.white, border: colors.border, text: colors.primaryDark },
  due: { background: colors.goldLight, border: colors.gold, text: colors.primaryDark },
  overdue: { background: colors.errorBackground, border: colors.error, text: colors.error },
  suspended: { background: colors.errorBackground, border: colors.error, text: colors.error },
};

interface CommissionChipProps {
  state: CommissionAccountState;
  /** Clock for the status (useNow). */
  now: number;
  /** Called with true when something is owed (open Earnings at the payment form). */
  onPress: (owes: boolean) => void;
}

/**
 * Driver Home header: the commission balance as a small tappable chip. A placeholder while
 * loading; hidden on an error or when TriGo charges no commission (Home still works).
 */
export function CommissionChip({ state, now, onPress }: CommissionChipProps) {
  if (state.error) return null;
  if (state.loading) {
    return <View style={styles.placeholder} accessibilityElementsHidden importantForAccessibility="no" />;
  }
  // No commission set and none ever recorded: nothing to show.
  if (!state.account && !state.settings) return null;

  const summary = state.account ? commissionStatus(state.account, now) : null;
  const status: CommissionStatus = summary?.status ?? 'paid_up';
  const balanceCentavos = summary?.balanceCentavos ?? 0;
  const amount = formatPhilippinePeso(centavosToPesos(balanceCentavos));
  const tone = TONES[status];
  const owes = balanceCentavos > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Commission balance ${amount}. Tap to view${owes ? ' and pay' : ''}.`}
      onPress={() => onPress(owes)}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: tone.background, borderColor: tone.border },
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons name="wallet-outline" color={tone.text} size={16} />
      <Text
        style={[styles.amount, { color: tone.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {amount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  amount: {
    ...typography.label,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  placeholder: {
    width: 88,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});

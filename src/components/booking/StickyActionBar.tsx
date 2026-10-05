import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { formatPhilippinePeso } from '@/utils/fare';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StickyActionBarProps {
  totalLabel: string;
  /** Amount to show; null while it is still loading. */
  total: number | null;
  buttonTitle: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Extra space below the bar, e.g. a tab bar's height when used on a tab screen. */
  bottomOffset?: number;
}

/** Bar pinned below scrolling content: total on the left, primary action on the right. */
export function StickyActionBar({
  totalLabel,
  total,
  buttonTitle,
  onPress,
  loading = false,
  disabled = false,
  bottomOffset = 0,
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + bottomOffset + spacing.md }]}>
      <View style={styles.totalColumn}>
        <Text style={styles.totalLabel}>{totalLabel}</Text>
        <Text style={styles.totalValue} numberOfLines={1}>
          {total !== null ? formatPhilippinePeso(total) : '—'}
        </Text>
      </View>
      <Button
        title={buttonTitle}
        loading={loading}
        disabled={disabled}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalColumn: {
    flexShrink: 1,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  button: {
    flex: 1,
  },
});

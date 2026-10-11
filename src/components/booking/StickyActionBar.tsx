import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StickyActionBarProps {
  buttonTitle: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  /** Optional second action shown beside the main one, e.g. Decline next to Accept. */
  secondaryTitle?: string;
  onSecondaryPress?: () => void;
  secondaryLoading?: boolean;
  /** Extra space below the bar, e.g. a tab bar's height when used on a tab screen. */
  bottomOffset?: number;
}

/** Bar pinned below scrolling content with a full-width action (or a secondary + main pair). */
export function StickyActionBar({
  buttonTitle,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  secondaryTitle,
  onSecondaryPress,
  secondaryLoading = false,
  bottomOffset = 0,
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();
  const hasSecondary = secondaryTitle !== undefined && onSecondaryPress !== undefined;

  return (
    <View
      style={[
        styles.bar,
        hasSecondary ? styles.row : null,
        { paddingBottom: insets.bottom + bottomOffset + spacing.md },
      ]}
    >
      {hasSecondary ? (
        <Button
          title={secondaryTitle}
          variant="secondary"
          loading={secondaryLoading}
          disabled={loading}
          onPress={onSecondaryPress}
          style={styles.pairButton}
        />
      ) : null}
      <Button
        title={buttonTitle}
        variant={variant}
        loading={loading}
        disabled={disabled || secondaryLoading}
        onPress={onPress}
        style={hasSecondary ? styles.pairButton : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pairButton: {
    flex: 1,
  },
});

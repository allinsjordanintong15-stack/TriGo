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
  /** Extra space below the bar, e.g. a tab bar's height when used on a tab screen. */
  bottomOffset?: number;
}

/** Bar pinned below scrolling content with one full-width primary action. */
export function StickyActionBar({
  buttonTitle,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  bottomOffset = 0,
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + bottomOffset + spacing.md }]}>
      <Button
        title={buttonTitle}
        variant={variant}
        loading={loading}
        disabled={disabled}
        onPress={onPress}
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
});

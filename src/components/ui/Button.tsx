import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  /** 'accent': TriGo gold with dark green text, for something waiting (e.g. new requests). */
  variant?: 'primary' | 'secondary' | 'accent';
  /** 'large': a taller button with bigger text, for use while riding (e.g. the Trip screen). */
  size?: 'default' | 'large';
  /** Optional short count shown in a pill after the title, e.g. "3" or "9+". */
  badge?: string;
  style?: ViewStyle;
}

const VARIANT_STYLES = {
  primary: { button: { backgroundColor: colors.primary }, text: colors.white, spinner: colors.white },
  secondary: {
    button: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
    text: colors.primary,
    spinner: colors.primary,
  },
  accent: { button: { backgroundColor: colors.accent }, text: colors.primaryDark, spinner: colors.primaryDark },
} as const;

export function Button({
  title,
  loading = false,
  variant = 'primary',
  size = 'default',
  badge,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const look = VARIANT_STYLES[variant];

  return (
    <Pressable
      style={({ pressed }) => {
        const baseStyles: ViewStyle[] = [styles.base, look.button];
        if (size === 'large') baseStyles.push(styles.large);
        if (isDisabled) baseStyles.push(styles.disabled);
        if (pressed && !isDisabled) baseStyles.push(styles.pressed);
        if (style) baseStyles.push(style);
        return baseStyles;
      }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={look.spinner} />
      ) : (
        <View style={styles.content}>
          <Text
            style={[styles.text, size === 'large' ? styles.textLarge : null, { color: look.text }]}
          >
            {title}
          </Text>
          {badge ? (
            <View
              style={[
                styles.badge,
                variant === 'primary' ? styles.badgeOnPrimary : styles.badgeOnLight,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  variant === 'primary' ? styles.badgeTextOnPrimary : styles.badgeTextOnLight,
                ]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  large: {
    minHeight: 64,
    paddingVertical: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  text: {
    ...typography.body,
    fontWeight: '600',
    // Long titles still wrap inside the row.
    flexShrink: 1,
  },
  textLarge: {
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOnPrimary: {
    backgroundColor: colors.accent,
  },
  badgeOnLight: {
    backgroundColor: colors.primaryDark,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  badgeTextOnPrimary: {
    color: colors.primaryDark,
  },
  badgeTextOnLight: {
    color: colors.white,
  },
});

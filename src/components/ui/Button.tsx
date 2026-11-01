import { colors, radius, typography } from '@/constants/theme';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  /** 'large': a taller button with bigger text, for use while riding (e.g. the Trip screen). */
  size?: 'default' | 'large';
  style?: ViewStyle;
}

export function Button({
  title,
  loading = false,
  variant = 'primary',
  size = 'default',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => {
        const baseStyles: ViewStyle[] = [
          styles.base,
          isPrimary ? styles.primary : styles.secondary,
        ];
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
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'large' ? styles.textLarge : null,
            isPrimary ? styles.textPrimary : styles.textSecondary,
          ]}
        >
          {title}
        </Text>
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
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    ...typography.body,
    fontWeight: '600',
  },
  textLarge: {
    fontSize: 20,
    fontWeight: '700',
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.primary,
  },
});

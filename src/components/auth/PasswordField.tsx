import { Ionicons } from '@expo/vector-icons';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, spacing } from '@/constants/theme';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

interface PasswordFieldProps
  extends Omit<ComponentProps<typeof TextInputField>, 'secureTextEntry' | 'rightAccessory'> {
  visible: boolean;
  onToggleVisible: () => void;
  /** Hides the eye button, e.g. on a confirm field that follows the main field's toggle. */
  showToggle?: boolean;
}

/** Password input with an eye button inside the field to show or hide the text. */
export function PasswordField({
  visible,
  onToggleVisible,
  showToggle = true,
  ...props
}: PasswordFieldProps) {
  return (
    <TextInputField
      {...props}
      secureTextEntry={!visible}
      rightAccessory={
        showToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.toggle}
            onPress={onToggleVisible}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    padding: spacing.xs,
  },
});

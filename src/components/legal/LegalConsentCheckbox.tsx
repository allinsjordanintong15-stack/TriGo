import { Checkbox, CHECKBOX_INDENT } from '@/components/ui/Checkbox';
import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface LegalConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Registration: the required "I have read and agree" checkbox (unticked by default), with
 * both documents opening in the in-app reader. The form stays filled in underneath.
 */
export function LegalConsentCheckbox({ checked, onChange, error, disabled }: LegalConsentCheckboxProps) {
  return (
    <View style={styles.container}>
      <Checkbox
        label="I have read and agree to the Privacy Notice and Terms"
        checked={checked}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
      <View style={styles.links}>
        <ReadLink label="Read the Privacy Notice" onPress={() => router.push('/legal/privacy-notice')} />
        <ReadLink label="Read the Terms of Use" onPress={() => router.push('/legal/terms')} />
      </View>
    </View>
  );
}

/** An underlined link to a legal document (also used under the driver application notice). */
export function ReadLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" style={styles.link} hitSlop={4} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    paddingLeft: CHECKBOX_INDENT,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    ...typography.label,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

import { colors, radius, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
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
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel="I have read and agree to the Privacy Notice and Terms"
        accessibilityHint={error}
        disabled={disabled}
        style={styles.row}
        hitSlop={4}
        onPress={() => onChange(!checked)}
      >
        <View style={[styles.box, checked ? styles.boxChecked : null, error ? styles.boxError : null]}>
          {checked ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
        </View>
        <Text style={styles.label}>I have read and agree to the Privacy Notice and Terms</Text>
      </Pressable>

      <View style={styles.links}>
        <ReadLink label="Read the Privacy Notice" onPress={() => router.push('/legal/privacy-notice')} />
        <ReadLink label="Read the Terms of Use" onPress={() => router.push('/legal/terms')} />
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ReadLink({ label, onPress }: { label: string; onPress: () => void }) {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.md,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.error,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    paddingLeft: 26 + spacing.md,
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
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

import { ReadLink } from '@/components/legal/LegalConsentCheckbox';
import { Checkbox } from '@/components/ui/Checkbox';
import { DRIVER_APPLICATION_NOTICE } from '@/constants/legal';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

interface DriverApplicationPrivacyNoticeProps {
  acknowledged: boolean;
  onChange: (acknowledged: boolean) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Above Submit on the driver application: what is collected, who reviews it and what
 * passengers see, with the required "I've read this" checkbox. Submitting stores the
 * acknowledged version (LEGAL_VERSION) and time on the application.
 */
export function DriverApplicationPrivacyNotice({
  acknowledged,
  onChange,
  error,
  disabled,
}: DriverApplicationPrivacyNoticeProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {DRIVER_APPLICATION_NOTICE.title}
      </Text>
      {DRIVER_APPLICATION_NOTICE.points.map((point) => (
        <View key={point.heading} style={styles.point}>
          <Text style={styles.heading}>{point.heading}</Text>
          <Text style={styles.text}>{point.text}</Text>
        </View>
      ))}
      <ReadLink label="Read the full Privacy Notice" onPress={() => router.push('/legal/privacy-notice')} />
      <Checkbox
        label={DRIVER_APPLICATION_NOTICE.acknowledgement}
        checked={acknowledged}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  point: {
    marginBottom: spacing.sm,
  },
  heading: {
    ...typography.label,
    color: colors.text,
  },
  text: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

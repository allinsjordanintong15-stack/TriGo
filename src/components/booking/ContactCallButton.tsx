import { colors, radius, spacing, typography } from '@/constants/theme';
import { toTelUri } from '@/utils/phone';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

interface ContactCallButtonProps {
  mobileNumber: string;
  /** Who is being called, for the button's accessibility label, e.g. "your driver". */
  calleeLabel: string;
  /** Privacy line under the button. */
  note: string;
}

/** Call button for the other party of an active trip; renders nothing for an unusable number. */
export function ContactCallButton({ mobileNumber, calleeLabel, note }: ContactCallButtonProps) {
  const telUri = toTelUri(mobileNumber);
  if (!telUri) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${calleeLabel}`}
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        onPress={() => {
          Linking.openURL(telUri).catch(() => {
            // No dialer available (e.g. a tablet); nothing else to do.
          });
        }}
      >
        <Ionicons name="call" color={colors.white} size={18} />
        <Text style={styles.buttonText}>Call</Text>
      </Pressable>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.label,
    color: colors.white,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

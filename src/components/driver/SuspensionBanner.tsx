import { colors, radius, spacing, typography } from '@/constants/theme';
import { AdminSuspension, suspensionTitle } from '@/utils/adminSuspension';
import { formatDateTime } from '@/utils/dateTime';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Driver Home, while TriGo has suspended the account (the caller checks isSuspensionActive):
 * until when, the admin's reason, and what the driver can still do.
 */
export function SuspensionBanner({ suspension }: { suspension: AdminSuspension }) {
  const title = suspensionTitle(suspension, formatDateTime);
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="ban" size={24} color={colors.error} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {suspension.reason ? <Text style={styles.reason}>{suspension.reason}</Text> : null}
        <Text style={styles.text}>
          You can stay online and finish a current trip, but you cannot accept new requests until the
          suspension ends.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.error,
  },
  reason: {
    ...typography.body,
    color: colors.text,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

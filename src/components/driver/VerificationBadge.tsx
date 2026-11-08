import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { DriverAccessStatus } from '@/hooks/useDriverAccess';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'success' | 'pending' | 'problem';

const BADGES: Record<DriverAccessStatus, { label: string; icon: IconName; tone: Tone }> = {
  verified: { label: 'Verified', icon: 'checkmark-circle', tone: 'success' },
  pending_verification: { label: 'Pending verification', icon: 'time', tone: 'pending' },
  revoked: { label: 'Access revoked', icon: 'ban', tone: 'problem' },
  role_not_authorized: { label: 'Not set up', icon: 'alert-circle', tone: 'problem' },
  invalid_vehicle_type: { label: 'Not set up', icon: 'alert-circle', tone: 'problem' },
  no_record: { label: 'Not set up', icon: 'alert-circle', tone: 'problem' },
};

const TONE_STYLES: Record<Tone, { background: string; color: string }> = {
  success: { background: colors.primaryLight, color: colors.primary },
  pending: { background: colors.goldLight, color: colors.primaryDark },
  problem: { background: colors.errorBackground, color: colors.error },
};

/** The driver's account status (useDriverAccess().status) as a small pill. */
export function VerificationBadge({ status }: { status: DriverAccessStatus }) {
  const badge = BADGES[status];
  const tone = TONE_STYLES[badge.tone];

  return (
    <View
      accessible
      accessibilityLabel={`Account status: ${badge.label}`}
      style={[styles.badge, { backgroundColor: tone.background }]}
    >
      <Ionicons name={badge.icon} color={tone.color} size={14} />
      <Text style={[styles.label, { color: tone.color }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});

import { BookingStatus } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';
import { EXPIRED_STATUS_DISPLAY, getBookingStatusDisplay } from '@/utils/bookingStatus';
import { StyleSheet, Text } from 'react-native';

function statusColors(status: BookingStatus): { bg: string; text: string } {
  switch (status) {
    case 'cancelled':
      return { bg: colors.errorBackground, text: colors.error };
    case 'completed':
      return { bg: colors.primaryLight, text: colors.primary };
    case 'arrived':
      return { bg: colors.accent, text: colors.primaryDark };
    default:
      return { bg: colors.primaryLight, text: colors.primary };
  }
}

interface StatusBadgeProps {
  status: BookingStatus;
  /** A pending standard booking past its expiry (isBookingExpired): shown as "Expired". */
  expired?: boolean;
}

export function StatusBadge({ status, expired = false }: StatusBadgeProps) {
  const { bg, text } = expired
    ? { bg: colors.border, text: colors.text }
    : statusColors(status);
  const display = expired ? EXPIRED_STATUS_DISPLAY : getBookingStatusDisplay(status);

  return (
    <Text
      style={[
        styles.badge,
        { backgroundColor: bg, color: text },
      ]}
      numberOfLines={1}
    >
      {display.title}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...typography.caption,
    fontWeight: '700',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
  },
});

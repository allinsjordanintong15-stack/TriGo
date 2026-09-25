import { BookingStatus } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';
import { getBookingStatusDisplay } from '@/utils/bookingStatus';
import { StyleSheet, Text } from 'react-native';

function statusColors(status: BookingStatus): { bg: string; text: string } {
  switch (status) {
    case 'cancelled':
      return { bg: colors.errorBackground, text: colors.error };
    case 'completed':
      return { bg: colors.primaryLight, text: colors.primary };
    case 'fare_negotiation':
    case 'awaiting_passenger_confirmation':
    case 'out_of_area_searching':
    case 'driver_interested':
      return { bg: colors.accent, text: colors.primaryDark };
    default:
      return { bg: colors.primaryLight, text: colors.primary };
  }
}

interface StatusBadgeProps {
  status: BookingStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { bg, text } = statusColors(status);
  const display = getBookingStatusDisplay(status);

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

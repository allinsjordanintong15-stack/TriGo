import { Avatar } from '@/components/ui/Avatar';
import { APP_OPEN_TAGLINE } from '@/constants/taglines';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useInbox } from '@/hooks/useInbox';
import { badgeLabel } from '@/utils/inbox';
import { getFirstName, getManilaGreeting } from '@/utils/greeting';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface HomeHeaderProps {
  /**
   * Booking state: one short line ("Hello, <first name>") and the bell, without the
   * avatar or tagline. Off for the welcome state.
   */
  compact?: boolean;
}

export function HomeHeader({ compact = false }: HomeHeaderProps) {
  const { passenger } = useAuth();
  const fullName = passenger?.fullName ?? 'Passenger';
  const firstName = getFirstName(passenger?.fullName, 'Passenger');
  // Unacknowledged warnings (and later announcements) waiting in the inbox.
  const { unread } = useInbox();
  const badge = badgeLabel(unread);

  const bell = (
    <Pressable
      style={({ pressed }) => [
        styles.notificationButton,
        compact ? styles.notificationButtonCompact : null,
        pressed ? styles.notificationButtonPressed : null,
      ]}
      onPress={() => router.navigate('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={compact ? 6 : 4}
    >
      <Ionicons name="notifications-outline" size={compact ? 20 : 22} color={colors.primary} />
      {badge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  if (compact) {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <Text style={styles.compactGreeting} numberOfLines={1}>
          Hello, {firstName}
        </Text>
        {bell}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <Avatar name={fullName} imageUri={passenger?.profileImage ?? null} size={48} />
        {/* Takes the remaining width so long names end in an ellipsis before the bell. */}
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {getManilaGreeting(Date.now())}, {firstName}
          </Text>
          <Text style={styles.tagline} numberOfLines={2}>
            {APP_OPEN_TAGLINE}
          </Text>
        </View>
      </View>
      {bell}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  containerCompact: {
    marginBottom: spacing.sm,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  tagline: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.accent,
    marginTop: 2,
  },
  compactGreeting: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Smaller circle; hitSlop keeps the touch target near 44 dp.
  notificationButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  notificationButtonPressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
});

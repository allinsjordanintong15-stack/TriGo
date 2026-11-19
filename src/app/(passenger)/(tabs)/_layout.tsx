import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { useInboxNotifications } from '@/hooks/useInboxNotifications';
import { badgeLabel } from '@/utils/inbox';
import { Tabs } from 'expo-router';

export default function PassengerTabsLayout() {
  // Phone notifications for new inbox messages, and taps on them.
  useInboxNotifications();
  const { unread } = useInbox();
  const inboxBadge = badgeLabel(unread);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" color={color} size={size} />
          ),
          // Hidden when nothing is unread (undefined removes the badge).
          tabBarBadge: inboxBadge ?? undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, color: colors.white, fontWeight: '700' },
          tabBarAccessibilityLabel: inboxBadge ? `Notifications, ${unread} unread` : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { formatRequestCount } from '@/utils/openRequests';
import { useNewRequestAlert } from '@/hooks/useNewRequestAlert';
import { useNotificationTapRouting } from '@/hooks/useNotificationTapRouting';
import { Tabs } from 'expo-router';

export default function DriverTabsLayout() {
  // Alerts for new requests on every driver tab, not only on Requests.
  useNewRequestAlert();
  // Here, not in the root layout: the driver account has loaded (also on a cold start).
  useNotificationTapRouting();
  // Waiting passenger requests (the shared listener in DriverActivityContext).
  const { openRequests } = useDriverActivity();
  const requestBadge = formatRequestCount(openRequests.count);

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
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
          // Hidden when 0 (undefined removes the badge).
          tabBarBadge: requestBadge || undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.primaryDark,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: requestBadge
            ? `Requests, ${openRequests.count} waiting`
            : undefined,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" color={color} size={size} />
          ),
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

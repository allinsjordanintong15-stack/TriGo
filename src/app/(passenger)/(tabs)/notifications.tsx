import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  markNotificationRead,
  subscribeToNotifications,
} from '@/services/notificationService';
import { AppNotification } from '@/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatTime(value: Date): string {
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!passenger) return;
    setItems(null);
    setError('');

    const unsubscribe = subscribeToNotifications(
      passenger.uid,
      (updated) => {
        setItems(updated);
        setError('');
      },
      (err) => setError(err.message ?? 'Unable to load notifications.'),
    );

    return unsubscribe;
  }, [passenger]);

  function handlePress(item: AppNotification) {
    if (!item.read) {
      markNotificationRead(item.notificationId).catch(() => undefined);
    }
    if (item.bookingId) {
      router.push({ pathname: '/activity/[bookingId]', params: { bookingId: item.bookingId } });
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" />
      {items === null ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.content}>
          <ErrorBanner message={error} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications"
          message="We'll let you know about your trips and drivers here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <Pressable
              key={item.notificationId}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => handlePress(item)}
            >
              <View style={[styles.dot, item.read ? styles.dotRead : styles.dotUnread]} />
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, item.read ? styles.itemRead : null]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.itemBody2} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemPressed: {
    opacity: 0.92,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: spacing.md,
  },
  dotUnread: {
    backgroundColor: colors.primary,
  },
  dotRead: {
    backgroundColor: colors.border,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  itemRead: {
    fontWeight: '500',
    color: colors.textSecondary,
  },
  itemBody2: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useNow } from '@/hooks/useNow';
import { openAppSettings } from '@/services/locationService';
import { formatTimeAgo } from '@/utils/dateTime';
import { groupInbox, InboxItem, inboxItemLook, InboxTone } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface InboxScreenProps {
  /**
   * Shown as a stacked screen (driver Profile → Messages from TriGo): back arrow and title.
   * Without it, the passenger Notifications tab: the brand header.
   */
  onBack?: () => void;
}

/** Opens an item's own screen; each kind has its route under /inbox. */
export function openInboxItem(item: InboxItem) {
  if (item.kind === 'warning') {
    router.push({ pathname: '/inbox/warning/[warningId]', params: { warningId: item.warning.warningId } });
  } else if (item.kind === 'announcement') {
    router.push({
      pathname: '/inbox/announcement/[announcementId]',
      params: { announcementId: item.announcement.announcementId },
    });
  } else {
    router.push({ pathname: '/inbox/message/[messageId]', params: { messageId: item.message.messageId } });
  }
}

/** Icon colour and its circle's background per tone. */
export const TONE_COLORS: Record<InboxTone, { color: string; background: string }> = {
  success: { color: colors.primary, background: colors.primaryLight },
  danger: { color: colors.error, background: colors.errorBackground },
  warning: { color: '#8A6A2F', background: colors.goldLight },
  info: { color: '#1E5A8A', background: '#E6F0F8' },
  announcement: { color: colors.primaryDark, background: colors.goldLight },
};

/** Ionicons name for an item (utils/inbox.ts picks it). */
export function inboxItemIcon(item: InboxItem): IconName {
  return inboxItemLook(item).icon as IconName;
}

/**
 * "Messages from TriGo" for passengers and drivers: the user's inbox items, newest first,
 * grouped Today / Earlier, unread marked with a dot. "Mark all as read" marks messages and
 * announcements read (warnings need their own "I understand").
 */
export function InboxScreen({ onBack }: InboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { items, error, retry, unread, markAllRead } = useInbox();
  const now = useNow(60_000);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const hasMarkable = items?.some((i) => i.unread && i.kind !== 'warning') ?? false;

  async function handleMarkAll() {
    setMarking(true);
    setMarkError(null);
    try {
      await markAllRead();
    } catch {
      setMarkError('Could not mark them as read. Check your connection and try again.');
    } finally {
      setMarking(false);
    }
  }

  return (
    <View style={styles.container}>
      {onBack ? <ScreenHeader title="Messages from TriGo" onBack={onBack} /> : <ScreenHeader brand />}
      {error ? (
        <View style={styles.content}>
          <ErrorBanner message={error} />
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : items === null ? (
        <LoadingScreen />
      ) : items.length === 0 ? (
        <View style={styles.flex}>
          <View style={styles.content}>
            <NotificationsCard />
          </View>
          <EmptyState
            icon="mail-outline"
            title="No messages yet"
            message="Updates from TriGo will appear here."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toolbar}>
            <Text style={styles.count} accessibilityLiveRegion="polite">
              {unread > 0 ? `${unread} unread` : 'All read'}
            </Text>
            {hasMarkable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: marking }}
                disabled={marking}
                onPress={() => void handleMarkAll()}
                hitSlop={8}
                style={({ pressed }) => [styles.markAll, pressed ? styles.pressed : null]}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
                <Text style={styles.markAllText}>{marking ? 'Marking…' : 'Mark all as read'}</Text>
              </Pressable>
            ) : null}
          </View>
          {markError ? <ErrorBanner message={markError} /> : null}
          <NotificationsCard />
          {groupInbox(items, now).map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              {section.items.map((item) => (
                <InboxRow key={item.key} item={item} now={now} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Offers phone notifications for new messages while they are off (Android 13+ asks; on
 * older Android they are on unless turned off in Settings). Hidden once allowed.
 */
function NotificationsCard() {
  const { state, request } = useNotificationPermission();
  if (!state || state.status === 'granted') return null;
  const canAsk = state.canAskAgain;
  return (
    <View style={styles.permissionCard}>
      <Ionicons name="notifications-outline" size={22} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.permissionTitle}>Get a phone notification for new messages</Text>
        <Text style={styles.permissionText}>
          While TriGo is open or in the background. Turn notifications on to use this.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => (canAsk ? void request() : void openAppSettings())}
          hitSlop={8}
          style={({ pressed }) => [styles.permissionButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.permissionButtonText}>{canAsk ? 'Turn on notifications' : 'Open phone settings'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InboxRow({ item, now }: { item: InboxItem; now: number }) {
  const when = item.createdAt ? formatTimeAgo(item.createdAt, now) : 'Just now';
  const look = inboxItemLook(item);
  const tone = TONE_COLORS[look.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? 'Unread. ' : ''}${item.title}. ${item.preview}. ${when}`}
      style={({ pressed }) => [styles.item, item.unread ? styles.itemUnread : null, pressed ? styles.pressed : null]}
      onPress={() => openInboxItem(item)}
    >
      <View style={[styles.icon, { backgroundColor: tone.background }]}>
        <Ionicons name={look.icon as IconName} size={22} color={tone.color} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, item.unread ? styles.titleUnread : null]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.date}>{when}</Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview}
          </Text>
          {item.unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  markAllText: {
    ...typography.label,
    color: colors.primary,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemUnread: {
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  permissionCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: 0,
  },
  permissionTitle: {
    ...typography.label,
    color: colors.text,
  },
  permissionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  permissionButtonText: {
    ...typography.label,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

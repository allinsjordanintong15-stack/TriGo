import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { formatDateTime } from '@/utils/dateTime';
import { InboxItem } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InboxScreenProps {
  /**
   * Shown as a stacked screen (driver Profile → Messages from TriGo): back arrow and title.
   * Without it, the passenger Notifications tab: the brand header.
   */
  onBack?: () => void;
}

/** Opens an item's own screen; each kind has its route under /inbox (B2: announcements). */
export function openInboxItem(item: InboxItem) {
  router.push({ pathname: '/inbox/warning/[warningId]', params: { warningId: item.warning.warningId } });
}

/**
 * "Messages from TriGo" for passengers and drivers: the user's inbox items, newest first,
 * unread highlighted.
 */
export function InboxScreen({ onBack }: InboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { items, error, retry } = useInbox();

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
        <EmptyState
          icon="mail-outline"
          title="No messages yet"
          message="Messages from the TriGo team will appear here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <InboxRow key={item.key} item={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const date = item.createdAt ? formatDateTime(item.createdAt) : 'Just now';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? 'Unread. ' : ''}${item.title}. ${item.preview}. ${date}`}
      style={({ pressed }) => [
        styles.item,
        item.unread ? styles.itemUnread : null,
        pressed ? styles.itemPressed : null,
      ]}
      onPress={() => openInboxItem(item)}
    >
      <View style={[styles.icon, item.unread ? styles.iconUnread : null]}>
        <Ionicons
          name="alert-circle-outline"
          size={22}
          color={item.unread ? colors.white : colors.primary}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, item.unread ? styles.titleUnread : null]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.unread ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {item.preview}
        </Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
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
    gap: spacing.sm,
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
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  itemPressed: {
    opacity: 0.85,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconUnread: {
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
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
    flexShrink: 1,
  },
  titleUnread: {
    fontWeight: '700',
    color: colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  preview: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

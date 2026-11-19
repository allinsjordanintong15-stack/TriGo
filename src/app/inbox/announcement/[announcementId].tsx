import { LoadingScreen } from '@/components/LoadingScreen';
import { TONE_COLORS } from '@/components/inbox/InboxScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useInbox } from '@/hooks/useInbox';
import { markAnnouncementRead } from '@/services/announcementService';
import { formatDateTime } from '@/utils/dateTime';
import { ANNOUNCEMENT_FALLBACK_TITLE, isUnreadAnnouncement } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * One announcement from TriGo (announcements/{id}, sent to many users): title, date and
 * text. Opening it marks it read for this user (users/{uid}/inboxState/announcements).
 */
export default function AnnouncementScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const { announcements, announcementRead, items, error, retry } = useInbox();
  const announcement = announcements?.find((a) => a.announcementId === announcementId) ?? null;
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !announcement || !announcementRead || !items) return;
    if (!isUnreadAnnouncement(announcement, announcementRead)) return;
    if (markedRef.current === announcement.announcementId) return;
    markedRef.current = announcement.announcementId;
    const shownIds = items.flatMap((i) => (i.kind === 'announcement' ? [i.announcement.announcementId] : []));
    // A failed write leaves it unread; it is tried again the next time it is opened.
    markAnnouncementRead(uid, announcement.announcementId, announcementRead, shownIds).catch(() => {
      markedRef.current = null;
    });
  }, [uid, announcement, announcementRead, items]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const header = <ScreenHeader title="Announcement" onBack={goBack} />;

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <ErrorBanner message={error} />
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      </View>
    );
  }

  if (announcements === null) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  if (!announcement) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="megaphone-outline"
          title="Announcement not available"
          message="TriGo may have withdrawn this announcement."
        />
      </View>
    );
  }

  const tone = TONE_COLORS.announcement;
  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.icon, { backgroundColor: tone.background }]}>
              <Ionicons name="megaphone-outline" size={22} color={tone.color} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {announcement.title.trim() || ANNOUNCEMENT_FALLBACK_TITLE}
            </Text>
          </View>
          <Text style={styles.date}>
            {announcement.createdAt ? formatDateTime(announcement.createdAt) : 'Just now'}
          </Text>
          <Text style={styles.body}>{announcement.body}</Text>
        </View>
        <Text style={styles.note}>Sent by the TriGo team to all {announcement.audience === 'all' ? 'users' : announcement.audience}.</Text>
      </ScrollView>
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
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

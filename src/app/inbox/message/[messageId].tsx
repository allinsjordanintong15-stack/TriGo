import { LoadingScreen } from '@/components/LoadingScreen';
import { inboxItemIcon, TONE_COLORS } from '@/components/inbox/InboxScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { markAdminMessageRead } from '@/services/adminMessageService';
import { formatDateTime } from '@/utils/dateTime';
import {
  InboxActionTarget,
  inboxItemLook,
  inboxMessageAction,
  messageReasonLabel,
  messageToInboxItem,
} from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Where each message button goes. Driver Mode and Earnings are replaced in (not stacked). */
const ACTION_HREFS: Record<InboxActionTarget, { href: Href; replace: boolean }> = {
  driver_mode: { href: '/driver/home', replace: true },
  driver_application: { href: '/profile/driver-application', replace: false },
  driver_earnings: { href: '/driver/earnings', replace: true },
  privacy: { href: '/legal', replace: false },
};

/**
 * One message from TriGo (adminMessages): title, date, text, the admin's reason or remarks,
 * for a suspension until when, and the button for its kind (e.g. "Switch to Driver Mode").
 * Opening it marks it read (readAt, set once).
 */
export default function AdminMessageScreen() {
  const insets = useSafeAreaInsets();
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const { messages, error, retry } = useInbox();
  const message = messages?.find((m) => m.messageId === messageId) ?? null;
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message || message.readAt !== null || markedRef.current === message.messageId) return;
    markedRef.current = message.messageId;
    // A failed write leaves it unread; it is tried again the next time it is opened.
    markAdminMessageRead(message.messageId).catch(() => {
      markedRef.current = null;
    });
  }, [message]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const header = <ScreenHeader title="Message" onBack={goBack} />;

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

  if (messages === null) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon="mail-open-outline" title="Message not available" message="This message could not be found." />
      </View>
    );
  }

  const item = messageToInboxItem(message);
  const tone = TONE_COLORS[inboxItemLook(item).tone];
  const action = inboxMessageAction(message.kind);
  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name={inboxItemIcon(item)} size={24} color={tone.color} />
            <Text style={styles.title} accessibilityRole="header">
              {item.title}
            </Text>
          </View>
          <Text style={styles.date}>{message.createdAt ? formatDateTime(message.createdAt) : 'Just now'}</Text>

          <Text style={styles.body}>{message.body || 'The details of this message are no longer available.'}</Text>

          {message.kind === 'suspended' ? (
            <>
              <Text style={styles.label}>Suspended until</Text>
              <Text style={styles.body}>
                {message.until ? formatDateTime(message.until) : 'The TriGo team lifts it'}
              </Text>
            </>
          ) : null}

          {message.reason ? (
            <>
              <Text style={styles.label}>{messageReasonLabel(message.kind)}</Text>
              <Text style={styles.body}>{message.reason}</Text>
            </>
          ) : null}
        </View>

        {action ? (
          <Button
            title={action.label}
            onPress={() => {
              const target = ACTION_HREFS[action.target];
              if (target.replace) router.replace(target.href);
              else router.push(target.href);
            }}
          />
        ) : null}

        {message.kind === 'report_resolved' ? null : (
          <Text style={styles.note}>
            If you think this is a mistake, contact TriGo support (Profile).
          </Text>
        )}
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
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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

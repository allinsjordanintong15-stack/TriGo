import { openInboxItem } from '@/components/inbox/InboxScreen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { newestUnreadItem } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Driver Home: shown while a warning is not yet acknowledged or a message from TriGo is not
 * yet read; opens the newest one. Hidden while loading, on errors (the inbox shows those)
 * and once everything is read.
 */
export function WarningBanner() {
  const { items, unread } = useInbox();
  const item = items ? newestUnreadItem(items) : null;
  if (!item) return null;

  const more = unread > 1 ? ` (${unread} unread)` : '';
  const isWarning = item.kind === 'warning';
  const title = isWarning ? `You have a warning from TriGo${more}` : `You have a message from TriGo${more}`;
  const text = isWarning ? 'Tap to read it and confirm you understand.' : 'Tap to read it.';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. Open to read it.`}
      style={({ pressed }) => [styles.banner, pressed ? styles.pressed : null]}
      onPress={() => openInboxItem(item)}
    >
      <Ionicons name={isWarning ? 'alert-circle' : 'mail'} size={24} color={colors.white} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.label,
    color: colors.white,
  },
  text: {
    ...typography.caption,
    color: colors.white,
    marginTop: 2,
  },
});

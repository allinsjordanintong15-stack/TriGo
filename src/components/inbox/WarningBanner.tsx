import { colors, radius, spacing, typography } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import { newestUnreadWarning } from '@/utils/inbox';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Driver Home: shown while a warning is not yet acknowledged; opens the newest one. Hidden
 * while loading, on errors (the inbox shows those) and once everything is acknowledged.
 */
export function WarningBanner() {
  const { items, unread } = useInbox();
  const warning = items ? newestUnreadWarning(items) : null;
  if (!warning) return null;

  const more = unread > 1 ? ` (${unread} unread)` : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`You have a warning from TriGo${more}. Open to read it.`}
      style={({ pressed }) => [styles.banner, pressed ? styles.pressed : null]}
      onPress={() =>
        router.push({
          pathname: '/inbox/warning/[warningId]',
          params: { warningId: warning.warningId },
        })
      }
    >
      <Ionicons name="alert-circle" size={24} color={colors.white} />
      <View style={styles.body}>
        <Text style={styles.title}>You have a warning from TriGo{more}</Text>
        <Text style={styles.text}>Tap to read it and confirm you understand.</Text>
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

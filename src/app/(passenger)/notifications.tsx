import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.note}>Push notifications will be implemented in Phase 7.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  back: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  note: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
});

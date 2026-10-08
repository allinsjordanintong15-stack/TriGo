import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function HomeHeader() {
  const { passenger } = useAuth();
  const fullName = passenger?.fullName ?? 'Passenger';

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <Avatar name={fullName} imageUri={passenger?.profileImage ?? null} size={48} />
        {/* Takes the remaining width so long names end in an ellipsis before the bell. */}
        <View style={styles.nameBlock}>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {fullName}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.notificationButton,
          pressed ? styles.notificationButtonPressed : null,
        ]}
        onPress={() => router.navigate('/notifications')}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={4}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
  },
  greeting: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButtonPressed: {
    opacity: 0.7,
  },
});

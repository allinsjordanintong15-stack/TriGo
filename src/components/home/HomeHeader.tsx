import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function HomeHeader() {
  const { passenger } = useAuth();
  const fullName = passenger?.fullName ?? 'Passenger';

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <Avatar name={fullName} imageUri={passenger?.profileImage ?? null} size={48} />
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {fullName}
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.notificationButton}
        onPress={() => router.navigate('/notifications')}
        accessibilityLabel="Notifications"
      >
        <Text style={styles.notificationIcon}>🔔</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  greeting: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 220,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
});

import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { Href, router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function HomeHeader() {
  const { passenger } = useAuth();
  const fullName = passenger?.fullName ?? 'Passenger';

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        {passenger?.profileImage ? (
          <Image source={{ uri: passenger.profileImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{getInitials(fullName)}</Text>
          </View>
        )}
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {fullName}
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.notificationButton}
        onPress={() => router.push('/(passenger)/notifications' as Href)}
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.label,
    color: colors.primary,
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

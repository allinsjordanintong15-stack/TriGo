import { DriverApplicationCard } from '@/components/profile/DriverApplicationCard';
import { ProfileMenuItem, ProfileMenuSection } from '@/components/profile/ProfileMenuItem';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useDriverApplication } from '@/hooks/useDriverApplication';
import { logout } from '@/services/authService';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_VERSION = Constants.expoConfig?.version ?? null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { passenger, hasDriverMode } = useAuth();
  const { clearDraft } = useBookingDraft();
  const driverApplication = useDriverApplication();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  if (!passenger) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Profile" />
        <EmptyState icon="person-outline" title="Profile unavailable" />
      </View>
    );
  }

  function handleLogout() {
    setLoggingOut(true);
    setError('');
    logout()
      .then(() => {
        clearDraft();
        router.replace('/(auth)/login');
      })
      .catch(() => {
        setError('Unable to log out. Please try again.');
        setLoggingOut(false);
        setConfirmLogout(false);
      });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Avatar name={passenger.fullName} imageUri={passenger.profileImage} size={88} />
          <Text style={styles.name} numberOfLines={2}>
            {passenger.fullName}
          </Text>
          <Text style={styles.roleChip}>Passenger</Text>
          <Text style={styles.email} numberOfLines={1}>
            {passenger.email}
          </Text>
        </View>

        <ProfileMenuSection title="Account">
          <ProfileMenuItem
            icon="person-circle-outline"
            label="Personal Information"
            description="Name, email and mobile number"
            onPress={() => router.push('/profile/personal-information')}
            last
          />
        </ProfileMenuSection>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver</Text>
          <DriverApplicationCard
            application={driverApplication.application}
            loading={driverApplication.loading}
            driverModeReady={hasDriverMode}
            onApply={() => router.push('/profile/driver-application')}
            onViewApplication={() => router.push('/profile/driver-application')}
            onOpenDriverMode={() => router.replace('/driver/home')}
          />
          {driverApplication.error ? <ErrorBanner message={driverApplication.error} /> : null}
        </View>

        <ProfileMenuSection title="Support & Settings">
          <ProfileMenuItem
            icon="help-circle-outline"
            label="Help & Support"
            description="How TriGo works and common questions"
            onPress={() => router.push('/profile/help')}
          />
          <ProfileMenuItem
            icon="settings-outline"
            label="Settings"
            description="Location access and app information"
            onPress={() => router.push('/profile/settings')}
            last
          />
        </ProfileMenuSection>

        {error ? <ErrorBanner message={error} /> : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.logout, pressed ? styles.logoutPressed : null]}
          disabled={loggingOut}
          onPress={() => setConfirmLogout(true)}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </Pressable>

        {APP_VERSION ? <Text style={styles.version}>TriGo v{APP_VERSION}</Text> : null}
      </ScrollView>

      <ConfirmationDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will be returned to the login screen."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        destructive
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
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
    paddingTop: spacing.lg,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  name: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  roleChip: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  email: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  logout: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  logoutPressed: {
    backgroundColor: colors.errorBackground,
  },
  logoutText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.error,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

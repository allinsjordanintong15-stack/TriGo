import { DriverApplicationCard } from '@/components/profile/DriverApplicationCard';
import { ProfileMenuItem, ProfileMenuSection } from '@/components/profile/ProfileMenuItem';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useDriverApplication } from '@/hooks/useDriverApplication';
import { logout } from '@/services/authService';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

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
        <View style={styles.avatarRow}>
          {passenger.profileImage ? (
            <Image source={{ uri: passenger.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{getInitials(passenger.fullName)}</Text>
            </View>
          )}
          <View style={styles.avatarMeta}>
            <Text style={styles.name} numberOfLines={1}>
              {passenger.fullName}
            </Text>
            <Text style={styles.role} numberOfLines={1}>
              Passenger · {passenger.email}
            </Text>
          </View>
        </View>

        <ProfileMenuSection title="Account">
          <ProfileMenuItem
            icon="person-circle-outline"
            label="Personal Information"
            description="Name, email, mobile number and profile photo"
            onPress={() => router.push('/profile/personal-information')}
          />
          <ProfileMenuItem
            icon="create-outline"
            label="Edit Profile"
            description="Update your name and mobile number"
            onPress={() => router.push('/profile/edit')}
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

        <ProfileMenuSection title="Activity">
          <ProfileMenuItem
            icon="receipt-outline"
            label="Ride History"
            description="Your current and past trips"
            onPress={() => router.navigate('/activity')}
            last
          />
        </ProfileMenuSection>

        <ProfileMenuSection title="Notifications">
          <ProfileMenuItem
            icon="notifications-outline"
            label="Notifications"
            description="Booking updates and alerts"
            onPress={() => router.navigate('/notifications')}
            last
          />
        </ProfileMenuSection>

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

        <Button
          title="Log Out"
          variant="secondary"
          loading={loggingOut}
          onPress={() => setConfirmLogout(true)}
        />
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.title,
    color: colors.primary,
  },
  avatarMeta: {
    marginLeft: spacing.md,
    flex: 1,
  },
  name: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  role: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
});

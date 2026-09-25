import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
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
  const { passenger } = useAuth();
  const { clearDraft } = useBookingDraft();
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
            <Text style={styles.role}>Passenger</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <Text style={styles.fieldValue}>{passenger.fullName}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{passenger.email}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <Text style={styles.fieldValue}>{passenger.mobileNumber}</Text>
          </View>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <Button
          title="Edit Profile"
          onPress={() => router.push('/profile/edit')}
        />
        <View style={styles.spacer} />
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  field: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text,
  },
  spacer: {
    height: spacing.sm,
  },
});

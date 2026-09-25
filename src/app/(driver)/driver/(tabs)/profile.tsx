import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { logout } from '@/services/authService';
import { goOffline } from '@/services/driverService';
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

const VERIFICATION_LABELS = {
  verified: 'Verified',
  pending_verification: 'Pending verification',
  no_record: 'Not set up',
} as const;

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile: driver, role } = useAuth();
  const [switchingMode, setSwitchingMode] = useState(false);
  const { status, driverRecord } = useDriverAccess();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  if (!driver) {
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
    // Go off duty first — after sign-out the driver can no longer update their record.
    const goOffDuty =
      driverRecord?.isOnline || driverRecord?.isAvailable
        ? goOffline(driverRecord.driverId).catch(() => undefined)
        : Promise.resolve();

    goOffDuty
      .then(() => logout())
      .then(() => {
        router.replace('/(auth)/login');
      })
      .catch(() => {
        setError('Unable to log out. Please try again.');
        setLoggingOut(false);
        setConfirmLogout(false);
      });
  }

  // Passengers with an approved driver application can return to Passenger Mode. They go
  // offline first so they are not matched to rides while booking as a passenger.
  function handleSwitchToPassengerMode() {
    setSwitchingMode(true);
    setError('');
    const goOffDuty =
      driverRecord?.isOnline || driverRecord?.isAvailable
        ? goOffline(driverRecord.driverId)
        : Promise.resolve();

    goOffDuty
      .then(() => router.replace('/profile'))
      .catch(() => {
        setError('Unable to go offline. Please try again before switching modes.');
        setSwitchingMode(false);
      });
  }

  const profileImage = driverRecord?.profileImage ?? driver.profileImage;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarRow}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{getInitials(driver.fullName)}</Text>
            </View>
          )}
          <View style={styles.avatarMeta}>
            <Text style={styles.name} numberOfLines={1}>
              {driver.fullName}
            </Text>
            <Text style={styles.role}>Driver · {VERIFICATION_LABELS[status]}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{driver.email}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <Text style={styles.fieldValue}>{driver.mobileNumber || '—'}</Text>
          </View>
          {driverRecord ? (
            <View style={[styles.field, styles.fieldLast]}>
              <Text style={styles.fieldLabel}>Vehicle</Text>
              <Text style={styles.fieldValue}>
                {driverRecord.vehicleType
                  ? driverRecord.vehicleType.charAt(0).toUpperCase() +
                    driverRecord.vehicleType.slice(1)
                  : '—'}
                {driverRecord.vehiclePlate ? ` · ${driverRecord.vehiclePlate}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.note}>
          Driver details are managed by the TriGo administrator. Contact them to update your
          vehicle or account information.
        </Text>

        {error ? <ErrorBanner message={error} /> : null}

        {role === 'passenger' ? (
          <>
            <Button
              title="Switch to Passenger Mode"
              loading={switchingMode}
              disabled={loggingOut}
              onPress={handleSwitchToPassengerMode}
            />
            <View style={styles.spacer} />
          </>
        ) : null}

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
    marginBottom: spacing.md,
  },
  field: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  fieldLast: {
    borderBottomWidth: 0,
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
  note: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});

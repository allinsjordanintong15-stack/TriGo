import { VehicleChip } from '@/components/driver/VehicleChip';
import { VerificationBadge } from '@/components/driver/VerificationBadge';
import { ProfileMenuItem, ProfileMenuSection } from '@/components/profile/ProfileMenuItem';
import { SupportContactsList } from '@/components/support/SupportContactsList';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { DRIVER_ACCESS_REVOKED, useDriverAccess } from '@/hooks/useDriverAccess';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { logout } from '@/services/authService';
import { goOffline } from '@/services/driverService';
import { DriverRecord } from '@/types';
import {
  NotificationSettingAction,
  notificationSettingAction,
} from '@/utils/notificationPermission';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const APP_VERSION = Constants.expoConfig?.version ?? null;

/**
 * Read-only vehicle rows. Brand & model and color are left out for records approved before
 * they were recorded, so nothing looks missing.
 */
function getVehicleRows(record: DriverRecord): { icon: IconName; label: string; value: string }[] {
  const rows: { icon: IconName; label: string; value: string }[] = [
    {
      icon: 'car-outline',
      label: 'Type',
      value: record.vehicleType
        ? record.vehicleType.charAt(0).toUpperCase() + record.vehicleType.slice(1)
        : '—',
    },
  ];
  if (record.vehicleBrand && record.vehicleModel) {
    rows.push({
      icon: 'pricetag-outline',
      label: 'Brand & model',
      value: `${record.vehicleBrand} ${record.vehicleModel}`,
    });
  }
  if (record.vehicleColor) {
    rows.push({ icon: 'color-palette-outline', label: 'Color', value: record.vehicleColor });
  }
  rows.push({ icon: 'card-outline', label: 'Plate', value: record.vehiclePlate || '—' });
  return rows;
}

/** One line under "Ride request alerts" for each permission state. */
const ALERTS_SUBTITLE: Record<NotificationSettingAction, string> = {
  none: 'New requests while TriGo is open but not on screen.',
  request: 'Tap to turn on ride request notifications.',
  open_settings: 'Turned off. Tap to open your phone settings.',
};

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile: driver, role } = useAuth();
  const [switchingMode, setSwitchingMode] = useState(false);
  const { status, driverRecord } = useDriverAccess();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const notifications = useNotificationPermission();

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
        ? goOffline(driverRecord.driverId, driverRecord.currentRequestId).catch(() => undefined)
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
        ? goOffline(driverRecord.driverId, driverRecord.currentRequestId)
        : Promise.resolve();

    goOffDuty
      .then(() => router.replace('/profile'))
      .catch(() => {
        setError('Unable to go offline. Please try again before switching modes.');
        setSwitchingMode(false);
      });
  }

  const profileImage = driverRecord?.profileImage ?? driver.profileImage;
  const alertsAction = notifications.state ? notificationSettingAction(notifications.state) : null;

  function handleAlertsPress() {
    if (alertsAction === 'request') {
      void notifications.request();
    } else if (alertsAction === 'open_settings') {
      Linking.openSettings().catch(() => undefined);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <Avatar name={driver.fullName} imageUri={profileImage} size={64} />
          <View style={styles.profileMeta}>
            <Text style={styles.name} numberOfLines={2}>
              {driver.fullName}
            </Text>
            <View style={styles.badgeRow}>
              <VerificationBadge status={status} />
              {driverRecord ? <VehicleChip vehicle={driverRecord} /> : null}
            </View>
          </View>
        </View>

        {status === 'revoked' ? (
          <Text style={styles.revokedNotice} accessibilityRole="alert">
            {DRIVER_ACCESS_REVOKED.title}. {DRIVER_ACCESS_REVOKED.message}
          </Text>
        ) : null}

        <ProfileMenuSection title="Account">
          <ProfileMenuItem icon="mail-outline" label="Email" value={driver.email} />
          <ProfileMenuItem
            icon="phone-portrait-outline"
            label="Mobile number"
            value={driver.mobileNumber || '—'}
            last
          />
        </ProfileMenuSection>

        {driverRecord ? (
          <ProfileMenuSection
            title="Vehicle"
            footer="Driver details are managed by the TriGo administrator. Contact them to update your vehicle or account information."
          >
            {getVehicleRows(driverRecord).map((row, index, rows) => (
              <ProfileMenuItem
                key={row.label}
                icon={row.icon}
                label={row.label}
                value={row.value}
                last={index === rows.length - 1}
              />
            ))}
          </ProfileMenuSection>
        ) : (
          <Text style={styles.note}>
            Driver details are managed by the TriGo administrator. Contact them to update your
            vehicle or account information.
          </Text>
        )}

        {/* Hidden until the permission has been read, as before. */}
        {notifications.state && alertsAction ? (
          <ProfileMenuSection title="Preferences">
            <ProfileMenuItem
              icon="notifications-outline"
              label="Ride request alerts"
              description={ALERTS_SUBTITLE[alertsAction]}
              pill={
                notifications.state.status === 'granted'
                  ? { label: 'On', tone: 'on' }
                  : { label: 'Off', tone: 'off' }
              }
              onPress={alertsAction === 'none' ? undefined : handleAlertsPress}
              last
            />
          </ProfileMenuSection>
        ) : null}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Support
        </Text>
        <View style={styles.supportContacts}>
          <SupportContactsList />
        </View>

        <ProfileMenuSection title="Legal">
          <ProfileMenuItem
            icon="shield-checkmark-outline"
            label="Privacy Policy & Terms"
            description="What you agreed to and the privacy contact"
            onPress={() => router.push('/legal')}
            last
          />
        </ProfileMenuSection>

        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        {role === 'passenger' ? (
          <ProfileMenuSection>
            <ProfileMenuItem
              icon="swap-horizontal-outline"
              label="Switch to Passenger Mode"
              loading={switchingMode}
              disabled={loggingOut}
              onPress={handleSwitchToPassengerMode}
              last
            />
          </ProfileMenuSection>
        ) : null}

        {APP_VERSION ? <Text style={styles.version}>TriGo v{APP_VERSION}</Text> : null}

        <ProfileMenuSection>
          <ProfileMenuItem
            icon="log-out-outline"
            label="Log Out"
            destructive
            showChevron={false}
            loading={loggingOut}
            onPress={() => setConfirmLogout(true)}
            last
          />
        </ProfileMenuSection>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  profileMeta: {
    flex: 1,
  },
  name: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  revokedNotice: {
    ...typography.caption,
    color: colors.error,
    backgroundColor: colors.errorBackground,
    borderRadius: radius.md,
    padding: spacing.md,
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
  supportContacts: {
    marginBottom: spacing.lg,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  errorWrap: {
    marginBottom: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

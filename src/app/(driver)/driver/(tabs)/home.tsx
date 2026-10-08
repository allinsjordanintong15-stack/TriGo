import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { countDriverCompletedTripsSince } from '@/services/driverBookingService';
import { useAuth } from '@/hooks/useAuth';
import { DriverAccessStatus, useDriverAccess } from '@/hooks/useDriverAccess';
import {
  becomeAvailable,
  DriverServiceError,
  goOffline,
  goOnline,
} from '@/services/driverService';
import { getCurrentCoordinates, LocationServiceError } from '@/services/locationService';
import { OutOfAreaRequest } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ACCESS_STATUS_CONTENT: Record<
  DriverAccessStatus,
  { icon: IconName; title: string; message: string }
> = {
  verified: {
    icon: 'shield-checkmark-outline',
    title: 'Verified driver',
    message: 'Your TriGo driver account is verified.',
  },
  pending_verification: {
    icon: 'time-outline',
    title: 'Pending verification',
    message:
      'A TriGo administrator must verify your account before you can go online or accept trips.',
  },
  no_record: {
    icon: 'alert-circle-outline',
    title: 'Driver account not set up',
    message:
      'Your driver record has not been created yet. Please contact the TriGo administrator to finish setting up your account.',
  },
};

const ACTIVE_REQUEST_LABELS: Partial<Record<OutOfAreaRequest['status'], string>> = {
  negotiating: 'Fare proposed · waiting for passenger',
  accepted: 'Fare accepted by passenger',
};

function formatVehicleType(vehicleType: string): string {
  return vehicleType ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1) : '—';
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getStartOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile: driver } = useAuth();
  const { status, driverRecord, canPerformDriverActions } = useDriverAccess();
  const [updatingDuty, setUpdatingDuty] = useState(false);
  const [error, setError] = useState('');
  const { activeBookings, activeRequests, loaded, hasActiveTrip } = useDriverActivity();
  const driverId = driverRecord?.driverId ?? null;
  // null while loading; refreshed whenever the tab gains focus so finished trips count.
  const [completedToday, setCompletedToday] = useState<number | null>(null);
  const [completedTodayError, setCompletedTodayError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      countDriverCompletedTripsSince(driverId, getStartOfToday())
        .then((count) => {
          if (!active) return;
          setCompletedToday(count);
          setCompletedTodayError(false);
        })
        .catch(() => {
          if (!active) return;
          setCompletedTodayError(true);
        });

      return () => {
        active = false;
      };
    }, [driverId]),
  );

  async function handleGoOnline() {
    if (!driverRecord || !canPerformDriverActions) return;

    setUpdatingDuty(true);
    setError('');

    try {
      const coordinates = await getCurrentCoordinates();
      await goOnline(driverRecord, coordinates, hasActiveTrip);
    } catch (err) {
      setError(
        err instanceof LocationServiceError || err instanceof DriverServiceError
          ? err.message
          : 'Unable to go online. Please try again.',
      );
    } finally {
      setUpdatingDuty(false);
    }
  }

  async function handleBecomeAvailable() {
    if (!driverRecord || hasActiveTrip) return;

    setUpdatingDuty(true);
    setError('');

    try {
      await becomeAvailable(driverRecord);
    } catch (err) {
      setError(
        err instanceof DriverServiceError
          ? err.message
          : 'Unable to update your availability. Please try again.',
      );
    } finally {
      setUpdatingDuty(false);
    }
  }

  async function handleGoOffline() {
    if (!driverRecord) return;

    setUpdatingDuty(true);
    setError('');

    try {
      await goOffline(driverRecord.driverId);
    } catch (err) {
      setError(
        err instanceof DriverServiceError ? err.message : 'Unable to go offline. Please try again.',
      );
    } finally {
      setUpdatingDuty(false);
    }
  }

  const statusContent = ACCESS_STATUS_CONTENT[status];
  const fullName = driverRecord?.fullName || driver?.fullName || 'Driver';
  const firstName = fullName.split(' ').find(Boolean) ?? fullName;
  const profileImage = driverRecord?.profileImage ?? driver?.profileImage ?? null;
  const isOnline = driverRecord?.isOnline === true;
  const activeBooking = activeBookings[0] ?? null;
  const activeRequest = activeRequests[0] ?? null;
  // Only offer this once active trips have loaded and no booking or fare proposal is
  // linked, so it never shows mid-trip (Firestore rules also refuse availability while
  // currentBookingId or currentRequestId is set).
  const canBecomeAvailable =
    isOnline &&
    driverRecord?.isAvailable === false &&
    !driverRecord.currentBookingId &&
    !driverRecord.currentRequestId &&
    loaded &&
    !hasActiveTrip;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Driver Home" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileRow}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{getInitials(fullName)}</Text>
            </View>
          )}
          <View style={styles.profileMeta}>
            <Text style={styles.name} numberOfLines={1}>
              {getGreeting(new Date())}, {firstName}
            </Text>
            <Text style={styles.profileSubtitle}>
              TriGo driver
              {driverRecord ? ` · ★ ${driverRecord.rating.toFixed(1)}` : ''}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusCard,
            status === 'verified' ? styles.statusCardVerified : styles.statusCardAttention,
          ]}
        >
          <Ionicons
            name={statusContent.icon}
            size={26}
            color={status === 'verified' ? colors.primary : colors.primaryDark}
          />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{statusContent.title}</Text>
            <Text style={styles.statusMessage}>{statusContent.message}</Text>
          </View>
        </View>

        <ErrorBanner message={error} />

        {driverRecord ? (
          <>
            <View style={[styles.dutyCard, isOnline ? styles.dutyCardOnline : null]}>
              <View style={styles.dutyHeader}>
                <View style={[styles.dutyDot, isOnline ? styles.dutyDotOnline : null]} />
                <Text style={[styles.dutyTitle, isOnline ? styles.dutyTitleOnline : null]}>
                  {isOnline ? 'You are online' : 'You are offline'}
                </Text>
              </View>
              <Text style={[styles.dutyMessage, isOnline ? styles.dutyMessageOnline : null]}>
                {isOnline
                  ? driverRecord.isAvailable
                    ? 'Available for trips. New ride requests appear in the Requests tab.'
                    : hasActiveTrip
                      ? 'On a trip — not receiving new requests until it ends.'
                      : 'Online but not available for new trips.'
                  : canPerformDriverActions
                    ? 'Go online to become available for bookings in Trinidad, Bohol.'
                    : 'You can go online once your account is verified.'}
              </Text>

              {isOnline ? (
                <>
                  {canBecomeAvailable ? (
                    <>
                      <Button
                        title="Become Available"
                        loading={updatingDuty}
                        onPress={handleBecomeAvailable}
                      />
                      <View style={styles.buttonSpacer} />
                    </>
                  ) : null}
                  <Button
                    title="Go Offline"
                    variant="secondary"
                    loading={updatingDuty && !canBecomeAvailable}
                    disabled={updatingDuty}
                    onPress={handleGoOffline}
                  />
                </>
              ) : (
                <Button
                  title="Go Online"
                  loading={updatingDuty}
                  disabled={!canPerformDriverActions}
                  onPress={handleGoOnline}
                />
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Vehicle</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Type</Text>
                <Text style={styles.fieldValue}>{formatVehicleType(driverRecord.vehicleType)}</Text>
              </View>
              <View style={[styles.field, styles.fieldLast]}>
                <Text style={styles.fieldLabel}>Plate number</Text>
                <Text style={styles.fieldValue}>{driverRecord.vehiclePlate || '—'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Current trip or request</Text>
              {activeBooking ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/driver/trip/[bookingId]',
                      params: { bookingId: activeBooking.bookingId },
                    })
                  }
                >
                  <View style={styles.tripBadgeRow}>
                    <StatusBadge status={activeBooking.status} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Pickup</Text>
                    <Text style={styles.fieldValue} numberOfLines={2}>
                      {activeBooking.pickupLocation.address}
                    </Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Destination</Text>
                    <Text style={styles.fieldValue} numberOfLines={2}>
                      {activeBooking.destination.address}
                    </Text>
                  </View>
                  <View style={[styles.field, styles.fieldLast]}>
                    <Text style={styles.fieldLabel}>
                      {activeBooking.agreedFare !== null ? 'Agreed fare' : 'Estimated fare'}
                    </Text>
                    <Text style={styles.fareValue}>
                      {formatPhilippinePeso(activeBooking.agreedFare ?? activeBooking.estimatedFare)}
                    </Text>
                  </View>
                  <Text style={styles.moreRequests}>Tap to view trip details</Text>
                </Pressable>
              ) : activeRequest ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/driver/requests/out-of-area/[requestId]',
                      params: { requestId: activeRequest.requestId },
                    })
                  }
                >
                  <Text style={styles.requestBadge}>
                    {ACTIVE_REQUEST_LABELS[activeRequest.status] ?? 'Out-of-area request'}
                  </Text>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Pickup</Text>
                    <Text style={styles.fieldValue} numberOfLines={2}>
                      {activeRequest.pickupLocation.address}
                    </Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Destination</Text>
                    <Text style={styles.fieldValue} numberOfLines={2}>
                      {activeRequest.destination.address}
                    </Text>
                  </View>
                  <View style={[styles.field, styles.fieldLast]}>
                    <Text style={styles.fieldLabel}>
                      {activeRequest.agreedFare !== null ? 'Agreed fare' : 'Your proposed fare'}
                    </Text>
                    <Text style={styles.fareValue}>
                      {formatPhilippinePeso(
                        activeRequest.agreedFare ??
                          activeRequest.fareAgreement?.driverProposedFare ??
                          0,
                      )}
                    </Text>
                  </View>
                  {activeRequests.length > 1 ? (
                    <Text style={styles.moreRequests}>
                      +{activeRequests.length - 1} more active request
                      {activeRequests.length > 2 ? 's' : ''}
                    </Text>
                  ) : null}
                  <Text style={styles.moreRequests}>
                    {activeRequest.status === 'accepted' ? 'Tap to view details' : 'Tap to view or withdraw'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.emptyText}>No active trip or request right now.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Today</Text>
              <View style={[styles.field, styles.fieldLast, styles.summaryRow]}>
                <Text style={styles.fieldLabel}>Completed trips</Text>
                {completedTodayError ? (
                  <Text style={styles.emptyText}>Unavailable</Text>
                ) : completedToday === null ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.summaryValue}>{completedToday}</Text>
                )}
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/driver/trips')}>
                <Text style={styles.linkText}>View trip history</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Earnings</Text>
              <Text style={styles.emptyText}>
                Your earnings summary is not available yet. It will appear here once earnings
                tracking is enabled.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Commission</Text>
              <Text style={styles.emptyText}>
                No commission records yet. Commission rates and settlement are set by the TriGo
                administrator.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.title,
    fontSize: 24,
    color: colors.primary,
  },
  profileMeta: {
    marginLeft: spacing.md,
    flex: 1,
  },
  name: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  profileSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    backgroundColor: colors.primaryLight,
  },
  statusCardVerified: {
    borderLeftColor: colors.primary,
  },
  statusCardAttention: {
    borderLeftColor: colors.accent,
  },
  statusText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusTitle: {
    ...typography.label,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dutyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  dutyCardOnline: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  dutyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dutyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
    marginRight: spacing.sm,
  },
  dutyDotOnline: {
    backgroundColor: colors.accent,
  },
  dutyTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  dutyTitleOnline: {
    color: colors.white,
  },
  dutyMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  dutyMessageOnline: {
    color: colors.primaryLight,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
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
  fareValue: {
    ...typography.title,
    fontSize: 20,
    color: colors.primary,
  },
  requestBadge: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  moreRequests: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  buttonSpacer: {
    height: spacing.sm,
  },
  tripBadgeRow: {
    marginVertical: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryValue: {
    ...typography.title,
    fontSize: 20,
    color: colors.primary,
  },
  linkText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    paddingVertical: spacing.xs,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
});

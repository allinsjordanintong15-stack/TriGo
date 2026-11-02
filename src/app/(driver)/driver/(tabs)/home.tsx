import { RouteTimeline } from '@/components/booking/RouteTimeline';
import { ActiveTripBanner } from '@/components/driver/ActiveTripBanner';
import { CommissionBanner } from '@/components/driver/CommissionBanner';
import { CommissionCard } from '@/components/driver/CommissionCard';
import { DailyQuotaCard } from '@/components/driver/DailyQuotaCard';
import { DriverStatusCard } from '@/components/driver/DriverStatusCard';
import { DutyToggle } from '@/components/driver/DutyToggle';
import { FaresCollectedCard } from '@/components/driver/FaresCollectedCard';
import { GoOnlineLocationCard } from '@/components/driver/GoOnlineLocationCard';
import { SupportContactsList } from '@/components/support/SupportContactsList';
import { formatExpiresIn } from '@/components/driver/OutOfAreaRequestCard';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useAuth } from '@/hooks/useAuth';
import { useCommissionAccount } from '@/hooks/useCommissionAccount';
import { DRIVER_ACCESS_REVOKED, DriverAccessStatus, useDriverAccess } from '@/hooks/useDriverAccess';
import { useFaresCollected } from '@/hooks/useFaresCollected';
import { becomeAvailable, DriverServiceError, goOffline, goOnline } from '@/services/driverService';
import {
  getNotificationPermission,
  hasSeenNotificationPrompt,
  markNotificationPromptSeen,
  requestNotificationPermission,
} from '@/services/localNotificationService';
import {
  enableLocationServices,
  getGoOnlineCoordinates,
  GoOnlineLocationError,
  openAppSettings,
} from '@/services/locationService';
import { formatPhilippinePeso } from '@/utils/fare';
import { LocationProblem, locationProblemMessage } from '@/utils/goOnlineLocation';
import { shouldExplainBeforeGoingOnline } from '@/utils/notificationPermission';
import { isProposalOutcome, PROPOSAL_OUTCOME_TEXT, ProposalState } from '@/utils/outOfAreaProposal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Accounts that cannot drive yet; a verified account shows its duty state instead. */
const ACCESS_GATE_CONTENT: Record<
  Exclude<DriverAccessStatus, 'verified'>,
  { icon: IconName; title: string; message: string }
> = {
  revoked: {
    icon: 'ban-outline',
    ...DRIVER_ACCESS_REVOKED,
  },
  pending_verification: {
    icon: 'time-outline',
    title: 'Pending verification',
    message:
      'A TriGo administrator must verify your account before you can go online or accept trips.',
  },
  role_not_authorized: {
    icon: 'alert-circle-outline',
    title: 'Driver access not active',
    message:
      'Your account is not set up for driver access yet. Please contact the TriGo administrator to finish setting up your account.',
  },
  invalid_vehicle_type: {
    icon: 'car-outline',
    title: 'Vehicle type not set up',
    message: 'Your vehicle type is not set up correctly. Please contact the TriGo administrator.',
  },
  no_record: {
    icon: 'alert-circle-outline',
    title: 'Driver account not set up',
    message:
      'Your driver record has not been created yet. Please contact the TriGo administrator to finish setting up your account.',
  },
};

function getProposalTitle(state: ProposalState | null): string {
  if (state === null || state === 'waiting') return 'Waiting for the passenger';
  if (state === 'accepted') return 'Passenger confirmed';
  return PROPOSAL_OUTCOME_TEXT[state].title;
}

function getProposalMessage(state: ProposalState | null): string {
  if (state === 'accepted') return 'Starting your trip…';
  if (state !== null && isProposalOutcome(state)) return 'Releasing you for other requests…';
  return 'You accepted an out-of-area request. You will not get new requests until the passenger confirms or the request ends.';
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile: driver } = useAuth();
  const { status, driverRecord, canPerformDriverActions } = useDriverAccess();
  const [updatingDuty, setUpdatingDuty] = useState(false);
  const [error, setError] = useState('');
  // Why going online failed for lack of a position; the driver stays offline meanwhile.
  const [locationProblem, setLocationProblem] = useState<LocationProblem | null>(null);
  const {
    activeBookings,
    loaded,
    hasActiveTrip,
    heldRequest,
    proposalState,
    finishedProposal,
    dismissFinishedProposal,
    dailyQuota,
  } = useDriverActivity();
  const driverId = driverRecord?.driverId ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [explainNotifications, setExplainNotifications] = useState(false);

  // Ticks the request countdown while waiting for the passenger.
  const isWaitingForPassenger = proposalState === 'waiting';
  useEffect(() => {
    if (!isWaitingForPassenger) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isWaitingForPassenger]);

  const fares = useFaresCollected(driverId);
  const commission = useCommissionAccount(driverId);

  /**
   * Go online, first explaining ride-request notifications once per device while they are
   * off and the system can still ask (Android 13+). The driver goes online either way.
   */
  async function handleGoOnlinePress() {
    if (!driverRecord || !canPerformDriverActions) return;
    const [permission, promptSeen] = await Promise.all([
      getNotificationPermission(),
      hasSeenNotificationPrompt(driverRecord.driverId),
    ]);
    if (shouldExplainBeforeGoingOnline(permission, promptSeen)) {
      setExplainNotifications(true);
      return;
    }
    await handleGoOnline();
  }

  async function answerNotificationPrompt(allow: boolean) {
    setExplainNotifications(false);
    if (!driverRecord) return;
    await markNotificationPromptSeen(driverRecord.driverId);
    // A denial here is fine: the in-app vibration and Requests list keep working.
    if (allow) await requestNotificationPermission();
    await handleGoOnline();
  }

  async function handleGoOnline() {
    if (!driverRecord || !canPerformDriverActions) return;

    setUpdatingDuty(true);
    setError('');

    try {
      // Going online must record a position; without one nothing is written.
      const coordinates = await getGoOnlineCoordinates();
      await goOnline(driverRecord, coordinates, hasActiveTrip);
      setLocationProblem(null);
    } catch (err) {
      if (err instanceof GoOnlineLocationError) {
        setLocationProblem(err.problem);
      } else {
        setLocationProblem(null);
        setError(err instanceof DriverServiceError ? err.message : 'Unable to go online. Please try again.');
      }
    } finally {
      setUpdatingDuty(false);
    }
  }

  /** The location card's button: fix what stopped the driver, then try going online again. */
  async function handleLocationAction() {
    if (!locationProblem) return;
    switch (locationProblemMessage(locationProblem).action) {
      case 'open-app-settings':
        // The driver comes back and taps Go online again.
        await openAppSettings();
        return;
      case 'enable-location-services':
        try {
          if ((await enableLocationServices()) === 'opened-settings') return;
        } catch {
          return; // Declined in the system dialog: the card stays.
        }
        break;
      default:
        break;
    }
    await handleGoOnline();
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
      setLocationProblem(null);
      // A pending out-of-area request is withdrawn in the same commit.
      await goOffline(driverRecord.driverId, driverRecord.currentRequestId);
    } catch (err) {
      setError(
        err instanceof DriverServiceError ? err.message : 'Unable to go offline. Please try again.',
      );
    } finally {
      setUpdatingDuty(false);
    }
  }

  const fullName = driverRecord?.fullName || driver?.fullName || 'Driver';
  const firstName = fullName.split(' ').find(Boolean) ?? fullName;
  const profileImage = driverRecord?.profileImage ?? driver?.profileImage ?? null;
  const isOnline = driverRecord?.isOnline === true;
  const activeBooking = activeBookings[0] ?? null;
  const reservedRequestId = driverRecord?.currentRequestId ?? null;
  const heldFare =
    heldRequest?.agreedFare ?? heldRequest?.fareAgreement?.driverProposedFare ?? null;
  const finishedOutcome =
    finishedProposal && isProposalOutcome(finishedProposal.outcome)
      ? finishedProposal.outcome
      : null;
  // Only offer this once active trips have loaded and no booking or out-of-area request
  // is linked, so it never shows mid-trip (Firestore rules also refuse availability while
  // currentBookingId or currentRequestId is set).
  const canBecomeAvailable =
    isOnline &&
    driverRecord?.isAvailable === false &&
    !driverRecord.currentBookingId &&
    !driverRecord.currentRequestId &&
    loaded &&
    !hasActiveTrip;

  const dutyCaption =
    !canPerformDriverActions && !isOnline
      ? 'You can go online once your account is verified.'
      : isOnline
        ? 'Tap to go offline'
        : 'Tap to go online and receive ride requests';

  // One card for where the driver stands right now, with at most one main action.
  let statusCard: ReactNode;
  if (status !== 'verified') {
    const gate = ACCESS_GATE_CONTENT[status];
    statusCard = (
      <DriverStatusCard
        icon={gate.icon}
        title={gate.title}
        message={gate.message}
        tone="attention"
      >
        {status === 'revoked' ? <SupportContactsList /> : null}
      </DriverStatusCard>
    );
  } else if (activeBooking) {
    statusCard = (
      <ActiveTripBanner
        booking={activeBooking}
        onPress={() =>
          router.push({
            pathname: '/driver/trip/[bookingId]',
            params: { bookingId: activeBooking.bookingId },
          })
        }
      />
    );
  } else if (reservedRequestId) {
    statusCard = (
      <DriverStatusCard
        icon="time-outline"
        tone="attention"
        title={getProposalTitle(proposalState)}
        message={getProposalMessage(proposalState)}
        badge={
          proposalState === 'waiting' && heldRequest
            ? formatExpiresIn(heldRequest.expiresAt, now)
            : undefined
        }
        actionTitle="Open request"
        onAction={() =>
          router.push({
            pathname: '/driver/requests/out-of-area/[requestId]',
            params: { requestId: reservedRequestId },
          })
        }
      >
        {heldRequest ? (
          <>
            <RouteTimeline
              pickupAddress={heldRequest.pickupLocation.address}
              destinationAddress={heldRequest.destination.address}
              compact
            />
            {heldFare !== null ? (
              <Text style={styles.fareLine}>Fare {formatPhilippinePeso(heldFare)}</Text>
            ) : null}
          </>
        ) : null}
      </DriverStatusCard>
    );
  } else if (finishedProposal && finishedOutcome) {
    statusCard = (
      <DriverStatusCard
        icon="information-circle-outline"
        title={PROPOSAL_OUTCOME_TEXT[finishedOutcome].title}
        message={`${PROPOSAL_OUTCOME_TEXT[finishedOutcome].message}${
          finishedProposal.request ? ` (${finishedProposal.request.destination.address})` : ''
        }`}
        actionTitle="Dismiss"
        actionVariant="secondary"
        onAction={dismissFinishedProposal}
      />
    );
  } else if (!isOnline) {
    statusCard = (
      <DriverStatusCard
        icon="power-outline"
        title="You are offline"
        message="Go online to receive ride requests in Trinidad, Bohol."
        actionTitle="Go online"
        actionLoading={updatingDuty}
        onAction={handleGoOnlinePress}
      />
    );
  } else if (driverRecord?.isAvailable) {
    statusCard = (
      <DriverStatusCard
        icon="checkmark-circle-outline"
        title="You are available"
        message="New ride requests appear in the Requests tab."
        actionTitle="View requests"
        onAction={() => router.navigate('/driver/requests')}
      />
    );
  } else {
    statusCard = (
      <DriverStatusCard
        icon="pause-circle-outline"
        title="Online, not available"
        message="You are online but not receiving new requests."
        actionTitle={canBecomeAvailable ? 'Become available' : undefined}
        actionLoading={updatingDuty}
        onAction={canBecomeAvailable ? handleBecomeAvailable : undefined}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Home" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileRow}>
          <Avatar name={fullName} imageUri={profileImage} size={56} />
          <View style={styles.profileMeta}>
            <Text style={styles.greeting} numberOfLines={1}>
              {getGreeting(new Date())}, {firstName}
            </Text>
            <Text style={styles.profileSubtitle}>
              TriGo driver
              {driverRecord && driverRecord.rating > 0
                ? ` · ★ ${driverRecord.rating.toFixed(1)}`
                : ''}
            </Text>
          </View>
        </View>

        {driverRecord ? (
          <DutyToggle
            isOnline={isOnline}
            caption={dutyCaption}
            loading={updatingDuty}
            disabled={!isOnline && !canPerformDriverActions}
            onChange={(online) => (online ? handleGoOnlinePress() : handleGoOffline())}
          />
        ) : null}

        <ErrorBanner message={error} />

        {locationProblem && !isOnline ? (
          <GoOnlineLocationCard
            problem={locationProblem}
            busy={updatingDuty}
            onAction={() => void handleLocationAction()}
          />
        ) : null}

        {driverRecord ? (
          <CommissionBanner state={commission} onOpen={() => router.navigate('/driver/earnings')} />
        ) : null}

        {/* Daily acceptance quota: always shown to verified drivers once the limit is read. */}
        {status === 'verified' && dailyQuota ? <DailyQuotaCard status={dailyQuota} /> : null}

        {statusCard}

        {driverRecord ? (
          <FaresCollectedCard
            today={fares.today}
            thisWeek={fares.thisWeek}
            error={fares.error}
            onViewHistory={() => router.navigate('/driver/trips')}
          />
        ) : null}

        {/* Hidden when the admin has not set a commission and nothing was ever recorded. */}
        {driverRecord &&
        (commission.loading || commission.error || commission.settings || commission.account) ? (
          <CommissionCard
            state={commission}
            variant="summary"
            onOpen={() => router.navigate('/driver/earnings')}
          />
        ) : null}
      </ScrollView>

      <ConfirmationDialog
        visible={explainNotifications}
        title="Get ride request alerts?"
        message="TriGo can show a notification when a new ride request comes in while TriGo is open but not on screen. It cannot alert you when the app is closed."
        confirmLabel="Allow"
        cancelLabel="Not now"
        onConfirm={() => void answerNotificationPrompt(true)}
        onCancel={() => void answerNotificationPrompt(false)}
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileMeta: {
    flex: 1,
  },
  greeting: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  profileSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fareLine: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});

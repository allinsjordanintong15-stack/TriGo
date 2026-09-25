import { TripSummaryCard } from '@/components/booking/TripSummaryCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import {
  BookingServiceError,
  cancelOutOfAreaRequest,
  subscribeToOutOfAreaRequest,
} from '@/services/bookingService';
import {
  findNearbyAvailableDrivers,
  getDriverSearchStatusMessage,
} from '@/services/driverSearchService';
import { OutOfAreaRequest } from '@/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OutOfAreaSearchScreen() {
  const insets = useSafeAreaInsets();
  const { tripQuote, activeOutOfAreaRequestId, setActiveOutOfAreaRequestId } = useBookingDraft();
  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [driverCount, setDriverCount] = useState(0);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      (updatedRequest) => {
        setRequest(updatedRequest);

        if (
          updatedRequest.status === 'negotiating' &&
          updatedRequest.fareAgreement
        ) {
          router.replace('/(passenger)/booking/agreement');
        }
      },
      (err) => {
        setError(
          err instanceof BookingServiceError
            ? err.message
            : 'Unable to load your request. Please try again.',
        );
      },
    );

    return unsubscribe;
  }, [activeOutOfAreaRequestId]);

  useEffect(() => {
    if (!tripQuote) return;

    async function searchDrivers() {
      setLoadingDrivers(true);
      try {
        const drivers = await findNearbyAvailableDrivers(
          tripQuote!.pickupLocation,
          tripQuote!.vehicleType,
        );
        setDriverCount(drivers.length);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to search for drivers. Please try again.',
        );
      } finally {
        setLoadingDrivers(false);
      }
    }

    searchDrivers();
  }, [tripQuote]);

  async function handleCancel() {
    if (!activeOutOfAreaRequestId) return;

    try {
      await cancelOutOfAreaRequest(activeOutOfAreaRequestId);
      setActiveOutOfAreaRequestId(null);
      router.dismissTo('/home');
    } catch (err) {
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to cancel the request. Please try again.',
      );
    }
  }

  if (!tripQuote) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.subtitle}>No active out-of-area request.</Text>
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={styles.title}>Request Out-of-Area Ride</Text>
      <Text style={styles.subtitle}>
        We are searching for nearby available drivers who can accept your trip. A driver must
        agree to the trip and fare before your booking is confirmed.
      </Text>

      <ErrorBanner message={error} />

      <TripSummaryCard
        quote={tripQuote}
        bookingTypeLabel="Out-of-Area Trip Request"
      />

      <View style={styles.statusCard}>
        {loadingDrivers ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.statusText}>Searching for available drivers…</Text>
          </>
        ) : (
          <>
            <Text style={styles.statusTitle}>
              {getDriverSearchStatusMessage(driverCount)}
            </Text>
            <Text style={styles.statusNote}>
              {driverCount === 0
                ? 'No drivers are available right now. Your request stays active while we wait for a nearby driver.'
                : 'Waiting for a driver to review and accept your request.'}
            </Text>
          </>
        )}

        {request ? (
          <Text style={styles.requestId}>Request status: {formatRequestStatus(request.status)}</Text>
        ) : null}
      </View>

      <Button title="Cancel Request" variant="secondary" onPress={handleCancel} />
    </ScrollView>
  );
}

function formatRequestStatus(status: OutOfAreaRequest['status']): string {
  const labels: Record<OutOfAreaRequest['status'], string> = {
    searching: 'Looking for available drivers',
    driver_interested: 'Driver interested',
    negotiating: 'Fare negotiation',
    accepted: 'Accepted',
    rejected: 'Declined',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };

  return labels[status];
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  statusText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statusNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  requestId: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});

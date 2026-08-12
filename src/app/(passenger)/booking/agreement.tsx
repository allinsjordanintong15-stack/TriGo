import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import {
  BookingServiceError,
  subscribeToOutOfAreaRequest,
} from '@/services/bookingService';
import {
  acceptProposal,
  declineProposal,
  summarizeFareProposal,
} from '@/services/fareAgreementService';
import { OutOfAreaRequest } from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FareAgreementScreen() {
  const insets = useSafeAreaInsets();
  const { tripQuote, activeOutOfAreaRequestId } = useBookingDraft();
  const [request, setRequest] = useState<OutOfAreaRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeOutOfAreaRequestId) return;

    const unsubscribe = subscribeToOutOfAreaRequest(
      activeOutOfAreaRequestId,
      setRequest,
      (err) => {
        setError(
          err instanceof BookingServiceError
            ? err.message
            : 'Unable to load fare agreement.',
        );
      },
    );

    return unsubscribe;
  }, [activeOutOfAreaRequestId]);

  const agreement = request?.fareAgreement;

  const summary =
    agreement &&
    summarizeFareProposal(agreement.standardEstimatedFare, agreement.driverProposedFare);

  async function handleAccept() {
    if (!activeOutOfAreaRequestId || !agreement) return;

    setLoading(true);
    setError('');

    try {
      await acceptProposal(activeOutOfAreaRequestId, agreement);
      router.replace('/(passenger)/booking/confirmation' as Href);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to accept the fare. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    if (!activeOutOfAreaRequestId) return;

    setLoading(true);
    setError('');

    try {
      await declineProposal(activeOutOfAreaRequestId);
      router.replace('/(passenger)/booking/out-of-area-search' as Href);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to decline the fare. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!tripQuote || !request || !agreement || !summary) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading fare agreement…</Text>
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
      <Text style={styles.title}>Out-of-Area Trip Agreement</Text>
      <Text style={styles.subtitle}>
        This is an out-of-area trip. Review the fare details below before confirming.
      </Text>

      <ErrorBanner message={error} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Information</Text>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{tripQuote.pickupLocation.address}</Text>
        <Text style={styles.label}>Destination</Text>
        <Text style={styles.value}>{tripQuote.destination.address}</Text>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>
          {tripQuote.vehicleType.charAt(0).toUpperCase() + tripQuote.vehicleType.slice(1)}
        </Text>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.value}>{tripQuote.distanceKm.toFixed(2)} km</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fare Information</Text>
        <Text style={styles.label}>Standard Estimated Fare</Text>
        <Text style={styles.value}>{formatPhilippinePeso(summary.standardEstimatedFare)}</Text>
        <Text style={styles.label}>Driver Proposed Fare</Text>
        <Text style={styles.fareHighlight}>
          {formatPhilippinePeso(summary.driverProposedFare)}
        </Text>
        <Text style={styles.label}>Additional Amount</Text>
        <Text style={styles.value}>{formatPhilippinePeso(summary.additionalAmount)}</Text>
        <Text style={styles.label}>Additional Percentage</Text>
        <Text style={styles.value}>{summary.additionalPercentage}%</Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          This is an out-of-area trip. The final fare has been proposed by the driver and must
          be accepted by you before the booking can proceed.
        </Text>
      </View>

      <Button title="Accept Fare" loading={loading} onPress={handleAccept} />
      <View style={styles.spacer} />
      <Button title="Decline" variant="secondary" loading={loading} onPress={handleDecline} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  fareHighlight: {
    ...typography.title,
    fontSize: 22,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: {
    ...typography.caption,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  spacer: { height: spacing.sm },
});

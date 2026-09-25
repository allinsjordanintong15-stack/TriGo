import { BookingStatusCard } from '@/components/booking/BookingStatusCard';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import {
  BookingServiceError,
  cancelBooking,
  subscribeToBooking,
} from '@/services/bookingService';
import { getDriverRecord } from '@/services/driverService';
import { Booking, DriverRecord } from '@/types';
import { canPassengerCancelBooking } from '@/utils/booking';
import { isActiveBookingStatus } from '@/utils/bookingStatus';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BookingStatusScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = useAuth();
  const { activeBookingId, setActiveBookingId } = useBookingDraft();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId ?? activeBookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [assignedDriverRecord, setAssignedDriverRecord] = useState<DriverRecord | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    setActiveBookingId(bookingId);

    const unsubscribe = subscribeToBooking(
      bookingId,
      (updatedBooking) => {
        setBooking(updatedBooking);
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(
          err instanceof BookingServiceError
            ? err.message
            : 'Unable to load booking status. Please try again.',
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [bookingId, setActiveBookingId]);

  // Once a driver accepts, show who they are (name, vehicle, plate) from drivers/{uid}.
  const assignedDriverId = booking?.driverId ?? null;
  useEffect(() => {
    if (!assignedDriverId) {
      setAssignedDriverRecord(null);
      return;
    }

    let active = true;
    getDriverRecord(assignedDriverId)
      .then((record) => {
        if (active) setAssignedDriverRecord(record);
      })
      .catch(() => {
        // Driver details are optional; the status still shows "Driver Found".
      });

    return () => {
      active = false;
    };
  }, [assignedDriverId]);

  function confirmCancel() {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: handleCancel },
      ],
    );
  }

  async function handleCancel() {
    if (!bookingId || !passenger || !booking) return;

    setCancelling(true);
    setError('');

    try {
      await cancelBooking(bookingId, passenger.uid);
    } catch (err) {
      setError(
        err instanceof BookingServiceError
          ? err.message
          : 'Unable to cancel booking. Please try again.',
      );
    } finally {
      setCancelling(false);
    }
  }

  if (!bookingId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No active booking.</Text>
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  if (loading && !booking) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading booking status…</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ErrorBanner message={error || 'Booking not found.'} />
        <Button title="Back to Home" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const assignedDriver =
    assignedDriverRecord && assignedDriverRecord.driverId === booking.driverId
      ? assignedDriverRecord
      : null;
  const canCancel = canPassengerCancelBooking(booking);
  const isActive = isActiveBookingStatus(booking.status);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={styles.title}>Booking Status</Text>
      <Text style={styles.subtitle}>
        {isActive
          ? 'Your booking updates in real time.'
          : 'This booking is no longer active.'}
      </Text>

      <ErrorBanner message={error} />

      <BookingStatusCard
        booking={booking}
        loading={isActive && booking.status === 'pending'}
        driver={assignedDriver}
      />

      {canCancel ? (
        <Button
          title="Cancel Ride"
          variant="secondary"
          loading={cancelling}
          onPress={confirmCancel}
        />
      ) : null}

      {!isActive ? (
        <>
          <View style={styles.spacer} />
          <Button
            title="Back to Home"
            onPress={() => {
              setActiveBookingId(null);
              router.dismissTo('/home');
            }}
          />
        </>
      ) : null}
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
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
  spacer: { height: spacing.sm },
});

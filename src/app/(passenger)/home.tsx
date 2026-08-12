import { OutOfAreaNotice } from '@/components/booking/OutOfAreaNotice';
import { HomeHeader } from '@/components/home/HomeHeader';
import { LocationInput } from '@/components/home/LocationInput';
import { VehicleSelector } from '@/components/home/VehicleSelector';
import { BookingMap } from '@/components/map/BookingMap';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TRINIDAD_BOHOL_REGION } from '@/constants/map';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraft } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import {
  BookingServiceError,
  buildTripQuote,
  createOutOfAreaRequest,
} from '@/services/bookingService';
import {
  getCurrentLocation,
  LocationServiceError,
  resolveLocation,
  toMapRegion,
} from '@/services/locationService';
import { isLocationWithinServiceArea } from '@/services/serviceAreaService';
import { Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PassengerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.max(Math.round(windowHeight * 0.38), 260);
  const { passenger } = useAuth();

  const {
    pickupLocation,
    destination,
    vehicleType,
    selectionMode,
    setPickupLocation,
    setDestination,
    setVehicleType,
    setTripQuote,
    setActiveOutOfAreaRequestId,
    setSelectionMode,
  } = useBookingDraft();

  const [mapRegion, setMapRegion] = useState<Region>({ ...TRINIDAD_BOHOL_REGION });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [resolvingMapTap, setResolvingMapTap] = useState(false);
  const [formError, setFormError] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [showOutOfAreaNotice, setShowOutOfAreaNotice] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<ReturnType<typeof buildTripQuote> | null>(
    null,
  );
  const [creatingRequest, setCreatingRequest] = useState(false);
  const hasInitializedLocation = useRef(false);

  const destinationIsOutOfArea =
    destination !== null && !isLocationWithinServiceArea(destination);

  useEffect(() => {
    if (hasInitializedLocation.current) return;
    hasInitializedLocation.current = true;

    async function initializeMap() {
      try {
        const current = await getCurrentLocation();
        setMapRegion(toMapRegion(current));
        setPickupLocation(current);
      } catch {
        // Default Trinidad viewport when GPS is unavailable.
      } finally {
        setInitializing(false);
      }
    }

    initializeMap();
  }, [setPickupLocation]);

  async function handleUseCurrentLocation() {
    setFormError('');
    setLoadingLocation(true);

    try {
      const current = await getCurrentLocation();
      setPickupLocation(current);
      setMapRegion(toMapRegion(current));
      setSelectionMode(null);
    } catch (error) {
      setFormError(
        error instanceof LocationServiceError
          ? error.message
          : 'Unable to get your current location. Please try again.',
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  async function handleMapPress(latitude: number, longitude: number) {
    if (!selectionMode) {
      setFormError('Tap Pickup or Destination below, then tap the map.');
      return;
    }

    setFormError('');
    setResolvingMapTap(true);

    try {
      const location = await resolveLocation(latitude, longitude);

      if (selectionMode === 'pickup') {
        setPickupLocation(location);
      } else {
        setDestination(location);
      }

      setMapRegion(toMapRegion(location));
      setSelectionMode(null);
    } catch {
      setFormError('Unable to set that location. Please try again.');
    } finally {
      setResolvingMapTap(false);
    }
  }

  function validateBookingInputs() {
    if (!pickupLocation) {
      setFormError('Please select a pickup location.');
      setSelectionMode('pickup');
      return null;
    }

    if (!destination) {
      setFormError('Please select a destination.');
      setSelectionMode('destination');
      return null;
    }

    if (!vehicleType) {
      setFormError('Please select a vehicle type before booking.');
      return null;
    }

    return buildTripQuote(pickupLocation, destination, vehicleType);
  }

  function handleBookRide() {
    setFormError('');
    const quote = validateBookingInputs();
    if (!quote) return;

    setTripQuote(quote);

    if (quote.isOutOfArea) {
      setPendingQuote(quote);
      setShowOutOfAreaNotice(true);
      return;
    }

    router.push('/(passenger)/booking/confirmation' as Href);
  }

  async function handleFindAvailableDrivers() {
    if (!pendingQuote || !passenger) return;

    setCreatingRequest(true);
    setFormError('');

    try {
      const request = await createOutOfAreaRequest(passenger.uid, pendingQuote);
      setActiveOutOfAreaRequestId(request.requestId);
      setShowOutOfAreaNotice(false);
      router.push('/(passenger)/booking/out-of-area-search' as Href);
    } catch (error) {
      setFormError(
        error instanceof BookingServiceError
          ? error.message
          : 'Unable to create your out-of-area request. Please try again.',
      );
    } finally {
      setCreatingRequest(false);
    }
  }

  function handleChangeDestination() {
    setShowOutOfAreaNotice(false);
    setPendingQuote(null);
    setSelectionMode('destination');
    setFormError('Select a new destination on the map.');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.mapSection, { height: mapHeight }]}>
        {initializing ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mapLoadingText}>Loading map for Trinidad, Bohol…</Text>
          </View>
        ) : (
          <BookingMap
            region={mapRegion}
            pickupLocation={pickupLocation}
            destination={destination}
            selectionMode={selectionMode}
            loading={resolvingMapTap}
            onMapPress={handleMapPress}
          />
        )}

        <Pressable
          style={styles.currentLocationButton}
          onPress={handleUseCurrentLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.currentLocationText}>📍 Current Location</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.panel}>
        <ScrollView
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <HomeHeader />

          <Text style={styles.heading}>Where are you going?</Text>
          <Text style={styles.serviceAreaNote}>
            Primary service area: Trinidad, Bohol. You can still view and select destinations
            across the province.
          </Text>

          <ErrorBanner message={formError} />

          <LocationInput
            label="Pickup"
            value={pickupLocation?.address ?? ''}
            placeholder="Tap here, then tap the map"
            active={selectionMode === 'pickup'}
            onPress={() => {
              setFormError('');
              setSelectionMode('pickup');
            }}
          />

          <LocationInput
            label="Destination"
            value={destination?.address ?? ''}
            placeholder="Tap here, then tap the map"
            active={selectionMode === 'destination'}
            onPress={() => {
              setFormError('');
              setSelectionMode('destination');
            }}
          />

          {destinationIsOutOfArea ? (
            <Text style={styles.outOfAreaHint}>
              This destination is outside the standard TriGo service area. You can request an
              out-of-area trip from available drivers.
            </Text>
          ) : null}

          {selectionMode ? (
            <Text style={styles.selectionHint}>
              Tap anywhere on the map to set your{' '}
              {selectionMode === 'pickup' ? 'pickup' : 'destination'}.
            </Text>
          ) : null}

          <VehicleSelector selected={vehicleType} onSelect={setVehicleType} />

          <Button
            title={destinationIsOutOfArea ? 'Request Out-of-Area Ride' : 'Book a Ride'}
            onPress={handleBookRide}
          />
        </ScrollView>
      </View>

      <OutOfAreaNotice
        visible={showOutOfAreaNotice}
        destinationAddress={pendingQuote?.destination.address ?? destination?.address ?? ''}
        onFindDrivers={handleFindAvailableDrivers}
        onChangeDestination={handleChangeDestination}
        loading={creatingRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapSection: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 1,
  },
  mapLoading: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  currentLocationButton: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    elevation: 4,
    minWidth: 140,
    alignItems: 'center',
    zIndex: 4,
  },
  currentLocationText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 2,
  },
  panelContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  serviceAreaNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  outOfAreaHint: {
    ...typography.caption,
    color: '#B45309',
    backgroundColor: '#FFF7ED',
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  selectionHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
});

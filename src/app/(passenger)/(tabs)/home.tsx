import { Ionicons } from '@expo/vector-icons';
import { OutOfAreaNotice } from '@/components/booking/OutOfAreaNotice';
import { HomeHeader } from '@/components/home/HomeHeader';
import { LocationInput } from '@/components/home/LocationInput';
import { LocationSearch } from '@/components/home/LocationSearch';
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
  LocationSearchResult,
  LocationServiceError,
  resolveLocation,
  toMapRegion,
} from '@/services/locationService';
import {
  getServiceAreaLabel,
  getTripServiceAreaStatus,
  isLocationWithinServiceArea,
} from '@/services/serviceAreaService';
import { Location } from '@/types';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
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
  // The map fills everything down to the tab bar; the booking sheet floats over its
  // bottom part and never takes more than this share of the screen.
  const sheetMaxHeight = Math.round(windowHeight * 0.45);
  const { passenger } = useAuth();

  const {
    pickupLocation,
    destination,
    vehicleType,
    selectionMode,
    fareConfig,
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
  const [locationCardHeight, setLocationCardHeight] = useState(0);
  const [mapAreaHeight, setMapAreaHeight] = useState(0);
  // Screen positions used to keep search suggestions above the on-screen keyboard.
  const [mapAreaBottom, setMapAreaBottom] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const mapSectionRef = useRef<View>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [showOutOfAreaNotice, setShowOutOfAreaNotice] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<ReturnType<typeof buildTripQuote> | null>(
    null,
  );
  const [creatingRequest, setCreatingRequest] = useState(false);
  const hasInitializedLocation = useRef(false);
  // True once the passenger has a pickup they chose (map, search, "Current Location",
  // or one already in the booking draft). The background GPS prefill never replaces it.
  const pickupChosenByPassenger = useRef(pickupLocation !== null);

  const pickupIsOutOfArea = pickupLocation !== null && !isLocationWithinServiceArea(pickupLocation);
  const destinationIsOutOfArea =
    destination !== null && !isLocationWithinServiceArea(destination);
  const tripIsOutOfArea = pickupIsOutOfArea || destinationIsOutOfArea;
  const pendingAreaStatus = pendingQuote
    ? getTripServiceAreaStatus(pendingQuote.pickupLocation, pendingQuote.destination)
    : null;

  useEffect(() => {
    if (hasInitializedLocation.current) return;
    hasInitializedLocation.current = true;

    // Prefill pickup from GPS but keep the map focused on Trinidad, Bohol — the map
    // only moves to the passenger when they tap "Current Location".
    getCurrentLocation()
      .then((current) => {
        if (!pickupChosenByPassenger.current) {
          setPickupLocation(current);
        }
      })
      .catch(() => {
        // GPS unavailable: the passenger sets the pickup via search or the map.
      });
  }, [setPickupLocation]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardTop(null));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Part of the map area covered by the keyboard (0 when the window resizes for it).
  const keyboardOverlap = keyboardTop === null ? 0 : Math.max(mapAreaBottom - keyboardTop, 0);
  // Room for suggestions between the pickup/destination fields and the keyboard or map
  // bottom (the booking sheet is hidden while a location is being chosen).
  const searchResultsMaxHeight = Math.max(
    mapAreaHeight - keyboardOverlap - locationCardHeight - spacing.xl * 3,
    120,
  );

  // Messages and the Book button live in the sheet, so reopen it when there is an error.
  useEffect(() => {
    if (formError) setSheetCollapsed(false);
  }, [formError]);

  async function handleUseCurrentLocation() {
    setFormError('');
    setLoadingLocation(true);

    try {
      const current = await getCurrentLocation();
      pickupChosenByPassenger.current = true;
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
      setFormError('Tap Pickup or Destination at the top, then tap the map.');
      return;
    }

    setFormError('');
    setResolvingMapTap(true);

    try {
      applySelectedLocation(selectionMode, await resolveLocation(latitude, longitude));
    } catch {
      setFormError('Unable to set that location. Please try again.');
    } finally {
      setResolvingMapTap(false);
    }
  }

  // Sets only the field being chosen, so picking a destination never touches the pickup.
  function applySelectedLocation(target: 'pickup' | 'destination', location: Location) {
    if (target === 'pickup') {
      pickupChosenByPassenger.current = true;
      setPickupLocation(location);
    } else {
      setDestination(location);
    }

    Keyboard.dismiss();
    setMapRegion(toMapRegion(location));
    setSelectionMode(null);
  }

  function handleSearchSelect(
    target: 'pickup' | 'destination',
    { latitude, longitude, address }: LocationSearchResult,
  ) {
    setFormError('');
    applySelectedLocation(target, { latitude, longitude, address });
  }

  function openLocationField(target: 'pickup' | 'destination') {
    setFormError('');
    setSelectionMode(target);
  }

  function closeLocationField() {
    Keyboard.dismiss();
    setSelectionMode(null);
    setFormError('');
  }

  // Clears the destination (pickup stays) and opens the field for a new one.
  function handleClearDestination() {
    setDestination(null);
    openLocationField('destination');
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

    return buildTripQuote(pickupLocation, destination, vehicleType, fareConfig.fares);
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

    router.push('/(passenger)/booking/confirmation');
  }

  async function handleFindAvailableDrivers() {
    if (!pendingQuote || !passenger) return;

    setCreatingRequest(true);
    setFormError('');

    try {
      const request = await createOutOfAreaRequest(
        passenger.uid,
        pendingQuote,
        fareConfig.outOfArea,
      );
      setActiveOutOfAreaRequestId(request.requestId);
      setShowOutOfAreaNotice(false);
      router.push('/(passenger)/booking/out-of-area-search');
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

  function handleChangeLocation() {
    const target = pendingAreaStatus?.destinationOutside === false ? 'pickup' : 'destination';
    setShowOutOfAreaNotice(false);
    setPendingQuote(null);
    setSelectionMode(target);
    setFormError(`Search or tap the map to choose a new ${target}.`);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View
        ref={mapSectionRef}
        style={styles.mapSection}
        onLayout={(event) => {
          setMapAreaHeight(event.nativeEvent.layout.height);
          mapSectionRef.current?.measureInWindow((_x, y, _width, height) =>
            setMapAreaBottom(y + height),
          );
        }}
      >
        <BookingMap
          region={mapRegion}
          pickupLocation={pickupLocation}
          destination={destination}
          selectionMode={selectionMode}
          loading={resolvingMapTap}
          onMapPress={handleMapPress}
          edgeToEdge
          topOverlayHeight={locationCardHeight}
          bottomOverlayHeight={sheetHeight}
          // The active field in the floating card already says "Tap map".
          showSelectionBanner={false}
        />

        {/* Pickup and destination float over the top of the map. The row being chosen
            turns into a search field, with suggestions right below it. */}
        <View style={styles.locationCard}>
          {/* Only the fields' resting height is kept clear when fitting the route, so
              opening the search and its suggestions does not move the map. */}
          <View
            onLayout={(event) => {
              if (!selectionMode) setLocationCardHeight(event.nativeEvent.layout.height);
            }}
          >
            {selectionMode === 'pickup' ? (
              <LocationSearch
                target="pickup"
                label="Pickup"
                placeholder="Search pickup location"
                resultsMaxHeight={searchResultsMaxHeight}
                onSelect={(result) => handleSearchSelect('pickup', result)}
              />
            ) : (
              <LocationInput
                compact
                label="Pickup"
                value={pickupLocation?.address ?? ''}
                placeholder="Search or tap the map for pickup"
                active={false}
                onPress={() => openLocationField('pickup')}
              />
            )}
            {selectionMode === 'destination' ? (
              <LocationSearch
                target="destination"
                label="Destination"
                placeholder="Where do you want to go?"
                resultsMaxHeight={searchResultsMaxHeight}
                onSelect={(result) => handleSearchSelect('destination', result)}
              />
            ) : (
              <LocationInput
                compact
                label="Destination"
                value={destination?.address ?? ''}
                placeholder="Where do you want to go?"
                active={false}
                onPress={() => openLocationField('destination')}
                onClear={handleClearDestination}
              />
            )}
          </View>

          {selectionMode ? (
            <View style={styles.cardSearch}>
              {/* The booking sheet is hidden while choosing, so show messages here. */}
              <ErrorBanner message={formError} />
              <View style={styles.cardSearchFooter}>
                <Text style={styles.selectionHint}>
                  Type to search, or tap the map to set your{' '}
                  {selectionMode === 'pickup' ? 'pickup' : 'destination'}.
                </Text>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={closeLocationField}>
                  <Text style={styles.cancelSelection}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Floats over the map, just above the booking sheet. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location as pickup"
          style={({ pressed }) => [
            styles.currentLocationButton,
            { bottom: (selectionMode ? 0 : sheetHeight) + spacing.md },
            pressed ? styles.currentLocationButtonPressed : null,
          ]}
          onPress={handleUseCurrentLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate" size={22} color={colors.primary} />
          )}
        </Pressable>

        {/* Booking sheet over the bottom of the map; its content scrolls, and the
            handle collapses it to show the full map. Hidden while a pickup or
            destination is being chosen so the keyboard cannot push it over the
            suggestions. */}
        {!selectionMode ? (
          <View
            style={[styles.sheet, { maxHeight: sheetMaxHeight }]}
            onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sheetCollapsed ? 'Show booking options' : 'Hide booking options'}
              accessibilityState={{ expanded: !sheetCollapsed }}
              style={styles.sheetHandleArea}
              onPress={() => setSheetCollapsed((collapsed) => !collapsed)}
              hitSlop={8}
            >
              <View style={styles.sheetHandle} />
              {sheetCollapsed ? (
                <View style={styles.sheetCollapsedRow}>
                  <Text style={styles.sheetCollapsedText}>Where are you going?</Text>
                  <Ionicons name="chevron-up" size={18} color={colors.primary} />
                </View>
              ) : null}
            </Pressable>

            {!sheetCollapsed ? (
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.panelContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <HomeHeader />

                <Text style={styles.heading}>Where are you going?</Text>
                <Text style={styles.serviceAreaNote}>
                  Service area: {getServiceAreaLabel()}. Trips to or from other places can be sent as
                  out-of-area requests.
                </Text>

                <ErrorBanner message={formError} />

                {tripIsOutOfArea ? (
                  <View style={styles.outOfAreaHint}>
                    <Text style={styles.outOfAreaHintTitle}>Out-of-Area Trip</Text>
                    <Text style={styles.outOfAreaHintText}>
                      Your{' '}
                      {pickupIsOutOfArea && destinationIsOutOfArea
                        ? 'pickup and destination are'
                        : pickupIsOutOfArea
                          ? 'pickup is'
                          : 'destination is'}{' '}
                      outside {getServiceAreaLabel()}. You can still submit it as an out-of-area trip
                      request for a driver to review.
                    </Text>
                  </View>
                ) : null}

                <VehicleSelector selected={vehicleType} onSelect={setVehicleType} />

                <Button
                  title={tripIsOutOfArea ? 'Request Out-of-Area Ride' : 'Book a Ride'}
                  onPress={handleBookRide}
                />
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>

      <OutOfAreaNotice
        visible={showOutOfAreaNotice}
        pickupAddress={pendingQuote?.pickupLocation.address ?? ''}
        destinationAddress={pendingQuote?.destination.address ?? ''}
        pickupOutside={pendingAreaStatus?.pickupOutside ?? false}
        destinationOutside={pendingAreaStatus?.destinationOutside ?? false}
        onContinue={handleFindAvailableDrivers}
        onChangeLocation={handleChangeLocation}
        loading={creatingRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Fills everything between the status bar and the tab bar.
  mapSection: {
    flex: 1,
    width: '100%',
  },
  locationCard: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    zIndex: 5,
    // Floating shadow (elevation on Android, shadow* on iOS).
    elevation: 8,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  currentLocationButton: {
    position: 'absolute',
    right: spacing.md,
    // `bottom` is set inline to sit just above the booking sheet.
    // Small round icon button (44 pt keeps a comfortable touch target).
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    zIndex: 4,
    // Floating shadow (elevation on Android, shadow* on iOS).
    elevation: 6,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  currentLocationButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 6,
    // Floating shadow (elevation on Android, shadow* on iOS).
    elevation: 12,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  sheetCollapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetCollapsedText: {
    ...typography.label,
    color: colors.primary,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  panelContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  outOfAreaHintTitle: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
    marginBottom: 2,
  },
  outOfAreaHintText: {
    ...typography.caption,
    color: colors.primary,
    lineHeight: 18,
  },
  selectionHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardSearch: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  cardSearchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  cancelSelection: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});

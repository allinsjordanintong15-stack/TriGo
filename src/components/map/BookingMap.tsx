import { TRINIDAD_BOHOL_REGION } from '@/constants/map';
import { colors, spacing, typography } from '@/constants/theme';
import { LocationSelectionMode } from '@/contexts/BookingDraftContext';
import { getServiceAreaBoundaryCoordinates } from '@/services/serviceAreaService';
import { Location } from '@/types';
import { logMapDiagnostics } from '@/utils/mapConfig';
import { useEffect, useRef, useState } from 'react';
import { Platform, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';

// Outline only: the service area is the default focus, not a limit on panning or selection.
const SERVICE_AREA_BOUNDARY = getServiceAreaBoundaryCoordinates();

interface BookingMapProps {
  region: Region;
  pickupLocation: Location | null;
  destination: Location | null;
  selectionMode: LocationSelectionMode;
  loading?: boolean;
  onMapPress: (latitude: number, longitude: number) => void;
  /** Height of UI floating over the top of the map, kept clear when fitting the route. */
  topOverlayHeight?: number;
  /** Height of UI floating over the bottom of the map (e.g. a bottom sheet). */
  bottomOverlayHeight?: number;
  /** Show the "Tap the map to set …" banner at the top of the map. */
  showSelectionBanner?: boolean;
  /** Fill the area edge to edge without rounded corners. */
  edgeToEdge?: boolean;
}

export function BookingMap({
  region,
  pickupLocation,
  destination,
  selectionMode,
  loading = false,
  onMapPress,
  topOverlayHeight = 0,
  bottomOverlayHeight = 0,
  showSelectionBanner = true,
  edgeToEdge = false,
}: BookingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    mapRef.current.animateToRegion(region, 500);
    // Re-centre once the overlays have been measured so the view settles between them.
  }, [mapReady, region.latitude, region.longitude, topOverlayHeight > 0, bottomOverlayHeight > 0]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const coordinates = [pickupLocation, destination].filter(Boolean) as Location[];

    if (coordinates.length < 2) {
      return;
    }

    mapRef.current.fitToCoordinates(
      coordinates.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
      {
        // mapPadding already keeps the floating overlay clear; this is extra breathing room.
        edgePadding: { top: 60, right: 40, bottom: 80, left: 40 },
        animated: true,
      },
    );
  }, [mapReady, pickupLocation, destination, topOverlayHeight, bottomOverlayHeight]);

  function handleMapReady() {
    setMapReady(true);
    mapRef.current?.animateToRegion(region, 0);
    logMapDiagnostics();
  }

  return (
    <View style={[styles.container, edgeToEdge ? styles.containerEdgeToEdge : null]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        // The LATEST Google renderer draws a black map on some Android devices.
        googleRenderer="LEGACY"
        mapType="standard"
        initialRegion={TRINIDAD_BOHOL_REGION}
        // Pull the map's centre and framing down below UI floating over its top edge,
        // so Trinidad and the pickup/destination markers are not hidden behind it.
        mapPadding={{
          top: topOverlayHeight > 0 ? topOverlayHeight + spacing.sm : 0,
          right: 0,
          bottom: bottomOverlayHeight,
          left: 0,
        }}
        onMapReady={handleMapReady}
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onMapPress(latitude, longitude);
        }}
        onLongPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onMapPress(latitude, longitude);
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        loadingBackgroundColor={colors.surface}
      >
        <Polygon
          coordinates={SERVICE_AREA_BOUNDARY}
          strokeColor={colors.primary}
          strokeWidth={1.5}
          fillColor="rgba(27,94,58,0.06)"
          tappable={false}
        />

        {pickupLocation && destination ? (
          <Polyline
            coordinates={[
              {
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              },
              {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        ) : null}

        {pickupLocation ? (
          <Marker
            coordinate={{
              latitude: pickupLocation.latitude,
              longitude: pickupLocation.longitude,
            }}
            title="Pickup"
            description={pickupLocation.address}
            pinColor={colors.primary}
          />
        ) : null}

        {destination ? (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}
            pinColor={colors.accent}
          />
        ) : null}
      </MapView>

      {selectionMode && showSelectionBanner ? (
        <View style={styles.selectionBanner} pointerEvents="none">
          <Text style={styles.selectionBannerText}>
            Tap the map to set {selectionMode === 'pickup' ? 'pickup' : 'destination'}
          </Text>
        </View>
      ) : null}

      {!mapReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Getting address…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'ios'
      ? { borderRadius: 16, overflow: 'hidden' }
      : { borderRadius: 16 }),
  },
  containerEdgeToEdge: {
    borderRadius: 0,
  },
  map: {
    ...Platform.select({
      android: {
        flex: 1,
      },
      default: {
        flex: 1,
      },
    }),
  },
  selectionBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 2,
  },
  selectionBannerText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

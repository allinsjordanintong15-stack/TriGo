import { MAP_STYLE_URL, MapRegion, TRINIDAD_BOHOL_REGION, zoomForRegion } from '@/constants/map';
import { colors, spacing, typography } from '@/constants/theme';
import { LocationSelectionMode } from '@/contexts/BookingDraftContext';
import { getServiceAreaBoundaryCoordinates } from '@/services/serviceAreaService';
import { Location } from '@/types';
import {
  Camera,
  CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Outline only: the service area is the default focus, not a limit on panning or selection.
// GeoJSON rings are [longitude, latitude] and must be closed (first point repeated last).
const SERVICE_AREA_RING = (() => {
  const ring = getServiceAreaBoundaryCoordinates().map(
    ({ latitude, longitude }) => [longitude, latitude] as [number, number],
  );
  return [...ring, ring[0]];
})();

/** Room around the fitted route; the top also clears the pins, which stand above their point. */
const ROUTE_FIT_PADDING = { top: 60, right: 40, bottom: 80, left: 40 };
const PREVIEW_FIT_PADDING = { top: 48, right: 32, bottom: 20, left: 32 };

const SERVICE_AREA_SHAPE: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [SERVICE_AREA_RING] },
};

interface BookingMapProps {
  region: MapRegion;
  pickupLocation: Location | null;
  destination: Location | null;
  selectionMode: LocationSelectionMode;
  loading?: boolean;
  /** Called on tap and long-press; not needed when the map is not interactive. */
  onMapPress?: (latitude: number, longitude: number) => void;
  /** Height of UI floating over the top of the map, kept clear when fitting the route. */
  topOverlayHeight?: number;
  /** Height of UI floating over the bottom of the map (e.g. a bottom sheet). */
  bottomOverlayHeight?: number;
  /** Show the "Tap the map to set …" banner at the top of the map. */
  showSelectionBanner?: boolean;
  /** Fill the area edge to edge without rounded corners. */
  edgeToEdge?: boolean;
  /** Road path as [longitude, latitude] pairs; without it a direct line is drawn. */
  routeCoordinates?: [number, number][] | null;
  /** Show a notice that the road route could not be loaded and the line is direct. */
  routeUnavailable?: boolean;
  /** When false, the map is a static preview: no panning, zooming, rotating, or taps. */
  interactive?: boolean;
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
  routeCoordinates = null,
  routeUnavailable = false,
  interactive = true,
}: BookingMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  // Pull the map's centre and framing down below UI floating over its top edge,
  // so Trinidad and the pickup/destination markers are not hidden behind it.
  const contentInset = useMemo(
    () => ({
      top: topOverlayHeight > 0 ? topOverlayHeight + spacing.sm : 0,
      right: 0,
      bottom: bottomOverlayHeight,
      left: 0,
    }),
    [topOverlayHeight, bottomOverlayHeight],
  );

  const routeShape = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!pickupLocation || !destination) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates ?? [
          [pickupLocation.longitude, pickupLocation.latitude],
          [destination.longitude, destination.latitude],
        ],
      },
    };
  }, [pickupLocation, destination, routeCoordinates]);

  useEffect(() => {
    // A preview only ever frames its route; moving to the region would fight that fit.
    if (!mapReady || !cameraRef.current || !interactive) {
      return;
    }

    cameraRef.current.easeTo({
      center: [region.longitude, region.latitude],
      zoom: zoomForRegion(region),
      duration: 500,
    });
    // Re-centre once the overlays have been measured so the view settles between them.
  }, [
    mapReady,
    interactive,
    region.latitude,
    region.longitude,
    topOverlayHeight > 0,
    bottomOverlayHeight > 0,
  ]);

  useEffect(() => {
    if (!mapReady || !cameraRef.current || !pickupLocation || !destination) {
      return;
    }
    // Fitting before layout uses the wrong viewport size, leaving the route off-screen.
    if (mapSize.width === 0 || mapSize.height === 0) {
      return;
    }

    // Frame the whole road path when there is one, since it can bulge past the endpoints.
    const points: [number, number][] = [
      [pickupLocation.longitude, pickupLocation.latitude],
      [destination.longitude, destination.latitude],
      ...(routeCoordinates ?? []),
    ];
    const longitudes = points.map(([longitude]) => longitude);
    const latitudes = points.map(([, latitude]) => latitude);

    cameraRef.current.fitBounds(
      [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
      ],
      {
        // contentInset already keeps the floating overlay clear; this is extra breathing room.
        padding: interactive ? ROUTE_FIT_PADDING : PREVIEW_FIT_PADDING,
        duration: interactive ? 500 : 0,
      },
    );
  }, [
    mapReady,
    pickupLocation,
    destination,
    routeCoordinates,
    topOverlayHeight,
    bottomOverlayHeight,
    interactive,
    mapSize.width,
    mapSize.height,
  ]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setMapSize((size) =>
      size.width === width && size.height === height ? size : { width, height },
    );
  }

  function handleMapReady() {
    setMapReady(true);
    setMapFailed(false);
  }

  function handlePress(longitude: number, latitude: number) {
    if (interactive) {
      onMapPress?.(latitude, longitude);
    }
  }

  return (
    <View
      style={[styles.container, edgeToEdge ? styles.containerEdgeToEdge : null]}
      onLayout={handleLayout}
    >
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        contentInset={contentInset}
        onDidFinishLoadingMap={handleMapReady}
        onDidFailLoadingMap={() => setMapFailed(true)}
        onPress={(event) => handlePress(...event.nativeEvent.lngLat)}
        onLongPress={(event) => handlePress(...event.nativeEvent.lngLat)}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
        compass={false}
        logo={false}
        attributionPosition={{ bottom: bottomOverlayHeight + spacing.xs, right: spacing.xs }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [TRINIDAD_BOHOL_REGION.longitude, TRINIDAD_BOHOL_REGION.latitude],
            zoom: zoomForRegion(TRINIDAD_BOHOL_REGION),
          }}
        />

        <NativeUserLocation />

        <GeoJSONSource id="service-area" data={SERVICE_AREA_SHAPE}>
          <Layer
            id="service-area-fill"
            type="fill"
            paint={{ 'fill-color': colors.primary, 'fill-opacity': 0.06 }}
          />
          <Layer
            id="service-area-outline"
            type="line"
            paint={{ 'line-color': colors.primary, 'line-width': 1.5 }}
          />
        </GeoJSONSource>

        {routeShape ? (
          <GeoJSONSource id="route" data={routeShape}>
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': colors.primary, 'line-width': 3 }}
              layout={{ 'line-cap': 'round' }}
            />
          </GeoJSONSource>
        ) : null}

        {pickupLocation ? (
          <Marker
            id="pickup"
            lngLat={[pickupLocation.longitude, pickupLocation.latitude]}
            anchor="bottom"
          >
            <MapPin color={colors.primary} />
          </Marker>
        ) : null}

        {destination ? (
          <Marker
            id="destination"
            lngLat={[destination.longitude, destination.latitude]}
            anchor="bottom"
          >
            <MapPin color={colors.accent} />
          </Marker>
        ) : null}
      </Map>

      {selectionMode && showSelectionBanner ? (
        <View style={styles.selectionBanner} pointerEvents="none">
          <Text style={styles.selectionBannerText}>
            Tap the map to set {selectionMode === 'pickup' ? 'pickup' : 'destination'}
          </Text>
        </View>
      ) : null}

      {routeShape && routeUnavailable ? (
        <View
          style={[styles.routeNotice, { bottom: bottomOverlayHeight + spacing.sm }]}
          pointerEvents="none"
        >
          <Text style={styles.routeNoticeText}>Road route unavailable — showing direct line</Text>
        </View>
      ) : null}

      {!mapReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          {mapFailed ? (
            <Text style={styles.loadingText}>
              The map could not load. Check your internet connection.
            </Text>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading map…</Text>
            </>
          )}
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

/** Teardrop-style pin: a coloured head on a short stem, anchored at the stem's tip. */
function MapPin({ color }: { color: string }) {
  return (
    <View style={styles.pin}>
      <View style={[styles.pinHead, { backgroundColor: color }]}>
        <View style={styles.pinDot} />
      </View>
      <View style={[styles.pinStem, { backgroundColor: color }]} />
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
    flex: 1,
  },
  pin: {
    alignItems: 'center',
  },
  pinHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  pinStem: {
    width: 3,
    height: 10,
    marginTop: -1,
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
  routeNotice: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    zIndex: 2,
  },
  routeNoticeText: {
    ...typography.caption,
    color: colors.white,
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
    padding: spacing.lg,
    zIndex: 3,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

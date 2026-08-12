import { MAP_DELTA, TRINIDAD_BOHOL_REGION } from '@/constants/map';
import { colors, spacing, typography } from '@/constants/theme';
import { LocationSelectionMode } from '@/contexts/BookingDraftContext';
import { Location } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { Platform, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';

interface BookingMapProps {
  region: Region;
  pickupLocation: Location | null;
  destination: Location | null;
  selectionMode: LocationSelectionMode;
  loading?: boolean;
  onMapPress: (latitude: number, longitude: number) => void;
}

export function BookingMap({
  region,
  pickupLocation,
  destination,
  selectionMode,
  loading = false,
  onMapPress,
}: BookingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    mapRef.current.animateToRegion(region, 500);
  }, [mapReady, region.latitude, region.longitude]);

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
        edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
        animated: true,
      },
    );
  }, [mapReady, pickupLocation, destination]);

  function handleMapReady() {
    setMapReady(true);
    mapRef.current?.animateToRegion(region, 0);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType="standard"
        initialRegion={{
          ...TRINIDAD_BOHOL_REGION,
          ...MAP_DELTA,
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
            pinColor="#D32F2F"
          />
        ) : null}
      </MapView>

      {selectionMode ? (
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

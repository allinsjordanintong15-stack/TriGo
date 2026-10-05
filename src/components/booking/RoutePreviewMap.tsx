import { BookingMap } from '@/components/map/BookingMap';
import { TRINIDAD_BOHOL_REGION } from '@/constants/map';
import { Location } from '@/types';
import { StyleSheet, View } from 'react-native';

interface RoutePreviewMapProps {
  pickup: Location;
  destination: Location;
  /** Road path as [longitude, latitude] pairs; without it a direct line is drawn. */
  routeCoordinates: [number, number][] | null;
  height?: number;
}

/** Small, non-interactive map that frames the trip's route between the two pins. */
export function RoutePreviewMap({
  pickup,
  destination,
  routeCoordinates,
  height = 180,
}: RoutePreviewMapProps) {
  return (
    <View style={[styles.container, { height }]}>
      <BookingMap
        region={TRINIDAD_BOHOL_REGION}
        pickupLocation={pickup}
        destination={destination}
        selectionMode={null}
        showSelectionBanner={false}
        routeCoordinates={routeCoordinates}
        interactive={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

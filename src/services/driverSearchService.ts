import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { COLLECTIONS, firestore } from '@/firebase';
import { AvailableDriver, Location, VehicleType } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';
import { collection, getDocs, query, where } from 'firebase/firestore';

export class DriverSearchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverSearchServiceError';
  }
}

interface DriverDocument {
  uid: string;
  fullName: string;
  profileImage: string | null;
  vehicleType: VehicleType;
  vehiclePlate: string;
  rating: number;
  isOnline: boolean;
  isVerified: boolean;
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Search for nearby available drivers for an out-of-area request.
 * Returns only online, verified, available drivers matching the vehicle type.
 * Driver-side registration will populate the `drivers` collection later.
 */
export async function findNearbyAvailableDrivers(
  pickupLocation: Location,
  vehicleType: VehicleType,
  searchRadiusKm: number = OUT_OF_AREA_FARE_SETTINGS.driverSearchRadiusKm,
): Promise<AvailableDriver[]> {
  try {
    const driversQuery = query(
      collection(firestore, COLLECTIONS.drivers),
      where('isOnline', '==', true),
      where('isVerified', '==', true),
      where('isAvailable', '==', true),
      where('vehicleType', '==', vehicleType),
    );

    const snapshot = await getDocs(driversQuery);
    const drivers: AvailableDriver[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DriverDocument;

      if (!data.currentLocation) {
        return;
      }

      const distanceToPickupKm = calculateDistanceKmFromCoords(
        pickupLocation.latitude,
        pickupLocation.longitude,
        data.currentLocation.latitude,
        data.currentLocation.longitude,
      );

      if (distanceToPickupKm > searchRadiusKm) {
        return;
      }

      drivers.push({
        driverId: docSnap.id,
        fullName: data.fullName,
        profileImage: data.profileImage ?? null,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        rating: data.rating ?? 0,
        distanceToPickupKm: Math.round(distanceToPickupKm * 100) / 100,
        isOnline: data.isOnline,
        isVerified: data.isVerified,
      });
    });

    return drivers.sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
  } catch {
    throw new DriverSearchServiceError(
      'Unable to search for available drivers. Please check your connection and try again.',
    );
  }
}

export function getDriverSearchStatusMessage(driverCount: number): string {
  if (driverCount === 0) {
    return 'Looking for available drivers near your pickup location…';
  }

  if (driverCount === 1) {
    return '1 available driver found near your pickup location.';
  }

  return `${driverCount} available drivers found near your pickup location.`;
}

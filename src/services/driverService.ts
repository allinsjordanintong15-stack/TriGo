import { COLLECTIONS, firestore } from '@/firebase';
import { docToOutOfAreaRequest } from '@/services/bookingService';
import { DriverRecord, OutOfAreaRequest, VehicleType } from '@/types';
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

export class DriverServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverServiceError';
  }
}

export function docToDriverRecord(driverId: string, data: DocumentData): DriverRecord {
  const location = data.currentLocation as { latitude?: unknown; longitude?: unknown } | undefined;

  return {
    driverId,
    fullName: data.fullName ?? '',
    profileImage: data.profileImage ?? null,
    vehicleType: data.vehicleType as VehicleType,
    vehiclePlate: data.vehiclePlate ?? '',
    rating: typeof data.rating === 'number' ? data.rating : 0,
    isOnline: data.isOnline === true,
    isVerified: data.isVerified === true,
    isAvailable: data.isAvailable === true,
    currentLocation:
      location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
  };
}

/**
 * Live subscription to the signed-in driver's own record. Emits `null` when no
 * `drivers/{uid}` document exists yet (driver account not set up by an admin).
 */
export function subscribeToDriverRecord(
  driverId: string,
  onUpdate: (record: DriverRecord | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(firestore, COLLECTIONS.drivers, driverId),
    (snapshot) => {
      const data = snapshot.data();
      onUpdate(snapshot.exists() && data ? docToDriverRecord(snapshot.id, data) : null);
    },
    (error) => onError(error),
  );
}

/**
 * Put a verified driver on duty. Records the current position because passenger
 * driver search only matches drivers that have a `currentLocation`.
 */
export async function goOnline(
  driverRecord: DriverRecord,
  location: { latitude: number; longitude: number },
  hasActiveTrip = false,
): Promise<void> {
  if (!driverRecord.isVerified) {
    throw new DriverServiceError(
      'Your account must be verified by a TriGo administrator before you can go online.',
    );
  }

  try {
    await updateDoc(doc(firestore, COLLECTIONS.drivers, driverRecord.driverId), {
      isOnline: true,
      // A driver with a trip in progress comes back online but stays unavailable.
      isAvailable: !hasActiveTrip,
      currentLocation: { latitude: location.latitude, longitude: location.longitude },
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new DriverServiceError(
      'Unable to go online. Please check your internet connection and try again.',
    );
  }
}

/** Take the driver off duty; they will no longer appear in passenger driver searches. */
export async function goOffline(driverId: string): Promise<void> {
  try {
    await updateDoc(doc(firestore, COLLECTIONS.drivers, driverId), {
      isOnline: false,
      isAvailable: false,
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new DriverServiceError(
      'Unable to go offline. Please check your internet connection and try again.',
    );
  }
}

/**
 * Make an online driver available for new requests again (e.g. after their trip
 * ended or the passenger cancelled). Only allowed while online and verified.
 */
export async function becomeAvailable(driverRecord: DriverRecord): Promise<void> {
  if (!driverRecord.isVerified || !driverRecord.isOnline) {
    throw new DriverServiceError('Go online first to become available for trips.');
  }

  try {
    await updateDoc(doc(firestore, COLLECTIONS.drivers, driverRecord.driverId), {
      isAvailable: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new DriverServiceError(
      'Unable to update your availability. Please check your internet connection and try again.',
    );
  }
}

/**
 * Read a driver's public record (name, vehicle, plate) — used by passengers to see
 * who was assigned. Passengers can read verified drivers only.
 */
export async function getDriverRecord(driverId: string): Promise<DriverRecord | null> {
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.drivers, driverId));
  const data = snapshot.data();
  return snapshot.exists() && data ? docToDriverRecord(snapshot.id, data) : null;
}

/** Out-of-area requests this driver is currently handling (fare proposed or accepted). */
export function subscribeToDriverActiveRequests(
  driverId: string,
  onUpdate: (requests: OutOfAreaRequest[]) => void,
  onError: (error: Error) => void,
): () => void {
  const activeQuery = query(
    collection(firestore, COLLECTIONS.outOfAreaRequests),
    where('driverId', '==', driverId),
    where('status', 'in', ['negotiating', 'accepted']),
  );

  return onSnapshot(
    activeQuery,
    (snapshot) => {
      onUpdate(
        snapshot.docs
          .map((d) => docToOutOfAreaRequest(d.id, d.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      );
    },
    (error) => onError(error),
  );
}

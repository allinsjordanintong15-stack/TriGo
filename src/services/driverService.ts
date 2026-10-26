import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLLECTIONS, firestore } from '@/firebase';
import { docToOutOfAreaRequest } from '@/services/bookingService';
import { DriverRecord, OutOfAreaRequest, VehicleType } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

export class DriverServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverServiceError';
  }
}

/** A stored brand, model or color; null when missing (records from before they existed). */
function readVehicleText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function docToDriverRecord(driverId: string, data: DocumentData): DriverRecord {
  const location = data.currentLocation as { latitude?: unknown; longitude?: unknown } | undefined;

  return {
    driverId,
    fullName: data.fullName ?? '',
    profileImage: data.profileImage ?? null,
    vehicleType: data.vehicleType as VehicleType,
    vehiclePlate: data.vehiclePlate ?? '',
    vehicleBrand: readVehicleText(data.vehicleBrand),
    vehicleModel: readVehicleText(data.vehicleModel),
    vehicleColor: readVehicleText(data.vehicleColor),
    rating: typeof data.rating === 'number' ? data.rating : 0,
    isOnline: data.isOnline === true,
    isVerified: data.isVerified === true,
    isRevoked: data.isVerified !== true && data.verificationUpdatedAt != null,
    isAvailable: data.isAvailable === true,
    currentLocation:
      location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
    currentBookingId: typeof data.currentBookingId === 'string' ? data.currentBookingId : null,
    currentRequestId: typeof data.currentRequestId === 'string' ? data.currentRequestId : null,
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
      // A driver with a trip in progress or a pending fare proposal comes back online but
      // stays unavailable.
      isAvailable:
        !hasActiveTrip && !driverRecord.currentBookingId && !driverRecord.currentRequestId,
      currentLocation: { latitude: location.latitude, longitude: location.longitude },
      updatedAt: serverTimestamp(),
    });
  } catch {
    throw new DriverServiceError(
      'Unable to go online. Please check your internet connection and try again.',
    );
  }
}

/**
 * Take the driver off duty; they will no longer appear in passenger driver searches.
 * A driver with a pending fare proposal (`currentRequestId`) withdraws it in the same
 * batch. If the request no longer holds them it is just released; if the passenger
 * already accepted, the reservation stays and only the duty status changes.
 */
export async function goOffline(
  driverId: string,
  currentRequestId: string | null = null,
): Promise<void> {
  const driverRef = doc(firestore, COLLECTIONS.drivers, driverId);
  const offline = { isOnline: false, isAvailable: false, updatedAt: serverTimestamp() };

  if (currentRequestId) {
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, COLLECTIONS.outOfAreaRequests, currentRequestId), {
        status: 'searching',
        driverId: null,
        suggestedAgreementFare: null,
        fareAgreement: null,
        updatedAt: serverTimestamp(),
      });
      batch.update(driverRef, { ...offline, currentRequestId: null });
      await batch.commit();
      return;
    } catch {
      // Not withdrawable: the request may already have released this driver.
    }

    try {
      await updateDoc(driverRef, { ...offline, currentRequestId: null });
      return;
    } catch {
      // Still held (e.g. the passenger accepted): go offline and keep the reservation.
    }
  }

  try {
    await updateDoc(driverRef, offline);
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

  if (driverRecord.currentBookingId) {
    throw new DriverServiceError('Finish or cancel your current trip first.');
  }

  if (driverRecord.currentRequestId) {
    throw new DriverServiceError('Withdraw your fare proposal first, or wait for the passenger.');
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
 * Release the driver from a booking the passenger cancelled: clear `currentBookingId`
 * and become available again if still online. Firestore rules only allow clearing
 * `currentBookingId` once that booking is cancelled or completed.
 */
export async function releaseCancelledBooking(driverRecord: DriverRecord): Promise<void> {
  const canBeAvailable = driverRecord.isOnline && driverRecord.isVerified;

  await updateDoc(doc(firestore, COLLECTIONS.drivers, driverRecord.driverId), {
    currentBookingId: null,
    isOnline: canBeAvailable,
    isAvailable: canBeAvailable,
    updatedAt: serverTimestamp(),
  });
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

// ─── Hidden out-of-area requests ────────────────────────────────────────────
// When a passenger declines this driver's fare the request goes back to searching. It is
// hidden for this driver, on this device, so it does not reappear in their list.

const hiddenRequestsKey = (driverId: string) => `trigo.driver.${driverId}.hiddenRequests`;
const MAX_HIDDEN_TRACKED = 200;

export async function getHiddenRequestIds(driverId: string): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(hiddenRequestsKey(driverId));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function hideOutOfAreaRequest(driverId: string, requestId: string): Promise<string[]> {
  const current = await getHiddenRequestIds(driverId);
  const updated = [requestId, ...current.filter((id) => id !== requestId)].slice(
    0,
    MAX_HIDDEN_TRACKED,
  );

  try {
    await AsyncStorage.setItem(hiddenRequestsKey(driverId), JSON.stringify(updated));
  } catch {
    // Still hidden for this session via the returned list.
  }

  return updated;
}

export interface OpenOutOfAreaRequest {
  request: OutOfAreaRequest;
  /** Straight-line distance from the driver to the pickup. */
  distanceToPickupKm: number;
}

/**
 * Open (searching, unexpired) out-of-area requests for the driver's vehicle type whose
 * pickup is within `searchRadiusKm` of the driver, nearest first. The query's expiry
 * filter is fixed at subscription time, so callers should also hide requests that
 * expire while the list is open.
 */
export function subscribeToOpenOutOfAreaRequests(
  vehicleType: VehicleType,
  driverLocation: { latitude: number; longitude: number },
  searchRadiusKm: number,
  onUpdate: (requests: OpenOutOfAreaRequest[]) => void,
  onError: (error: Error) => void,
): () => void {
  const openQuery = query(
    collection(firestore, COLLECTIONS.outOfAreaRequests),
    where('status', '==', 'searching'),
    where('vehicleType', '==', vehicleType),
    where('expiresAt', '>', Timestamp.now()),
  );

  return onSnapshot(
    openQuery,
    (snapshot) => {
      onUpdate(
        snapshot.docs
          .map((d) => {
            const request = docToOutOfAreaRequest(d.id, d.data());
            return {
              request,
              distanceToPickupKm: calculateDistanceKmFromCoords(
                driverLocation.latitude,
                driverLocation.longitude,
                request.pickupLocation.latitude,
                request.pickupLocation.longitude,
              ),
            };
          })
          .filter((item) => item.distanceToPickupKm <= searchRadiusKm)
          .sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm),
      );
    },
    (error) => onError(error),
  );
}

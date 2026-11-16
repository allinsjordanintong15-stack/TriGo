import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore';

import { readBooking, type AdminBooking } from '../bookings/bookings';
import { countComplaintsAgainst } from '../complaints/complaints';
import type { AccountTimes } from '../earnings/commissionStatus';
import { readAccount } from '../earnings/earnings';
import { db } from '../firebase/config';
import {
  normalizeVehicleDetails,
  normalizeVehiclePlate,
  readDriver,
  type AdminDriver,
  type DriverContact,
  type DriverVehicleType,
  type VehicleDetails,
} from './driverRecords';
import { readRatingSummary, type DriverRatingSummary } from './driverRatings';

// Drivers page: every drivers/{uid} record with contact details from users/{uid}, a
// driver's trip history, revoke/restore of verification, and vehicle corrections.

/** The trip history query returns at most this many bookings (newest first). */
export const TRIP_HISTORY_LIMIT = 200;

export type DriverListEntry = {
  driver: AdminDriver;
  contact: DriverContact | undefined;
  /** users/{uid}.profileImage (drivers/{uid}.profileImage is always null). */
  profileImage: string | null;
  /** users/{uid}.createdAt: when the account was registered. */
  joinedAt: Date | null;
  /** commissionAccounts/{uid}: undefined when there is none, null when it can't be read. */
  account: AccountTimes | null | undefined;
};

async function loadProfile(uid: string) {
  const data = (await getDoc(doc(db, 'users', uid))).data();
  return {
    contact: data ? { email: data.email ?? '', mobileNumber: data.mobileNumber ?? '' } : undefined,
    profileImage: typeof data?.profileImage === 'string' && data.profileImage ? data.profileImage : null,
    joinedAt: (data?.createdAt as Timestamp | undefined)?.toDate?.() ?? null,
  };
}

/**
 * All driver records, A–Z by name, with their profile (search needs every email and mobile
 * number: Firestore has no text search) and commission account (one query, for the
 * Commission filter). Ratings and complaint counts are loaded per page (loadDriverRowExtras).
 */
export async function loadDrivers(): Promise<DriverListEntry[]> {
  const [snapshot, accountsSnapshot] = await Promise.all([
    getDocs(collection(db, 'drivers')),
    getDocs(collection(db, 'commissionAccounts')),
  ]);
  const accounts = new Map(accountsSnapshot.docs.map((d) => [d.id, readAccount(d.data())]));
  const drivers = snapshot.docs.map((d) => readDriver(d.id, d.data()));
  const profiles = await Promise.all(drivers.map((driver) => loadProfile(driver.uid)));
  return drivers
    .map((driver, index) => ({
      driver,
      ...profiles[index],
      account: accounts.has(driver.uid) ? (accounts.get(driver.uid) ?? null) : undefined,
    }))
    .sort((a, b) => a.driver.fullName.localeCompare(b.driver.fullName));
}

export type DriverRowExtras = {
  /** driverRatings/{uid}; null when nobody has rated this driver yet. */
  ratingSummary: DriverRatingSummary | null;
  /** Complaints from passengers naming this driver (reportedUserId); null when the count failed. */
  complaintCount: number | null;
};

/**
 * Rating and complaint count for the rows on screen only: one document read and one count
 * query per driver. A failed count shows as unknown instead of failing the whole page.
 */
export async function loadDriverRowExtras(uids: string[]): Promise<Map<string, DriverRowExtras>> {
  const extras = await Promise.all(
    uids.map(async (uid) => {
      const [ratingSnap, complaintCount] = await Promise.all([
        getDoc(doc(db, 'driverRatings', uid)),
        countComplaintsAgainst(uid, 'driver').catch((error: unknown) => {
          console.error('Complaint count failed:', error);
          return null;
        }),
      ]);
      return [uid, { ratingSummary: readRatingSummary(ratingSnap.data()), complaintCount }] as const;
    }),
  );
  return new Map(extras);
}

export type DriverDetail = {
  driver: AdminDriver;
  contact: DriverContact | undefined;
  /** users/{uid}.role: 'driver', or 'passenger' for an approved applicant. */
  role: string;
  trips: AdminBooking[];
  /** True when the history query hit TRIP_HISTORY_LIMIT. */
  tripsTruncated: boolean;
  /** Email of the admin who last revoked or restored, when it is still a user profile. */
  verificationUpdatedByEmail: string | null;
  /** driverRatings/{uid}; null when nobody has rated this driver yet. */
  ratingSummary: DriverRatingSummary | null;
};

export async function loadDriverDetail(uid: string): Promise<DriverDetail | null> {
  const [driverSnap, userSnap, tripsSnap, ratingSnap] = await Promise.all([
    getDoc(doc(db, 'drivers', uid)),
    getDoc(doc(db, 'users', uid)),
    // Composite index bookings (driverId ASC, createdAt DESC) in firestore.indexes.json.
    getDocs(
      query(
        collection(db, 'bookings'),
        where('driverId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(TRIP_HISTORY_LIMIT),
      ),
    ),
    getDoc(doc(db, 'driverRatings', uid)),
  ]);
  if (!driverSnap.exists()) return null;
  const driver = readDriver(uid, driverSnap.data());
  const user = userSnap.data();

  let verificationUpdatedByEmail: string | null = null;
  if (driver.verificationUpdatedBy) {
    // Admin accounts may have no users/{uid} profile; the uid is shown instead.
    const adminData = (await getDoc(doc(db, 'users', driver.verificationUpdatedBy)).catch(() => null))?.data();
    verificationUpdatedByEmail = typeof adminData?.email === 'string' ? adminData.email : null;
  }

  return {
    driver,
    contact: user ? { email: user.email ?? '', mobileNumber: user.mobileNumber ?? '' } : undefined,
    role: user?.role ?? '',
    trips: tripsSnap.docs.map((d) => readBooking(d.id, d.data())),
    tripsTruncated: tripsSnap.size >= TRIP_HISTORY_LIMIT,
    verificationUpdatedByEmail,
    ratingSummary: readRatingSummary(ratingSnap.data()),
  };
}

export class VerificationConflictError extends Error {}

/**
 * Revokes verification and takes the driver offline in one write. The transaction re-reads
 * the record so a driver another admin already revoked is not revoked twice.
 */
export async function revokeDriver(uid: string, adminUid: string, reason: string): Promise<void> {
  const driverRef = doc(db, 'drivers', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(driverRef);
    if (!snap.exists()) throw new VerificationConflictError('This driver record no longer exists.');
    if (snap.data().isVerified !== true) {
      throw new VerificationConflictError('This driver is already not verified. Reload the page to see the latest.');
    }
    // Exact field set allowed by firestore.rules (drivers, admin update).
    transaction.update(driverRef, {
      isVerified: false,
      isOnline: false,
      isAvailable: false,
      verificationNote: reason.trim(),
      verificationUpdatedAt: serverTimestamp(),
      verificationUpdatedBy: adminUid,
    });
  });
}

/** Restores verification; the driver stays offline until they go online in the app. */
export async function restoreDriver(uid: string, adminUid: string): Promise<void> {
  const driverRef = doc(db, 'drivers', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(driverRef);
    if (!snap.exists()) throw new VerificationConflictError('This driver record no longer exists.');
    if (snap.data().isVerified === true) {
      throw new VerificationConflictError('This driver is already verified. Reload the page to see the latest.');
    }
    transaction.update(driverRef, {
      isVerified: true,
      isOnline: false,
      isAvailable: false,
      verificationNote: null,
      verificationUpdatedAt: serverTimestamp(),
      verificationUpdatedBy: adminUid,
    });
  });
}

export class VehicleConflictError extends Error {}

/**
 * Corrects the vehicle type, plate, brand, model and color (all five are always written, so
 * a record from before brand/model/color existed gets them). The transaction re-reads the
 * record because the rules refuse the change while the driver is on a trip or holding an
 * out-of-area request.
 */
export async function updateDriverVehicle(
  uid: string,
  vehicle: { vehicleType: DriverVehicleType; vehiclePlate: string } & VehicleDetails,
): Promise<void> {
  const details = normalizeVehicleDetails(vehicle);
  const driverRef = doc(db, 'drivers', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(driverRef);
    if (!snap.exists()) throw new VehicleConflictError('This driver record no longer exists.');
    const data = snap.data();
    if (data.currentBookingId != null || data.currentRequestId != null) {
      throw new VehicleConflictError(
        'This driver is now on a trip or holding an out-of-area request. Try again after it ends.',
      );
    }
    // Exact field set allowed by firestore.rules (drivers, admin vehicle update).
    transaction.update(driverRef, {
      vehicleType: vehicle.vehicleType,
      vehiclePlate: normalizeVehiclePlate(vehicle.vehiclePlate),
      vehicleBrand: details.vehicleBrand,
      vehicleModel: details.vehicleModel,
      vehicleColor: details.vehicleColor,
      updatedAt: serverTimestamp(),
    });
  });
}

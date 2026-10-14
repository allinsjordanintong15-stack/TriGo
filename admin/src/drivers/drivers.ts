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
} from 'firebase/firestore';

import { readBooking, type AdminBooking } from '../bookings/bookings';
import { db } from '../firebase/config';
import { readDriver, type AdminDriver, type DriverContact } from './driverRecords';

// Drivers page: every drivers/{uid} record with contact details from users/{uid}, a
// driver's trip history, and revoke/restore of verification.

/** The trip history query returns at most this many bookings (newest first). */
export const TRIP_HISTORY_LIMIT = 200;

export type DriverListEntry = { driver: AdminDriver; contact: DriverContact | undefined };

async function loadContact(uid: string): Promise<DriverContact | undefined> {
  const data = (await getDoc(doc(db, 'users', uid))).data();
  return data ? { email: data.email ?? '', mobileNumber: data.mobileNumber ?? '' } : undefined;
}

/** All driver records, A–Z by name. Search is done in the browser (Firestore has no text search). */
export async function loadDrivers(): Promise<DriverListEntry[]> {
  const snapshot = await getDocs(collection(db, 'drivers'));
  const drivers = snapshot.docs.map((d) => readDriver(d.id, d.data()));
  const contacts = await Promise.all(drivers.map((driver) => loadContact(driver.uid)));
  return drivers
    .map((driver, index) => ({ driver, contact: contacts[index] }))
    .sort((a, b) => a.driver.fullName.localeCompare(b.driver.fullName));
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
};

export async function loadDriverDetail(uid: string): Promise<DriverDetail | null> {
  const [driverSnap, userSnap, tripsSnap] = await Promise.all([
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

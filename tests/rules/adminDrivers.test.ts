/// <reference types="node" />

// Firestore rules tests for the Admin Website Drivers page: admins (custom claim
// `admin: true`) read every driver record, list a driver's trips, and revoke or restore
// verification, and correct vehicle details. Revoking takes the driver offline; a revoked
// driver can still finish the current trip but cannot go online or accept bookings.
// Run with `npm run test:rules` (starts the Firestore emulator under a demo project).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const REVOKED_DRIVER = 'driver2';
const BOOKING = 'booking1';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function driverRecord(overrides: DocumentData = {}): DocumentData {
  return {
    fullName: 'Carlo Bautista',
    vehiclePlate: 'GHI 9012',
    vehicleType: 'tricycle',
    isVerified: true,
    isOnline: true,
    isAvailable: true,
    currentLocation: { latitude: 10.08, longitude: 124.34 },
    currentBookingId: null,
    currentRequestId: null,
    rating: 4.8,
    profileImage: null,
    ...overrides,
  };
}

/** What admin/src/drivers/drivers.ts revokeDriver writes. */
function revocation(overrides: DocumentData = {}): DocumentData {
  return {
    isVerified: false,
    isOnline: false,
    isAvailable: false,
    verificationNote: 'Repeated passenger complaints',
    verificationUpdatedAt: serverTimestamp(),
    verificationUpdatedBy: ADMIN,
    ...overrides,
  };
}

/** What admin/src/drivers/drivers.ts restoreDriver writes. */
function restoration(overrides: DocumentData = {}): DocumentData {
  return {
    isVerified: true,
    isOnline: false,
    isAvailable: false,
    verificationNote: null,
    verificationUpdatedAt: serverTimestamp(),
    verificationUpdatedBy: ADMIN,
    ...overrides,
  };
}

function booking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'completed',
    estimatedFare: 55,
    finalFare: 55,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

async function read(path: string): Promise<DocumentData | undefined> {
  let data: DocumentData | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore() as unknown as Firestore, path));
    data = snapshot.data();
  });
  return data;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    [`users/${REVOKED_DRIVER}`]: { uid: REVOKED_DRIVER, role: 'driver' },
    [`drivers/${DRIVER}`]: driverRecord(),
    [`drivers/${REVOKED_DRIVER}`]: driverRecord({
      fullName: 'Dante Reyes',
      isVerified: false,
      isOnline: false,
      isAvailable: false,
      verificationNote: 'Expired license',
      verificationUpdatedAt: Timestamp.now(),
      verificationUpdatedBy: ADMIN,
    }),
    [`bookings/${BOOKING}`]: booking(),
    'bookings/booking2': booking({ status: 'cancelled', finalFare: null }),
    'bookings/booking3': booking({ driverId: REVOKED_DRIVER }),
  });
});

describe('admin drivers: read', () => {
  it('lets an admin read verified and revoked driver records', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'drivers', DRIVER)));
    await assertSucceeds(getDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER)));
  });

  it('lets an admin list every driver record', async () => {
    const all = await assertSucceeds(getDocs(collection(adminDb(), 'drivers')));
    if (all.size !== 2) throw new Error(`expected 2 drivers, got ${all.size}`);
  });

  it("lets an admin run the trip history query (driverId, newest first, capped)", async () => {
    const trips = await assertSucceeds(
      getDocs(query(collection(adminDb(), 'bookings'), where('driverId', '==', DRIVER), orderBy('createdAt', 'desc'), limit(200))),
    );
    if (trips.size !== 2) throw new Error(`expected 2 trips, got ${trips.size}`);
  });

  it('still hides revoked records and the full list from non-admins', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'drivers', REVOKED_DRIVER)));
    await assertFails(getDoc(doc(db(ADMIN), 'drivers', REVOKED_DRIVER)));
    await assertFails(getDoc(doc(db(ADMIN, { admin: false }), 'drivers', REVOKED_DRIVER)));
    await assertFails(getDocs(collection(db(PASSENGER), 'drivers')));
    await assertFails(
      getDocs(query(collection(db(PASSENGER), 'bookings'), where('driverId', '==', DRIVER), orderBy('createdAt', 'desc'), limit(200))),
    );
  });

  it('still lets signed-in users read verified drivers and drivers read their own record', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'drivers', DRIVER)));
    await assertSucceeds(getDoc(doc(db(REVOKED_DRIVER), 'drivers', REVOKED_DRIVER)));
  });
});

describe('admin drivers: revoke', () => {
  it('lets an admin revoke a verified driver, taking them offline', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation()));
    const after = await read(`drivers/${DRIVER}`);
    if (after?.isVerified !== false || after.isOnline !== false || after.isAvailable !== false) {
      throw new Error('driver should be revoked and offline');
    }
  });

  it('lets an admin revoke a driver who is on a trip, keeping the trip link', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ isAvailable: false, currentBookingId: BOOKING }) });
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation()));
    if ((await read(`drivers/${DRIVER}`))?.currentBookingId !== BOOKING) {
      throw new Error('currentBookingId should be unchanged');
    }
  });

  it('requires a reason of 1 to 500 characters', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationNote: '' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationNote: null })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationNote: 'x'.repeat(501) })));
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationNote: 'x'.repeat(500) })));
  });

  it('requires taking the driver offline and unavailable', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ isOnline: true })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ isAvailable: true })));
  });

  it('requires the server time and the acting admin', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationUpdatedAt: Timestamp.now() })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ verificationUpdatedBy: 'someone-else' })));
    const { verificationUpdatedBy: _by, ...withoutBy } = revocation();
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), withoutBy));
  });

  it('denies changing any other field', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ rating: 5 })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ vehicleType: 'motorcycle' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ fullName: 'Someone Else' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ currentBookingId: null, currentRequestId: 'r1' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation({ updatedAt: serverTimestamp() })));
  });

  it('denies revoking a driver who is already revoked', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), revocation()));
  });

  it('denies non-admins revoking', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'drivers', DRIVER), revocation()));
    await assertFails(updateDoc(doc(db(ADMIN, { admin: false }), 'drivers', DRIVER), revocation()));
    await assertFails(updateDoc(doc(db(PASSENGER), 'drivers', DRIVER), revocation({ verificationUpdatedBy: PASSENGER })));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), revocation({ verificationUpdatedBy: DRIVER })));
  });
});

describe('admin drivers: restore', () => {
  it('lets an admin restore a revoked driver, clearing the reason and leaving them offline', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), restoration()));
    const after = await read(`drivers/${REVOKED_DRIVER}`);
    if (after?.isVerified !== true || after.verificationNote !== null || after.isOnline !== false) {
      throw new Error('driver should be verified, offline, with no reason');
    }
  });

  it('lets an admin verify a record that was never verified (no verification fields yet)', async () => {
    await seed({ [`drivers/${REVOKED_DRIVER}`]: driverRecord({ isVerified: false, isOnline: false, isAvailable: false }) });
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), restoration()));
  });

  it('denies restoring with a reason, online, or without the audit fields', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), restoration({ verificationNote: 'ok now' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), restoration({ isOnline: true })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), restoration({ verificationUpdatedAt: Timestamp.now() })));
  });

  it('denies restoring a driver who is already verified', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), restoration()));
  });

  it('denies non-admins restoring, including the revoked driver themselves', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'drivers', REVOKED_DRIVER), restoration()));
    await assertFails(
      updateDoc(doc(db(REVOKED_DRIVER), 'drivers', REVOKED_DRIVER), restoration({ verificationUpdatedBy: REVOKED_DRIVER })),
    );
    await assertFails(updateDoc(doc(db(REVOKED_DRIVER), 'drivers', REVOKED_DRIVER), { isVerified: true }));
  });

  it('denies an admin creating or deleting driver records outside approval', async () => {
    await assertFails(setDoc(doc(adminDb(), 'drivers', PASSENGER), driverRecord()));
    await assertFails(deleteDoc(doc(adminDb(), 'drivers', DRIVER)));
  });
});

describe('admin drivers: the revoked driver in the app', () => {
  it('can stay offline but cannot go online', async () => {
    await assertSucceeds(
      updateDoc(doc(db(REVOKED_DRIVER), 'drivers', REVOKED_DRIVER), { isOnline: false, isAvailable: false, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db(REVOKED_DRIVER), 'drivers', REVOKED_DRIVER), { isOnline: true, isAvailable: true, updatedAt: serverTimestamp() }),
    );
  });

  it('cannot accept an open booking (the same write works for a verified driver)', async () => {
    await seed({ 'bookings/open1': booking({ driverId: null, status: 'pending', finalFare: null }) });
    function accept(uid: string) {
      const firestore = db(uid);
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'bookings', 'open1'), {
        status: 'accepted',
        driverId: uid,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(firestore, 'drivers', uid), {
        currentBookingId: 'open1',
        isAvailable: false,
        updatedAt: serverTimestamp(),
      });
      return batch.commit();
    }
    await assertFails(accept(REVOKED_DRIVER));
    await assertSucceeds(accept(DRIVER));
  });

  it('can still move a trip it was on forward after being revoked', async () => {
    await seed({
      [`bookings/${BOOKING}`]: booking({ status: 'accepted', finalFare: null }),
      [`drivers/${DRIVER}`]: driverRecord({ isAvailable: false, currentBookingId: BOOKING }),
    });
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), revocation()));
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), { status: 'arrived', arrivedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });
});

/** What admin/src/drivers/drivers.ts updateDriverVehicle writes. */
function vehicleEdit(overrides: DocumentData = {}): DocumentData {
  return { vehicleType: 'motorcycle', vehiclePlate: 'XYZ-987', updatedAt: serverTimestamp(), ...overrides };
}

describe('admin drivers: edit vehicle details', () => {
  it('lets an admin change the vehicle type and plate', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit()));
    const after = await read(`drivers/${DRIVER}`);
    if (after?.vehicleType !== 'motorcycle' || after.vehiclePlate !== 'XYZ-987') {
      throw new Error('vehicle should be updated');
    }
  });

  it('lets an admin change only the plate, or fix an invalid stored type, on a revoked driver too', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ vehicleType: 'tricycle' })));
    await seed({ [`drivers/${REVOKED_DRIVER}`]: driverRecord({ isVerified: false, isOnline: false, isAvailable: false, vehicleType: 'Tricycle' }) });
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', REVOKED_DRIVER), vehicleEdit({ vehicleType: 'tricycle', vehiclePlate: 'GHI 9012' })));
  });

  it('requires vehicleType to be exactly tricycle or motorcycle', async () => {
    for (const vehicleType of ['Tricycle', 'car', '', null, 1, ['tricycle']]) {
      await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ vehicleType })));
    }
    const { vehicleType: _type, ...withoutType } = vehicleEdit();
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ vehicleType: 'bus' }) });
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), withoutType));
  });

  it('requires a valid plate (the driver application format)', async () => {
    for (const vehiclePlate of ['', 'A', 'abc 1234', ' ABC1234', 'ABC1234-', 'ABC_1234', 'ABCDEFGHIJKLM', null, 1234]) {
      await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ vehiclePlate })));
    }
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ vehiclePlate: 'AB' })));
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ vehiclePlate: 'ABCDEFGHIJKL' })));
  });

  it('requires updatedAt to be the server time', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ updatedAt: Timestamp.now() })));
    const { updatedAt: _at, ...withoutUpdatedAt } = vehicleEdit();
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), withoutUpdatedAt));
  });

  it('denies changing any other field with the vehicle', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ fullName: 'Someone Else' })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ rating: 5 })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ isVerified: false })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ isOnline: false, isAvailable: false })));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ currentRequestId: 'r1' })));
  });

  it('denies the change while the driver is on a trip or holding an out-of-area request', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ isAvailable: false, currentBookingId: BOOKING }) });
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ currentBookingId: null })));
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ isAvailable: false, currentRequestId: 'request1' }) });
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), vehicleEdit({ currentRequestId: null })));
  });

  it('denies non-admins, including the driver themselves', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(db(ADMIN, { admin: false }), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(db(PASSENGER), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), vehicleEdit()));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { vehiclePlate: 'NEW 1', updatedAt: serverTimestamp() }));
  });
});

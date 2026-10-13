/// <reference types="node" />

// Firestore rules tests for admin driver verification: admins read driverApplications;
// approve = pending → approved (remarks optional) AND create drivers/{uid} in the same
// commit with the exact field set; reject = pending → rejected with required remarks
// (≤ 500 characters). users/{uid}.role never changes.
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
  doc,
  getDoc,
  getDocs,
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
const APPLICANT = 'applicant1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function storageDoc(type: string): DocumentData {
  return {
    storagePath: `driverApplications/${APPLICANT}/${type}`,
    downloadUrl: `https://firebasestorage.googleapis.com/v0/b/demo/o/${type}`,
    fileName: `${type}.jpg`,
    contentType: 'image/jpeg',
    uploadedAt: Timestamp.now(),
  };
}

function application(overrides: DocumentData = {}): DocumentData {
  return {
    uid: APPLICANT,
    firstName: 'Juan',
    middleName: null,
    lastName: 'Dela Cruz',
    fullName: 'Juan Dela Cruz',
    email: `${APPLICANT}@example.com`,
    mobileNumber: '+639171234567',
    vehicleType: 'tricycle',
    vehiclePlate: 'ABC 1234',
    documents: { orCr: storageDoc('orCr'), ltoLicense: storageDoc('ltoLicense') },
    status: 'pending',
    adminRemarks: null,
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    reviewedAt: null,
    ...overrides,
  };
}

/** The drivers/{uid} record the admin website creates on approval. */
function driverRecord(overrides: DocumentData = {}): DocumentData {
  return {
    fullName: 'Juan Dela Cruz',
    vehiclePlate: 'ABC 1234',
    vehicleType: 'tricycle',
    isVerified: true,
    isOnline: false,
    isAvailable: false,
    currentLocation: null,
    currentBookingId: null,
    currentRequestId: null,
    rating: 0,
    profileImage: null,
    ...overrides,
  };
}

function review(status: string, adminRemarks: string | null, overrides: DocumentData = {}): DocumentData {
  return {
    status,
    adminRemarks,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Approve exactly like the admin website: one batch with both writes. */
function approve(
  firestore: Firestore,
  options: { remarks?: string | null; review?: DocumentData; driver?: DocumentData | null } = {},
) {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'driverApplications', APPLICANT), {
    ...review('approved', options.remarks ?? null),
    ...(options.review ?? {}),
  });
  if (options.driver !== null) {
    batch.set(doc(firestore, 'drivers', APPLICANT), driverRecord(options.driver ?? {}));
  }
  return batch.commit();
}

function reject(firestore: Firestore, remarks: unknown, overrides: DocumentData = {}) {
  return updateDoc(doc(firestore, 'driverApplications', APPLICANT), {
    ...review('rejected', null),
    adminRemarks: remarks,
    ...overrides,
  });
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

async function read(path: string): Promise<DocumentData | undefined> {
  let data: DocumentData | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore() as unknown as Firestore, path))).data();
  });
  return data;
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
    [`users/${APPLICANT}`]: { uid: APPLICANT, role: 'passenger', fullName: 'Juan Dela Cruz', mobileNumber: '+639171234567', email: `${APPLICANT}@example.com` },
    [`users/${OTHER_PASSENGER}`]: { uid: OTHER_PASSENGER, role: 'passenger', fullName: 'Ana Cruz', mobileNumber: '+639181234567', email: `${OTHER_PASSENGER}@example.com` },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver', fullName: 'Pedro Reyes', mobileNumber: '+639191234567', email: `${DRIVER}@example.com` },
    [`driverApplications/${APPLICANT}`]: application(),
  });
});

describe('driver verification: reading applications', () => {
  it('lets an admin read an application and list pending ones', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'driverApplications', APPLICANT)));
    await assertSucceeds(
      getDocs(query(collection(adminDb(), 'driverApplications'), where('status', '==', 'pending'))),
    );
  });

  it('still lets applicants read their own application', async () => {
    await assertSucceeds(getDoc(doc(db(APPLICANT), 'driverApplications', APPLICANT)));
  });

  it('denies other users and non-claim accounts', async () => {
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'driverApplications', APPLICANT)));
    await assertFails(getDoc(doc(db(DRIVER), 'driverApplications', APPLICANT)));
    await assertFails(getDoc(doc(db(ADMIN, { admin: false }), 'driverApplications', APPLICANT)));
    await assertFails(getDocs(collection(db(OTHER_PASSENGER), 'driverApplications')));
  });
});

describe('driver verification: approve', () => {
  it('lets an admin approve and create the driver record in one commit', async () => {
    await assertSucceeds(approve(adminDb()));
    const app = await read(`driverApplications/${APPLICANT}`);
    if (app?.status !== 'approved') throw new Error('application not approved');
    const user = await read(`users/${APPLICANT}`);
    if (user?.role !== 'passenger') throw new Error('users.role changed');
  });

  it('allows optional remarks and a different vehicle type chosen by the admin', async () => {
    await assertSucceeds(approve(adminDb(), { remarks: 'Documents verified.', driver: { vehicleType: 'motorcycle' } }));
  });

  it('lets the approved passenger use driver access (go online)', async () => {
    await assertSucceeds(approve(adminDb()));
    await assertSucceeds(updateDoc(doc(db(APPLICANT), 'drivers', APPLICANT), { isOnline: true }));
  });

  it('denies non-admins', async () => {
    await assertFails(approve(db(APPLICANT)));
    await assertFails(approve(db(OTHER_PASSENGER)));
    await assertFails(approve(db(DRIVER)));
    await assertFails(approve(db(ADMIN, { admin: false })));
  });

  it('denies approving without creating the driver record', async () => {
    await assertFails(approve(adminDb(), { driver: null }));
  });

  it('denies creating a driver record without approving', async () => {
    await assertFails(setDoc(doc(adminDb(), 'drivers', APPLICANT), driverRecord()));
  });

  it('denies a driver record for someone without an application', async () => {
    await assertFails(setDoc(doc(adminDb(), 'drivers', OTHER_PASSENGER), driverRecord()));
  });

  it('denies an invalid vehicle type', async () => {
    await assertFails(approve(adminDb(), { driver: { vehicleType: 'van' } }));
    await assertFails(approve(adminDb(), { driver: { vehicleType: null } }));
  });

  it('denies a name or plate that differs from the application', async () => {
    await assertFails(approve(adminDb(), { driver: { fullName: 'Someone Else' } }));
    await assertFails(approve(adminDb(), { driver: { vehiclePlate: 'XYZ 9999' } }));
  });

  it('denies any other driver field values or extra fields', async () => {
    await assertFails(approve(adminDb(), { driver: { isVerified: false } }));
    await assertFails(approve(adminDb(), { driver: { isOnline: true } }));
    await assertFails(approve(adminDb(), { driver: { isAvailable: true } }));
    await assertFails(approve(adminDb(), { driver: { rating: 5 } }));
    await assertFails(approve(adminDb(), { driver: { currentBookingId: 'booking1' } }));
    await assertFails(approve(adminDb(), { driver: { profileImage: 'https://example.com/p.jpg' } }));
    await assertFails(approve(adminDb(), { driver: { createdAt: Timestamp.now() } }));
  });

  it('denies a missing driver field', async () => {
    const firestore = adminDb();
    const record = driverRecord();
    delete record.currentRequestId;
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'driverApplications', APPLICANT), review('approved', null));
    batch.set(doc(firestore, 'drivers', APPLICANT), record);
    await assertFails(batch.commit());
  });

  it('denies an admin editing applicant fields', async () => {
    await assertFails(approve(adminDb(), { review: { fullName: 'Edited Name' } }));
    await assertFails(approve(adminDb(), { review: { vehiclePlate: 'XYZ 9999' } }));
    await assertFails(
      updateDoc(doc(adminDb(), 'driverApplications', APPLICANT), { vehicleType: 'motorcycle' }),
    );
  });

  it('denies a client-chosen reviewedAt or updatedAt', async () => {
    await assertFails(approve(adminDb(), { review: { reviewedAt: Timestamp.now() } }));
    await assertFails(approve(adminDb(), { review: { updatedAt: Timestamp.now() } }));
  });

  it('denies blank or too-long approval remarks', async () => {
    await assertFails(approve(adminDb(), { remarks: '   ' }));
    await assertFails(approve(adminDb(), { remarks: 'x'.repeat(501) }));
  });

  it('denies approving an application that is not pending', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: application({ status: 'rejected', adminRemarks: 'Blurry' }) });
    await assertFails(approve(adminDb()));
  });

  it('denies approving when a driver record already exists', async () => {
    await seed({ [`drivers/${APPLICANT}`]: driverRecord() });
    const firestore = adminDb();
    await assertFails(
      updateDoc(doc(firestore, 'driverApplications', APPLICANT), review('approved', null)),
    );
  });
});

describe('driver verification: reject', () => {
  it('lets an admin reject with remarks', async () => {
    await assertSucceeds(reject(adminDb(), 'The OR/CR photo is blurry. Please upload a clearer photo.'));
    if (await read(`drivers/${APPLICANT}`)) throw new Error('driver record created');
  });

  it('allows exactly 500 characters', async () => {
    await assertSucceeds(reject(adminDb(), 'x'.repeat(500)));
  });

  it('lets the applicant resubmit after a rejection (unchanged rule)', async () => {
    await assertSucceeds(reject(adminDb(), 'Blurry photo.'));
    await assertSucceeds(
      // The resubmit rule checks the token email against the application's email.
      updateDoc(doc(db(APPLICANT, { email: `${APPLICANT}@example.com` }), 'driverApplications', APPLICANT), {
        status: 'pending',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies missing, blank, non-string or too-long remarks', async () => {
    await assertFails(reject(adminDb(), null));
    await assertFails(reject(adminDb(), ''));
    await assertFails(reject(adminDb(), '  \n '));
    await assertFails(reject(adminDb(), 42));
    await assertFails(reject(adminDb(), 'x'.repeat(501)));
  });

  it('denies non-admins', async () => {
    await assertFails(reject(db(APPLICANT), 'No'));
    await assertFails(reject(db(DRIVER), 'No'));
  });

  it('denies an admin editing applicant fields while rejecting', async () => {
    await assertFails(reject(adminDb(), 'Blurry', { mobileNumber: '+639000000000' }));
  });

  it('denies rejecting an application that is not pending', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: application({ status: 'approved' }) });
    await assertFails(reject(adminDb(), 'Changed my mind'));
  });

  it('denies other status values', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'driverApplications', APPLICANT), review('on_hold', 'Wait')),
    );
  });
});

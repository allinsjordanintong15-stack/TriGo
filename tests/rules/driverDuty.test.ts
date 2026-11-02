/// <reference types="node" />

// Firestore rules tests for a driver's own duty status and position (drivers/{uid}):
// going online records currentLocation; going offline clears it (null), so a verified
// driver's record no longer shows where they were. null is allowed only while offline.
// Run with `npm run test:rules`.
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
  doc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { availableDriverRecord, baseDocs, DRIVER, driverRecord, openRequest, REQUEST } from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

let testEnv: RulesTestEnvironment;

function db(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

const HERE = { latitude: 9.97, longitude: 124.48 };

function updateDriver(data: DocumentData): Promise<void> {
  return updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { ...data, updatedAt: serverTimestamp() });
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
  await seed(baseDocs());
});

describe('driver duty: going online', () => {
  it('records the position when going online', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...driverRecord(null), isOnline: false, currentLocation: null } });
    await assertSucceeds(updateDriver({ isOnline: true, isAvailable: true, currentLocation: HERE }));
  });

  it('denies going online without a position (it was cleared when going offline), or with a malformed one', async () => {
    for (const currentLocation of [null, 'Poblacion', { latitude: 9.97 }, { latitude: '9.97', longitude: 124.48 }]) {
      await seed({ [`drivers/${DRIVER}`]: { ...driverRecord(null), isOnline: false, currentLocation: null } });
      await assertFails(updateDriver({ isOnline: true, isAvailable: true, currentLocation }));
    }
  });
});

describe('driver duty: staying online', () => {
  it('writes that do not touch the position stay allowed while online', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), currentLocation: HERE } });
    await assertSucceeds(updateDriver({ isAvailable: false }));
  });
});

describe('driver duty: going offline clears the position', () => {
  it('allows clearing the position while going offline (goOffline)', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), currentLocation: HERE } });
    await assertSucceeds(updateDriver({ isOnline: false, isAvailable: false, currentLocation: null }));
  });

  it('also when releasing a request that no longer holds the driver', async () => {
    await seed({
      [`drivers/${DRIVER}`]: { ...driverRecord(null), currentRequestId: REQUEST, currentLocation: HERE },
      [`outOfAreaRequests/${REQUEST}`]: openRequest({ status: 'cancelled', driverId: DRIVER }),
    });
    await assertSucceeds(
      updateDriver({ isOnline: false, isAvailable: false, currentLocation: null, currentRequestId: null }),
    );
  });

  it('also when withdrawing a proposal in the same batch', async () => {
    await seed({
      [`drivers/${DRIVER}`]: { ...driverRecord(null), currentRequestId: REQUEST, currentLocation: HERE },
      [`outOfAreaRequests/${REQUEST}`]: openRequest({ status: 'negotiating', driverId: DRIVER }),
    });
    const firestore = db(DRIVER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
      status: 'searching',
      driverId: null,
      suggestedAgreementFare: null,
      fareAgreement: null,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(firestore, 'drivers', DRIVER), {
      isOnline: false,
      isAvailable: false,
      currentLocation: null,
      currentRequestId: null,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('a driver on a trip can go offline and clear the position (the trip link stays)', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...driverRecord('booking1'), currentLocation: HERE } });
    await assertSucceeds(updateDriver({ isOnline: false, isAvailable: false, currentLocation: null }));
  });

  it('going offline without touching the position is still allowed (older app builds)', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), currentLocation: HERE } });
    await assertSucceeds(updateDriver({ isOnline: false, isAvailable: false }));
  });

  it('denies clearing the position while staying online', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), currentLocation: HERE } });
    await assertFails(updateDriver({ currentLocation: null }));
    await assertFails(updateDriver({ isOnline: true, isAvailable: false, currentLocation: null }));
  });

  it('denies another user clearing or setting a driver’s position', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), currentLocation: HERE } });
    await assertFails(
      updateDoc(doc(db('driver2'), 'drivers', DRIVER), {
        isOnline: false,
        isAvailable: false,
        currentLocation: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

/// <reference types="node" />

// Firestore rules tests for fareSettings/active: signed-in users read it; only admins
// (custom claim `admin: true`) write it, with updatedAt = server time and updatedBy = their
// uid. Each write changes either the complete `fares` object or the complete `outOfArea`
// object (enabled, requestExpiryMinutes 1-30, driverSearchRadiusKm 1-50), never both.
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
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const FARE_PATH = 'fareSettings/active';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function fares(overrides: DocumentData = {}): DocumentData {
  return {
    tricycle: { baseFare: 15, perKm: 8 },
    motorcycle: { baseFare: 10, perKm: 6 },
    ...overrides,
  };
}

/** The write the admin website sends: the whole fares object plus audit fields. */
function fareWrite(faresValue: DocumentData = fares(), uid = ADMIN): DocumentData {
  return { fares: faresValue, updatedAt: serverTimestamp(), updatedBy: uid };
}

const OUT_OF_AREA = { enabled: true, requestExpiryMinutes: 30, driverSearchRadiusKm: 15 };

async function seedActive(data: DocumentData): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, FARE_PATH), data);
  });
}

async function seedExisting(): Promise<void> {
  await seedActive({
    fares: fares(),
    outOfArea: OUT_OF_AREA,
    updatedAt: Timestamp.now(),
    updatedBy: ADMIN,
  });
}

function updateFares(firestore: Firestore, faresValue: DocumentData, extra: DocumentData = {}) {
  return updateDoc(doc(firestore, FARE_PATH), { ...fareWrite(faresValue), ...extra });
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
});

describe('fareSettings: read', () => {
  beforeEach(seedExisting);

  it('lets any signed-in user read', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), FARE_PATH)));
    await assertSucceeds(getDoc(doc(db(DRIVER), FARE_PATH)));
    await assertSucceeds(getDoc(doc(adminDb(), FARE_PATH)));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), FARE_PATH)));
  });
});

describe('fareSettings: create (no document yet)', () => {
  it('lets an admin create the active document with a full fares object', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), FARE_PATH), fareWrite()));
  });

  it('denies non-admins', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), FARE_PATH), fareWrite(fares(), PASSENGER)));
    await assertFails(setDoc(doc(db(DRIVER), FARE_PATH), fareWrite(fares(), DRIVER)));
    await assertFails(setDoc(doc(db(ADMIN, { admin: false }), FARE_PATH), fareWrite()));
    await assertFails(setDoc(doc(db(null), FARE_PATH), fareWrite()));
  });

  it('denies extra top-level fields, including outOfArea', async () => {
    await assertFails(setDoc(doc(adminDb(), FARE_PATH), { ...fareWrite(), outOfArea: OUT_OF_AREA }));
    await assertFails(setDoc(doc(adminDb(), FARE_PATH), { ...fareWrite(), note: 'x' }));
  });

  it('denies other fareSettings documents', async () => {
    await assertFails(setDoc(doc(adminDb(), 'fareSettings', 'draft'), fareWrite()));
  });
});

describe('fareSettings: update', () => {
  beforeEach(seedExisting);

  it('lets an admin replace the fares object and keeps outOfArea', async () => {
    const next = fares({ tricycle: { baseFare: 20, perKm: 9.5 } });
    await assertSucceeds(updateFares(adminDb(), next));
    const snapshot = await getDoc(doc(adminDb(), FARE_PATH));
    const data = snapshot.data()!;
    if (JSON.stringify(data.outOfArea) !== JSON.stringify(OUT_OF_AREA)) {
      throw new Error('outOfArea changed');
    }
    if (data.fares.tricycle.perKm !== 9.5) {
      throw new Error('fares not updated');
    }
  });

  it('allows a base fare of 0', async () => {
    await assertSucceeds(updateFares(adminDb(), fares({ motorcycle: { baseFare: 0, perKm: 6 } })));
  });

  it('allows exactly 2 decimal places', async () => {
    await assertSucceeds(
      updateFares(adminDb(), fares({ tricycle: { baseFare: 12.35, perKm: 8.15 }, motorcycle: { baseFare: 0.1, perKm: 0.01 } })),
    );
  });

  it('denies non-admins', async () => {
    await assertFails(updateDoc(doc(db(PASSENGER), FARE_PATH), fareWrite(fares(), PASSENGER)));
    await assertFails(updateDoc(doc(db(DRIVER), FARE_PATH), fareWrite(fares(), DRIVER)));
    await assertFails(updateDoc(doc(db(ADMIN, { admin: 'true' }), FARE_PATH), fareWrite()));
  });

  it('denies a negative base fare', async () => {
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: -1, perKm: 8 } })));
  });

  it('denies a per-km rate of 0 or below', async () => {
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: 15, perKm: 0 } })));
    await assertFails(updateFares(adminDb(), fares({ motorcycle: { baseFare: 10, perKm: -6 } })));
  });

  it('denies more than 2 decimal places', async () => {
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: 15.123, perKm: 8 } })));
    await assertFails(updateFares(adminDb(), fares({ motorcycle: { baseFare: 10, perKm: 6.005 } })));
  });

  it('denies non-number values', async () => {
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: '15', perKm: 8 } })));
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: 15, perKm: null } })));
  });

  it('denies a missing or extra vehicle type', async () => {
    await assertFails(updateFares(adminDb(), { tricycle: { baseFare: 15, perKm: 8 } }));
    await assertFails(updateFares(adminDb(), fares({ van: { baseFare: 30, perKm: 12 } })));
  });

  it('denies a missing or extra field in a vehicle fare', async () => {
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: 15 } })));
    await assertFails(updateFares(adminDb(), fares({ tricycle: { baseFare: 15, perKm: 8, minimumFare: 20 } })));
  });

  it('denies removing a vehicle type with a field delete', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), FARE_PATH), {
        'fares.motorcycle': deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies a client-chosen updatedAt or another updatedBy', async () => {
    await assertFails(updateFares(adminDb(), fares(), { updatedAt: Timestamp.now() }));
    await assertFails(updateFares(adminDb(), fares(), { updatedBy: 'someoneElse' }));
  });

  it('denies a write without updatedAt and updatedBy', async () => {
    await assertFails(updateDoc(doc(adminDb(), FARE_PATH), { fares: fares() }));
  });

  it('denies changing fares and outOfArea in one write, or adding other fields', async () => {
    const next = fares({ tricycle: { baseFare: 20, perKm: 9 } });
    await assertFails(updateFares(adminDb(), next, { outOfArea: { ...OUT_OF_AREA, enabled: false } }));
    await assertFails(updateFares(adminDb(), fares(), { note: 'x' }));
  });

  it('denies replacing the whole document (drops outOfArea)', async () => {
    await assertFails(setDoc(doc(adminDb(), FARE_PATH), fareWrite()));
  });

  it('denies deleting the document', async () => {
    await assertFails(deleteDoc(doc(adminDb(), FARE_PATH)));
  });
});

/** The write the System settings page sends: the whole outOfArea object plus audit fields. */
function outOfAreaWrite(value: DocumentData = OUT_OF_AREA, uid = ADMIN): DocumentData {
  return { outOfArea: value, updatedAt: serverTimestamp(), updatedBy: uid };
}

function updateOutOfArea(firestore: Firestore, value: DocumentData, extra: DocumentData = {}) {
  return updateDoc(doc(firestore, FARE_PATH), { ...outOfAreaWrite(value), ...extra });
}

describe('fareSettings: outOfArea create (no document yet)', () => {
  it('lets an admin create the document with only outOfArea', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), FARE_PATH), outOfAreaWrite()));
  });

  it('then lets an admin add fares without touching outOfArea', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), FARE_PATH), outOfAreaWrite()));
    await assertSucceeds(updateFares(adminDb(), fares()));
  });

  it('denies non-admins', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), FARE_PATH), outOfAreaWrite(OUT_OF_AREA, PASSENGER)));
    await assertFails(setDoc(doc(db(DRIVER), FARE_PATH), outOfAreaWrite(OUT_OF_AREA, DRIVER)));
  });

  it('denies an invalid outOfArea or extra fields', async () => {
    await assertFails(setDoc(doc(adminDb(), FARE_PATH), outOfAreaWrite({ ...OUT_OF_AREA, driverSearchRadiusKm: 0 })));
    await assertFails(setDoc(doc(adminDb(), FARE_PATH), { ...outOfAreaWrite(), note: 'x' }));
  });
});

describe('fareSettings: outOfArea update', () => {
  beforeEach(seedExisting);

  it('lets an admin replace outOfArea and keeps fares', async () => {
    const next = { enabled: false, requestExpiryMinutes: 10, driverSearchRadiusKm: 25 };
    await assertSucceeds(updateOutOfArea(adminDb(), next));
    const data = (await getDoc(doc(adminDb(), FARE_PATH))).data()!;
    if (JSON.stringify(data.outOfArea) !== JSON.stringify(next)) throw new Error('outOfArea not updated');
    if (JSON.stringify(data.fares) !== JSON.stringify(fares())) throw new Error('fares changed');
  });

  it('allows the range limits', async () => {
    await assertSucceeds(updateOutOfArea(adminDb(), { enabled: true, requestExpiryMinutes: 1, driverSearchRadiusKm: 1 }));
    await assertSucceeds(updateOutOfArea(adminDb(), { enabled: true, requestExpiryMinutes: 30, driverSearchRadiusKm: 50 }));
  });

  it('lets an admin add outOfArea when the document has only fares', async () => {
    await seedActive({ fares: fares(), updatedAt: Timestamp.now(), updatedBy: ADMIN });
    await assertSucceeds(updateOutOfArea(adminDb(), OUT_OF_AREA));
  });

  it('denies non-admins', async () => {
    await assertFails(updateDoc(doc(db(PASSENGER), FARE_PATH), outOfAreaWrite(OUT_OF_AREA, PASSENGER)));
    await assertFails(updateDoc(doc(db(DRIVER), FARE_PATH), outOfAreaWrite(OUT_OF_AREA, DRIVER)));
    await assertFails(updateDoc(doc(db(ADMIN, { admin: false }), FARE_PATH), outOfAreaWrite()));
  });

  const invalid: [string, DocumentData][] = [
    ['an expiry of 0 minutes', { ...OUT_OF_AREA, requestExpiryMinutes: 0 }],
    ['an expiry over 30 minutes', { ...OUT_OF_AREA, requestExpiryMinutes: 31 }],
    ['a fractional expiry', { ...OUT_OF_AREA, requestExpiryMinutes: 10.5 }],
    ['a radius of 0 km', { ...OUT_OF_AREA, driverSearchRadiusKm: 0 }],
    ['a radius over 50 km', { ...OUT_OF_AREA, driverSearchRadiusKm: 51 }],
    ['a fractional radius', { ...OUT_OF_AREA, driverSearchRadiusKm: 7.5 }],
    ['a string radius', { ...OUT_OF_AREA, driverSearchRadiusKm: '15' }],
    ['a non-boolean enabled', { ...OUT_OF_AREA, enabled: 'yes' }],
    ['a missing field', { enabled: true, requestExpiryMinutes: 30 }],
    ['an extra field', { ...OUT_OF_AREA, maxDistanceKm: 100 }],
    ['a non-map value', 'off' as unknown as DocumentData],
  ];

  for (const [label, value] of invalid) {
    it(`denies ${label}`, async () => {
      await assertFails(updateOutOfArea(adminDb(), value));
    });
  }

  it('denies a client-chosen updatedAt or another updatedBy', async () => {
    await assertFails(updateOutOfArea(adminDb(), OUT_OF_AREA, { updatedAt: Timestamp.now() }));
    await assertFails(updateOutOfArea(adminDb(), OUT_OF_AREA, { updatedBy: 'someoneElse' }));
  });

  it('denies removing outOfArea with a field delete', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), FARE_PATH), { outOfArea: deleteField(), updatedAt: serverTimestamp(), updatedBy: ADMIN }),
    );
  });
});

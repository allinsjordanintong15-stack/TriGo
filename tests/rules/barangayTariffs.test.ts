/// <reference types="node" />

// Firestore rules tests for barangayTariffs/{barangayId}: one document per non-Poblacion
// barangay, readable by signed-in users, written only by admins as a complete row (known
// IDs and names only, tariffs > 0 with at most 2 decimals, active is a bool, updatedAt =
// server time, updatedBy = admin uid). fareSettings/active is unaffected.
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

const BARANGAYS: [string, string][] = [
  ['banlasan', 'Banlasan'],
  ['bongbong', 'Bongbong'],
  ['catoogan', 'Catoogan'],
  ['guinobatan', 'Guinobatan'],
  ['hinlayagan-ilaud', 'Hinlayagan Ilaud'],
  ['hinlayagan-ilaya', 'Hinlayagan Ilaya'],
  ['kauswagan', 'Kauswagan'],
  ['kinan-oan', 'Kinan-oan'],
  ['la-union', 'La Union'],
  ['la-victoria', 'La Victoria'],
  ['mabuhay-cabigohan', 'Mabuhay Cabigohan'],
  ['mahagbu', 'Mahagbu'],
  ['manuel-m-roxas', 'Manuel M. Roxas'],
  ['san-isidro', 'San Isidro'],
  ['san-vicente', 'San Vicente'],
  ['santo-tomas', 'Santo Tomas'],
  ['soom', 'Soom'],
  ['tagum-norte', 'Tagum Norte'],
  ['tagum-sur', 'Tagum Sur'],
];

const NAMES = Object.fromEntries(BARANGAYS);

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

/** The complete row the admin website writes. */
function row(id: string, overrides: DocumentData = {}, uid = ADMIN): DocumentData {
  return {
    name: NAMES[id],
    tricycle: 25,
    motorcycle: 20,
    active: true,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...overrides,
  };
}

function writeRow(firestore: Firestore, id: string, data: DocumentData) {
  return setDoc(doc(firestore, 'barangayTariffs', id), data);
}

async function seed(path: string, data: DocumentData): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, path), data);
  });
}

async function seedRow(id: string): Promise<void> {
  await seed(`barangayTariffs/${id}`, {
    name: NAMES[id],
    tricycle: 25,
    motorcycle: 20,
    active: true,
    updatedAt: Timestamp.now(),
    updatedBy: ADMIN,
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
});

describe('barangayTariffs: read', () => {
  beforeEach(() => seedRow('soom'));

  it('lets any signed-in user read', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'barangayTariffs', 'soom')));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'barangayTariffs', 'soom')));
    await assertSucceeds(getDoc(doc(adminDb(), 'barangayTariffs', 'soom')));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), 'barangayTariffs', 'soom')));
  });
});

describe('barangayTariffs: create', () => {
  it('lets an admin create a complete row', async () => {
    await assertSucceeds(writeRow(adminDb(), 'soom', row('soom')));
  });

  it('lets an admin create all 19 rows in one batch', async () => {
    const firestore = adminDb();
    const batch = writeBatch(firestore);
    for (const [id] of BARANGAYS) {
      batch.set(doc(firestore, 'barangayTariffs', id), row(id));
    }
    await assertSucceeds(batch.commit());
  });

  it('allows inactive rows and 2-decimal tariffs', async () => {
    await assertSucceeds(writeRow(adminDb(), 'mahagbu', row('mahagbu', { active: false, tricycle: 25.5, motorcycle: 0.01 })));
    await assertSucceeds(writeRow(adminDb(), 'catoogan', row('catoogan', { tricycle: 8.15, motorcycle: 12.35 })));
  });

  it('denies non-admins', async () => {
    await assertFails(writeRow(db(PASSENGER), 'soom', row('soom', {}, PASSENGER)));
    await assertFails(writeRow(db(DRIVER), 'soom', row('soom', {}, DRIVER)));
    await assertFails(writeRow(db(ADMIN, { admin: false }), 'soom', row('soom')));
    await assertFails(writeRow(db(null), 'soom', row('soom')));
  });

  it('denies unknown IDs, including Poblacion', async () => {
    await assertFails(writeRow(adminDb(), 'poblacion', { ...row('soom'), name: 'Poblacion' }));
    await assertFails(writeRow(adminDb(), 'new-barangay', { ...row('soom'), name: 'New Barangay' }));
    await assertFails(writeRow(adminDb(), 'Soom', row('soom')));
  });

  it('denies a wrong name for a known ID', async () => {
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { name: 'Bongbong' })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { name: 'soom' })));
  });

  it('denies a tariff of 0 or below', async () => {
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { tricycle: 0 })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { motorcycle: -5 })));
  });

  it('denies more than 2 decimal places', async () => {
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { tricycle: 25.555 })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { motorcycle: 0.001 })));
  });

  it('denies non-number tariffs and a non-bool active', async () => {
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { tricycle: '25' })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { motorcycle: null })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { active: 'true' })));
  });

  it('denies a missing or extra field', async () => {
    const missing = row('soom');
    delete missing.active;
    await assertFails(writeRow(adminDb(), 'soom', missing));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { habalHabal: 30 })));
  });

  it('denies a client-chosen updatedAt or another updatedBy', async () => {
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { updatedAt: Timestamp.now() })));
    await assertFails(writeRow(adminDb(), 'soom', row('soom', { updatedBy: 'someoneElse' })));
  });
});

describe('barangayTariffs: update and delete', () => {
  beforeEach(() => seedRow('soom'));

  it('lets an admin replace the row', async () => {
    await assertSucceeds(writeRow(adminDb(), 'soom', row('soom', { tricycle: 40, active: false })));
  });

  it('lets an admin update fields as long as the row stays complete and valid', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'barangayTariffs', 'soom'), {
        active: false,
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies an update that leaves the row invalid', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'barangayTariffs', 'soom'), {
        tricycle: 0,
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
    await assertFails(
      updateDoc(doc(adminDb(), 'barangayTariffs', 'soom'), {
        motorcycle: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies an update without fresh audit fields', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'barangayTariffs', 'soom'), { tricycle: 30 }));
  });

  it('denies non-admin updates', async () => {
    await assertFails(writeRow(db(PASSENGER), 'soom', row('soom', { tricycle: 1 }, PASSENGER)));
  });

  it('denies deleting a row, even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'barangayTariffs', 'soom')));
  });
});

describe('barangayTariffs: fareSettings stays separate', () => {
  const FARES = {
    tricycle: { baseFare: 15, perKm: 8 },
    motorcycle: { baseFare: 10, perKm: 6 },
  };

  beforeEach(async () => {
    await seed('fareSettings/active', { fares: FARES, updatedAt: Timestamp.now(), updatedBy: ADMIN });
    await seedRow('soom');
  });

  it('a fares save does not touch tariff rows', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'fareSettings', 'active'), {
        fares: { ...FARES, motorcycle: { baseFare: 12, perKm: 7 } },
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
    const snapshot = await getDoc(doc(adminDb(), 'barangayTariffs', 'soom'));
    if (snapshot.data()?.tricycle !== 25) {
      throw new Error('tariff row changed');
    }
  });

  it('denies storing tariffs inside fareSettings/active', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'fareSettings', 'active'), {
        barangayTariffs: { soom: { name: 'Soom', tricycle: 25, motorcycle: 20, active: true } },
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });
});

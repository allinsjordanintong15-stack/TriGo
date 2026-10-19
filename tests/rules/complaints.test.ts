/// <reference types="node" />

// Firestore rules tests for complaints/{bookingId}_{uid}: the booking's passenger or its
// assigned driver creates one report per booking (category + message up to 1000
// characters, status open, server timestamps); the reporter reads only their own; admins
// (custom claim `admin: true`) list and review (status, adminNotes, updatedAt, updatedBy).
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
  getCountFromServer,
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
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const OTHER_PASSENGER = 'passenger2';
const OTHER_DRIVER = 'driver2';
const BOOKING = 'booking1';
const UNASSIGNED = 'booking2';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function complaintPath(bookingId: string, uid: string): string {
  return `complaints/${bookingId}_${uid}`;
}

/** The write the app sends from "Report a problem". */
function complaint(uid: string, role: 'passenger' | 'driver', overrides: DocumentData = {}): DocumentData {
  return {
    bookingId: BOOKING,
    reporterId: uid,
    reporterRole: role,
    category: role === 'passenger' ? 'driver_behavior' : 'passenger_behavior',
    message: 'The trip did not go as expected.',
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function report(uid: string, role: 'passenger' | 'driver', overrides: DocumentData = {}, bookingId = BOOKING) {
  return setDoc(doc(db(uid), complaintPath(bookingId, uid)), complaint(uid, role, { bookingId, ...overrides }));
}

/** The write the admin website sends from the complaint detail page. */
function review(overrides: DocumentData = {}): DocumentData {
  return { status: 'in_review', adminNotes: 'Called the driver.', updatedAt: serverTimestamp(), updatedBy: ADMIN, ...overrides };
}

async function seed(write: (firestore: Firestore) => Promise<void>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await write(context.firestore() as unknown as Firestore);
  });
}

async function seedBookings(): Promise<void> {
  await seed(async (firestore) => {
    await setDoc(doc(firestore, 'bookings', BOOKING), {
      passengerId: PASSENGER,
      driverId: DRIVER,
      status: 'completed',
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(firestore, 'bookings', UNASSIGNED), {
      passengerId: PASSENGER,
      driverId: null,
      status: 'cancelled',
      createdAt: Timestamp.now(),
    });
  });
}

async function seedComplaint(uid = PASSENGER, role: 'passenger' | 'driver' = 'passenger', status = 'open'): Promise<void> {
  await seed(async (firestore) => {
    await setDoc(doc(firestore, complaintPath(BOOKING, uid)), {
      ...complaint(uid, role),
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
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
  await seedBookings();
});

describe('complaints: create', () => {
  it('lets the passenger report their booking', async () => {
    await assertSucceeds(report(PASSENGER, 'passenger'));
  });

  it('lets the assigned driver report the booking', async () => {
    await assertSucceeds(report(DRIVER, 'driver'));
  });

  it('lets the passenger and the driver each report the same booking', async () => {
    await assertSucceeds(report(PASSENGER, 'passenger'));
    await assertSucceeds(report(DRIVER, 'driver'));
  });

  it('lets the passenger report a booking that never had a driver', async () => {
    await assertSucceeds(report(PASSENGER, 'passenger', { category: 'app_problem' }, UNASSIGNED));
  });

  it('allows every category open to each role', async () => {
    for (const category of ['driver_behavior', 'fare_or_payment', 'safety', 'lost_item', 'app_problem', 'other']) {
      await testEnv.clearFirestore();
      await seedBookings();
      await assertSucceeds(report(PASSENGER, 'passenger', { category }));
    }
    for (const category of ['passenger_behavior', 'fare_or_payment', 'safety', 'lost_item', 'app_problem', 'other']) {
      await testEnv.clearFirestore();
      await seedBookings();
      await assertSucceeds(report(DRIVER, 'driver', { category }));
    }
  });

  it('allows a message of exactly 1000 characters', async () => {
    await assertSucceeds(report(PASSENGER, 'passenger', { message: 'x'.repeat(1000) }));
  });

  it('denies a second report by the same person (one per booking)', async () => {
    await assertSucceeds(report(PASSENGER, 'passenger'));
    await assertFails(report(PASSENGER, 'passenger', { message: 'Again.' }));
  });

  it('denies people who are not on the booking', async () => {
    await assertFails(report(OTHER_PASSENGER, 'passenger'));
    await assertFails(report(OTHER_DRIVER, 'driver'));
    await assertFails(setDoc(doc(adminDb(), complaintPath(BOOKING, ADMIN)), complaint(ADMIN, 'passenger')));
    await assertFails(setDoc(doc(db(null), complaintPath(BOOKING, PASSENGER)), complaint(PASSENGER, 'passenger')));
  });

  it('denies claiming the other role on the booking', async () => {
    await assertFails(report(PASSENGER, 'driver', { category: 'other' }));
    await assertFails(report(DRIVER, 'passenger', { category: 'other' }));
  });

  it('denies a booking that does not exist', async () => {
    await assertFails(report(PASSENGER, 'passenger', {}, 'missing-booking'));
  });

  it('denies an ID that is not {bookingId}_{reporter uid}', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'complaints', 'random-id'), complaint(PASSENGER, 'passenger')));
    await assertFails(
      setDoc(doc(db(PASSENGER), complaintPath(BOOKING, DRIVER)), complaint(PASSENGER, 'passenger')),
    );
    await assertFails(
      setDoc(doc(db(PASSENGER), complaintPath(UNASSIGNED, PASSENGER)), complaint(PASSENGER, 'passenger')),
    );
  });

  it('denies reporting for someone else', async () => {
    await assertFails(
      setDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER)), complaint(PASSENGER, 'passenger', { reporterId: DRIVER })),
    );
  });

  const invalid: [string, 'passenger' | 'driver', DocumentData][] = [
    ['a passenger reporting passenger behavior', 'passenger', { category: 'passenger_behavior' }],
    ['a driver reporting driver behavior', 'driver', { category: 'driver_behavior' }],
    ['an unknown category', 'passenger', { category: 'rude' }],
    ['an empty message', 'passenger', { message: '' }],
    ['a blank message', 'passenger', { message: '   ' }],
    ['a message over 1000 characters', 'passenger', { message: 'x'.repeat(1001) }],
    ['a non-string message', 'passenger', { message: 42 }],
    ['a status other than open', 'passenger', { status: 'resolved' }],
    ['admin notes on create', 'passenger', { adminNotes: 'x' }],
    ['an extra field', 'passenger', { photoUrl: 'x' }],
    ['a client-chosen createdAt', 'passenger', { createdAt: Timestamp.now() }],
    ['a client-chosen updatedAt', 'passenger', { updatedAt: Timestamp.now() }],
  ];

  for (const [label, role, change] of invalid) {
    it(`denies ${label}`, async () => {
      await assertFails(report(role === 'passenger' ? PASSENGER : DRIVER, role, change));
    });
  }

  it('denies a missing field', async () => {
    const data = complaint(PASSENGER, 'passenger');
    delete data.category;
    await assertFails(setDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER)), data));
  });
});

describe('complaints: read', () => {
  beforeEach(() => seedComplaint());

  it('lets the reporter read their own report', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER))));
  });

  it("lets a user check for their own report that doesn't exist yet", async () => {
    const snapshot = await assertSucceeds(getDoc(doc(db(DRIVER), complaintPath(BOOKING, DRIVER))));
    if (snapshot.exists()) throw new Error('expected no report');
  });

  it("denies reading someone else's report, including the other party's", async () => {
    await assertFails(getDoc(doc(db(DRIVER), complaintPath(BOOKING, PASSENGER))));
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), complaintPath(BOOKING, PASSENGER))));
    await assertFails(getDoc(doc(db(null), complaintPath(BOOKING, PASSENGER))));
  });

  it('denies a uid that only appears inside the ID (suffix must be the whole uid)', async () => {
    // passenger1's ID ends in "_passenger1"; "senger1" must not match it.
    await assertFails(getDoc(doc(db('senger1'), complaintPath(BOOKING, PASSENGER))));
  });

  it('denies non-admins listing, even their own', async () => {
    await assertFails(getDocs(collection(db(PASSENGER), 'complaints')));
    await assertFails(getDocs(query(collection(db(PASSENGER), 'complaints'), where('reporterId', '==', PASSENGER))));
  });

  it('lets an admin read, list, filter and count', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER))));
    await assertSucceeds(getDocs(query(collection(adminDb(), 'complaints'), orderBy('createdAt', 'desc'), limit(200))));
    await assertSucceeds(
      getDocs(query(collection(adminDb(), 'complaints'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(200))),
    );
    const count = await assertSucceeds(
      getCountFromServer(query(collection(adminDb(), 'complaints'), where('status', '==', 'open'))),
    );
    if (count.data().count !== 1) throw new Error(`expected 1 open complaint, got ${count.data().count}`);
  });

  it('denies non-admins the admin counts', async () => {
    await assertFails(getCountFromServer(query(collection(db(PASSENGER), 'complaints'), where('status', '==', 'open'))));
    await assertFails(getCountFromServer(query(collection(db(ADMIN, { admin: false }), 'complaints'))));
  });
});

describe('complaints: admin review', () => {
  beforeEach(() => seedComplaint());

  it('lets an admin set the status and notes', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), review()));
    await assertSucceeds(
      updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), review({ status: 'resolved', adminNotes: '' })),
    );
    await assertSucceeds(updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), review({ status: 'open' })));
  });

  it('allows notes of exactly 1000 characters', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), review({ adminNotes: 'x'.repeat(1000) })),
    );
  });

  it('denies the reporter and the other party changing it', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER)), review({ updatedBy: PASSENGER })),
    );
    await assertFails(
      updateDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER)), {
        message: 'Edited.',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db(DRIVER), complaintPath(BOOKING, PASSENGER)), review({ updatedBy: DRIVER })));
  });

  const invalid: [string, DocumentData][] = [
    ['an unknown status', { status: 'closed' }],
    ['notes over 1000 characters', { adminNotes: 'x'.repeat(1001) }],
    ['non-string notes', { adminNotes: null }],
    ['a client-chosen updatedAt', { updatedAt: Timestamp.now() }],
    ['another updatedBy', { updatedBy: 'someoneElse' }],
    ['a changed message', { message: 'Rewritten by admin.' }],
    ['a changed category', { category: 'other' }],
    ['a changed reporter', { reporterId: DRIVER }],
    ['an extra field', { priority: 'high' }],
  ];

  for (const [label, change] of invalid) {
    it(`denies ${label}`, async () => {
      await assertFails(updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), review(change)));
    });
  }

  it('denies a review without notes', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER)), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies deleting, even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), complaintPath(BOOKING, PASSENGER))));
    await assertFails(deleteDoc(doc(db(PASSENGER), complaintPath(BOOKING, PASSENGER))));
  });
});

/// <reference types="node" />

// Firestore rules tests for the admin website's sidebar badges (admin/src/lib/adminCounts.ts:
// count() of pending payments, pending driver applications and open complaints) and the
// dashboard's queries (admin/src/dashboard/dashboard.ts: commission accounts, live driver
// and open-request counts, daily trips/fares/recorded commission, recent bookings with
// names, earnings ledger). Admins only. No rule changes: these use the existing admin
// reads. Run with `npm run test:rules`.
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
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  setLogLevel,
  sum,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';
const ADMIN = 'admin1';
const DRIVER = 'driver1';
const PASSENGER = 'passenger1';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Denied reads are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

/** The three badge queries, exactly as loadAdminCounts runs them. */
const BADGES: [string, string][] = [
  ['commissionPayments', 'pending'],
  ['driverApplications', 'pending'],
  ['complaints', 'open'],
];

function badgeCount(firestore: Firestore, [name, status]: [string, string]) {
  return getCountFromServer(query(collection(firestore, name), where('status', '==', status)));
}

function ago(ms: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - ms);
}

function fromNow(ms: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + ms);
}

// --- Dashboard queries, exactly as admin/src/dashboard/dashboard.ts runs them ---

/** Today, local midnight to the next: one day of the "Last 7 days" chart. */
function today(): { start: Timestamp; end: Timestamp } {
  const now = new Date();
  return {
    start: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
    end: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
  };
}

/** Live now: online, available, on a trip, recent pending standard, open out-of-area by type. */
const LIVE_QUERIES: ((firestore: Firestore) => Query)[] = [
  (f) => query(collection(f, 'drivers'), where('isOnline', '==', true)),
  (f) => query(collection(f, 'drivers'), where('isOnline', '==', true), where('isAvailable', '==', true)),
  (f) => query(collection(f, 'drivers'), where('currentBookingId', '!=', null)),
  (f) =>
    query(
      collection(f, 'bookings'),
      where('status', '==', 'pending'),
      where('updatedAt', '>=', ago(60 * MINUTE_MS)),
      orderBy('updatedAt', 'desc'),
    ),
  ...['tricycle', 'motorcycle'].map(
    (vehicleType) => (f: Firestore) =>
      query(
        collection(f, 'outOfAreaRequests'),
        where('status', '==', 'searching'),
        where('vehicleType', '==', vehicleType),
        where('expiresAt', '>', Timestamp.now()),
      ),
  ),
];

function bookingsToday(f: Firestore, status: 'completed' | 'cancelled') {
  const { start, end } = today();
  return query(
    collection(f, 'bookings'),
    where('status', '==', status),
    where('updatedAt', '>=', start),
    where('updatedAt', '<', end),
    orderBy('updatedAt', 'desc'),
  );
}

function completedToday(f: Firestore) {
  return getAggregateFromServer(bookingsToday(f, 'completed'), { trips: count(), fares: sum('finalFare') });
}

function cancelledToday(f: Firestore) {
  return getCountFromServer(bookingsToday(f, 'cancelled'));
}

function commissionToday(f: Firestore) {
  const { start, end } = today();
  return getAggregateFromServer(
    query(
      collection(f, 'commissions'),
      where('completedAt', '>=', start),
      where('completedAt', '<', end),
      orderBy('completedAt', 'desc'),
    ),
    { centavos: sum('amountCentavos') },
  );
}

function recentBookings(f: Firestore) {
  return getDocs(query(collection(f, 'bookings'), orderBy('createdAt', 'desc'), limit(8)));
}

function booking(overrides: DocumentData): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'completed',
    estimatedFare: 50,
    finalFare: 50,
    createdAt: ago(3 * MINUTE_MS),
    updatedAt: ago(2 * MINUTE_MS),
    ...overrides,
  };
}

function request(overrides: DocumentData): DocumentData {
  return { passengerId: PASSENGER, vehicleType: 'tricycle', status: 'searching', createdAt: ago(MINUTE_MS), ...overrides };
}

function account(driverId: string): DocumentData {
  return {
    driverId,
    accruedCentavos: 500,
    paidCentavos: 0,
    current: { seq: 1, startAt: ago(DAY_MS), periodDays: 7, graceDays: 3, startCentavos: 0 },
    unpaid: null,
  };
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
  const now = Timestamp.now();
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger', fullName: 'Ana Reyes' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    'commissionPayments/p1': { driverId: DRIVER, amountCentavos: 500, reference: '1234567890', status: 'pending', submittedAt: now },
    'commissionPayments/p2': { driverId: DRIVER, amountCentavos: 500, reference: '1234567891', status: 'confirmed', submittedAt: now },
    [`driverApplications/${PASSENGER}`]: { uid: PASSENGER, status: 'pending', submittedAt: now },
    [`complaints/booking1_${PASSENGER}`]: { bookingId: 'booking1', reporterId: PASSENGER, status: 'open', createdAt: now },
    [`complaints/booking2_${PASSENGER}`]: { bookingId: 'booking2', reporterId: PASSENGER, status: 'resolved', createdAt: now },
  });
});

describe('admin sidebar badges', () => {
  it('lets an admin count pending payments, pending applications and open complaints', async () => {
    const admin = db(ADMIN, { admin: true });
    for (const badge of BADGES) {
      const snapshot = await assertSucceeds(badgeCount(admin, badge));
      if (snapshot.data().count !== 1) throw new Error(`${badge[0]}: expected 1, got ${snapshot.data().count}`);
    }
  });

  it('denies the badge counts to drivers, passengers and signed-out users', async () => {
    for (const firestore of [db(DRIVER), db(PASSENGER), db(DRIVER, { admin: false }), db(null)]) {
      for (const badge of BADGES) await assertFails(badgeCount(firestore, badge));
    }
  });
});

describe('admin dashboard', () => {
  beforeEach(async () => {
    await seed({
      [`drivers/${DRIVER}`]: { fullName: 'Carlo Cruz', isVerified: true, isOnline: true, isAvailable: true, currentBookingId: null },
      'drivers/driver2': { fullName: 'Bella Uy', isVerified: true, isOnline: true, isAvailable: false, currentBookingId: 'b3' },
      'drivers/driver3': { fullName: 'Dino Lim', isVerified: true, isOnline: false, isAvailable: false, currentBookingId: null },
      'bookings/b1': booking({ finalFare: 34.2 }),
      'bookings/b2': booking({ status: 'cancelled', finalFare: null }),
      'bookings/b3': booking({ status: 'in_progress', driverId: 'driver2', finalFare: null }),
      'bookings/b4': booking({ status: 'pending', driverId: null, finalFare: null }),
      'bookings/stalePending': booking({ status: 'pending', driverId: null, finalFare: null, updatedAt: ago(120 * MINUTE_MS) }),
      'outOfAreaRequests/r1': request({ expiresAt: fromNow(20 * MINUTE_MS) }),
      'outOfAreaRequests/r2': request({ vehicleType: 'motorcycle', expiresAt: fromNow(20 * MINUTE_MS) }),
      'outOfAreaRequests/expired': request({ expiresAt: ago(MINUTE_MS) }),
      'outOfAreaRequests/cancelled': request({ status: 'cancelled', expiresAt: fromNow(20 * MINUTE_MS) }),
      'commissions/b1': {
        driverId: DRIVER,
        bookingId: 'b1',
        bookingType: 'standard',
        finalFare: 34.2,
        percentage: 10,
        amountCentavos: 342,
        periodSeq: 1,
        completedAt: ago(2 * MINUTE_MS),
      },
      [`commissionAccounts/${DRIVER}`]: account(DRIVER),
      'commissionAccounts/driver2': account('driver2'),
      'earningsLedger/totals': { collectedCentavos: 1500, cashedOutCentavos: 500 },
    });
  });

  it('lets an admin count live drivers and open requests', async () => {
    const admin = db(ADMIN, { admin: true });
    const counts: number[] = [];
    for (const build of LIVE_QUERIES) counts.push((await assertSucceeds(getCountFromServer(build(admin)))).data().count);
    // online, available, on a trip, recent pending standard, open tricycle, open motorcycle
    if (counts.join(',') !== '2,1,1,1,1,1') throw new Error(`expected 2,1,1,1,1,1, got ${counts.join(',')}`);
  });

  it("lets an admin load a day's trips, fares, cancellations and recorded commission", async () => {
    const admin = db(ADMIN, { admin: true });
    const done = (await assertSucceeds(completedToday(admin))).data();
    const cancelled = (await assertSucceeds(cancelledToday(admin))).data().count;
    const { centavos } = (await assertSucceeds(commissionToday(admin))).data();
    // Seeded 2 minutes ago, so they are today's unless the test runs just after midnight.
    const sameDay = new Date(Date.now() - 2 * MINUTE_MS).getDate() === new Date().getDate();
    if (sameDay && (done.trips !== 1 || done.fares !== 34.2 || cancelled !== 1 || centavos !== 342)) {
      throw new Error(`unexpected day: ${done.trips} trips, ${done.fares} fares, ${cancelled} cancelled, ${centavos} centavos`);
    }
  });

  it('lets an admin read recent bookings with names, commission accounts and the ledger', async () => {
    const admin = db(ADMIN, { admin: true });
    const recent = await assertSucceeds(recentBookings(admin));
    if (recent.size !== 5) throw new Error(`expected 5 recent bookings, got ${recent.size}`);
    await assertSucceeds(getDoc(doc(admin, 'users', PASSENGER)));
    await assertSucceeds(getDoc(doc(admin, 'drivers', DRIVER)));
    const accounts = await assertSucceeds(getDocs(collection(admin, 'commissionAccounts')));
    if (accounts.size !== 2) throw new Error(`expected 2 commission accounts, got ${accounts.size}`);
    await assertSucceeds(getDoc(doc(admin, 'earningsLedger', 'totals')));
  });

  it('denies the dashboard queries to drivers, passengers and signed-out users', async () => {
    for (const firestore of [db(DRIVER), db(PASSENGER), db(DRIVER, { admin: false }), db(null)]) {
      for (const build of LIVE_QUERIES) await assertFails(getCountFromServer(build(firestore)));
      await assertFails(completedToday(firestore));
      await assertFails(cancelledToday(firestore));
      await assertFails(commissionToday(firestore));
      await assertFails(recentBookings(firestore));
      await assertFails(getDocs(collection(firestore, 'commissionAccounts')));
      await assertFails(getDoc(doc(firestore, 'earningsLedger', 'totals')));
    }
  });
});

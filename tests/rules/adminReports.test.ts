/// <reference types="node" />

// Firestore rules tests for the Admin Website Reports page: the exact count/sum aggregate
// queries it runs (admin/src/reports/reports.ts) are allowed for admins (custom claim
// `admin: true`) and denied for everyone else. No rule was added for Reports; these pin
// the existing admin read rules to the queries.
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
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  orderBy,
  query,
  setDoc,
  setLogLevel,
  sum,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';

const DAY_MS = 24 * 60 * 60 * 1000;

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

function booking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'completed',
    estimatedFare: 50,
    finalFare: 50,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    ...overrides,
  };
}

// The last 7 days, as the Reports page passes a range.
const RANGE = { start: new Date(Date.now() - 7 * DAY_MS), end: new Date(Date.now() + DAY_MS) };

function inRange(field: string): QueryConstraint[] {
  return [
    where(field, '>=', Timestamp.fromDate(RANGE.start)),
    where(field, '<', Timestamp.fromDate(RANGE.end)),
    orderBy(field, 'desc'),
  ];
}

function completedQuery(firestore: Firestore, bookingType?: string) {
  return query(
    collection(firestore, 'bookings'),
    ...(bookingType ? [where('bookingType', '==', bookingType)] : []),
    where('status', '==', 'completed'),
    ...inRange('updatedAt'),
  );
}

function completedAggregate(firestore: Firestore, bookingType?: string) {
  return getAggregateFromServer(completedQuery(firestore, bookingType), { trips: count(), fares: sum('finalFare') });
}

function cancelledCount(firestore: Firestore) {
  return getCountFromServer(
    query(collection(firestore, 'bookings'), where('status', '==', 'cancelled'), ...inRange('updatedAt')),
  );
}

function requestsCount(firestore: Firestore) {
  return getCountFromServer(query(collection(firestore, 'outOfAreaRequests'), ...inRange('createdAt')));
}

function newPassengersCount(firestore: Firestore) {
  return getCountFromServer(query(collection(firestore, 'users'), where('role', '==', 'passenger'), ...inRange('createdAt')));
}

function verifiedDriversCount(firestore: Firestore) {
  return getCountFromServer(query(collection(firestore, 'drivers'), where('isVerified', '==', true)));
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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    const docs: Record<string, DocumentData> = {
      [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger', createdAt: daysAgo(3) },
      'users/oldPassenger': { uid: 'oldPassenger', role: 'passenger', createdAt: daysAgo(30) },
      [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver', createdAt: daysAgo(3) },
      [`drivers/${DRIVER}`]: { isVerified: true, vehicleType: 'tricycle', currentBookingId: null },
      'drivers/revoked': { isVerified: false, vehicleType: 'tricycle', currentBookingId: null },
      'bookings/b1': booking({ finalFare: 34.2 }),
      'bookings/b2': booking({ finalFare: 39.8, updatedAt: daysAgo(1) }),
      'bookings/b3': booking({ bookingType: 'out_of_area', finalFare: 115 }),
      'bookings/b4': booking({ status: 'cancelled', finalFare: null }),
      'bookings/old': booking({ finalFare: 999, updatedAt: daysAgo(20) }),
      'outOfAreaRequests/r1': { passengerId: PASSENGER, status: 'cancelled', createdAt: daysAgo(1) },
      'outOfAreaRequests/old': { passengerId: PASSENGER, status: 'cancelled', createdAt: daysAgo(20) },
      'commissionSettings/active': { percentage: 10, paymentPeriodDays: 7, gracePeriodDays: 3 },
    };
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
});

describe('admin reports: aggregates an admin can run', () => {
  it('counts and sums completed trips in the range (overall and by type)', async () => {
    const overall = (await assertSucceeds(completedAggregate(adminDb()))).data();
    if (overall.trips !== 3 || Math.round(overall.fares * 100) !== 18900) {
      throw new Error(`expected 3 trips / 189.00, got ${overall.trips} / ${overall.fares}`);
    }
    const standard = (await assertSucceeds(completedAggregate(adminDb(), 'standard'))).data();
    const outOfArea = (await assertSucceeds(completedAggregate(adminDb(), 'out_of_area'))).data();
    if (standard.trips !== 2 || outOfArea.trips !== 1 || outOfArea.fares !== 115) {
      throw new Error(`unexpected split: ${standard.trips} standard, ${outOfArea.trips} out-of-area`);
    }
  });

  it('counts cancelled bookings, out-of-area requests, new passengers and verified drivers', async () => {
    const results = [
      (await assertSucceeds(cancelledCount(adminDb()))).data().count,
      (await assertSucceeds(requestsCount(adminDb()))).data().count,
      (await assertSucceeds(newPassengersCount(adminDb()))).data().count,
      (await assertSucceeds(verifiedDriversCount(adminDb()))).data().count,
    ];
    if (results.join(',') !== '1,1,1,1') throw new Error(`expected 1,1,1,1, got ${results.join(',')}`);
  });

  it('reads the commission rate', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'commissionSettings', 'active')));
  });
});

describe('admin reports: denied for everyone else', () => {
  const others: [string, () => Firestore][] = [
    ['an account without the claim', () => db(ADMIN)],
    ['admin: false', () => db(ADMIN, { admin: false })],
    ['a passenger', () => db(PASSENGER)],
    ['a driver', () => db(DRIVER)],
    ['a signed-out visitor', () => db(null)],
  ];

  for (const [label, firestore] of others) {
    it(`denies ${label} every report aggregate`, async () => {
      await assertFails(completedAggregate(firestore()));
      await assertFails(completedAggregate(firestore(), 'out_of_area'));
      await assertFails(cancelledCount(firestore()));
      await assertFails(requestsCount(firestore()));
      await assertFails(newPassengersCount(firestore()));
      // Drivers read the commission percentage they are charged (commissionSettings.test.ts).
      if (label !== 'a driver') {
        await assertFails(getDoc(doc(firestore(), 'commissionSettings', 'active')));
      }
    });
  }

  it('lets a driver read only the commission settings, not the report aggregates', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'commissionSettings', 'active')));
  });

  it('leaves the verified-drivers count to the existing driver read rule', async () => {
    // Signed-in users may already list verified drivers (passenger driver search), so the
    // count is not admin-only; signed-out visitors are still denied.
    await assertSucceeds(verifiedDriversCount(db(PASSENGER)));
    await assertFails(verifiedDriversCount(db(null)));
  });
});

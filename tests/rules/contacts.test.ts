/// <reference types="node" />

// Firestore rules tests for contacts/{uid}: owner-written cards equal to users/{uid},
// readable by the other party only during an active trip (accepted, arrived, in progress)
// between the booking's passenger and its assigned driver (drivers/{uid}.currentBookingId).
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
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const OTHER_DRIVER = 'driver2';
const BOOKING = 'booking1';
const OTHER_BOOKING = 'booking2';

let testEnv: RulesTestEnvironment;

function db(uid: string | null): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function user(uid: string, role: string, fullName: string, mobileNumber: string): DocumentData {
  return { uid, role, fullName, mobileNumber, email: `${uid}@example.com` };
}

const USERS: Record<string, DocumentData> = {
  [PASSENGER]: user(PASSENGER, 'passenger', 'Maria Santos', '+639171234567'),
  [OTHER_PASSENGER]: user(OTHER_PASSENGER, 'passenger', 'Jose Cruz', '+639181234567'),
  [DRIVER]: user(DRIVER, 'driver', 'Pedro Reyes', '+639191234567'),
  [OTHER_DRIVER]: user(OTHER_DRIVER, 'driver', 'Ana Lim', '+639201234567'),
};

function card(uid: string): DocumentData {
  return {
    fullName: USERS[uid].fullName,
    mobileNumber: USERS[uid].mobileNumber,
    updatedAt: Timestamp.now(),
  };
}

function driverRecord(overrides: DocumentData = {}): DocumentData {
  return {
    isVerified: true,
    isOnline: true,
    isAvailable: false,
    vehicleType: 'tricycle',
    currentBookingId: null,
    currentRequestId: null,
    ...overrides,
  };
}

function booking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'accepted',
    ...overrides,
  };
}

/** Writes documents with rules disabled (test fixtures). */
async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

/** BOOKING between PASSENGER and DRIVER in `status`, DRIVER linked to it unless `linked` is false. */
async function seedTrip(status: string, options: { linked?: boolean; extra?: DocumentData } = {}) {
  const { linked = true, extra = {} } = options;
  await seed({
    [`bookings/${BOOKING}`]: booking({ status, ...extra }),
    [`drivers/${DRIVER}`]: driverRecord({ currentBookingId: linked ? BOOKING : null }),
  });
}

function readCard(reader: string | null, owner: string) {
  return getDoc(doc(db(reader), 'contacts', owner));
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
  const docs: Record<string, DocumentData> = {
    [`drivers/${DRIVER}`]: driverRecord(),
    [`drivers/${OTHER_DRIVER}`]: driverRecord({ isAvailable: true }),
  };
  for (const uid of Object.keys(USERS)) {
    docs[`users/${uid}`] = USERS[uid];
    docs[`contacts/${uid}`] = card(uid);
  }
  await seed(docs);
});

describe('contacts: owner writes', () => {
  function ownCard(uid: string, overrides: DocumentData = {}): DocumentData {
    return {
      fullName: USERS[uid].fullName,
      mobileNumber: USERS[uid].mobileNumber,
      updatedAt: serverTimestamp(),
      ...overrides,
    };
  }

  it('allows the owner to read their own card', async () => {
    await assertSucceeds(readCard(PASSENGER, PASSENGER));
  });

  it('allows the owner to write a card equal to their profile', async () => {
    await assertSucceeds(setDoc(doc(db(PASSENGER), 'contacts', PASSENGER), ownCard(PASSENGER)));
    await assertSucceeds(setDoc(doc(db(DRIVER), 'contacts', DRIVER), ownCard(DRIVER)));
  });

  it('allows creating a missing card (backfill)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore() as unknown as Firestore, 'contacts', PASSENGER));
    });
    await assertSucceeds(setDoc(doc(db(PASSENGER), 'contacts', PASSENGER), ownCard(PASSENGER)));
  });

  const badCards: [string, DocumentData][] = [
    ['a different name', { fullName: 'Someone Else' }],
    ['a different number', { mobileNumber: '+639999999999' }],
    ['an extra field', { email: 'leak@example.com' }],
    ['a client-chosen updatedAt', { updatedAt: Timestamp.now() }],
  ];

  for (const [label, overrides] of badCards) {
    it(`denies a card with ${label}`, async () => {
      await assertFails(
        setDoc(doc(db(PASSENGER), 'contacts', PASSENGER), ownCard(PASSENGER, overrides)),
      );
    });
  }

  it("denies writing someone else's card", async () => {
    await assertFails(setDoc(doc(db(DRIVER), 'contacts', PASSENGER), ownCard(PASSENGER)));
  });

  it('denies deleting a card', async () => {
    await assertFails(deleteDoc(doc(db(PASSENGER), 'contacts', PASSENGER)));
  });

  it('allows a profile edit that updates users and the card in one batch', async () => {
    const firestore = db(PASSENGER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'users', PASSENGER), {
      fullName: 'Maria S. Santos',
      mobileNumber: '+639170000000',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, 'contacts', PASSENGER), {
      fullName: 'Maria S. Santos',
      mobileNumber: '+639170000000',
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('denies a card that does not match the profile edit in the same batch', async () => {
    const firestore = db(PASSENGER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'users', PASSENGER), {
      mobileNumber: '+639170000000',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, 'contacts', PASSENGER), ownCard(PASSENGER));
    await assertFails(batch.commit());
  });

  it('denies signed-out users', async () => {
    await assertFails(readCard(null, PASSENGER));
  });
});

describe('contacts: reads during an active trip', () => {
  for (const status of ['accepted', 'arrived', 'in_progress']) {
    it(`allows the assigned driver to read the passenger's card while ${status}`, async () => {
      await seedTrip(status);
      await assertSucceeds(readCard(DRIVER, PASSENGER));
    });

    it(`allows the passenger to read the assigned driver's card while ${status}`, async () => {
      await seedTrip(status);
      await assertSucceeds(readCard(PASSENGER, DRIVER));
    });
  }

  it('allows both parties on a claimed out-of-area booking', async () => {
    await seedTrip('accepted', { extra: { bookingType: 'out_of_area' } });
    await assertSucceeds(readCard(DRIVER, PASSENGER));
    await assertSucceeds(readCard(PASSENGER, DRIVER));
  });
});

describe('contacts: reads denied outside an active trip', () => {
  it('denies any driver while the booking is pending (including drivers browsing it)', async () => {
    await seed({ [`bookings/${BOOKING}`]: booking({ status: 'pending', driverId: null }) });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(OTHER_DRIVER, PASSENGER));
  });

  it('denies the reserved out-of-area driver before the claim', async () => {
    await seed({
      [`bookings/${BOOKING}`]: booking({
        status: 'pending',
        driverId: null,
        bookingType: 'out_of_area',
      }),
      [`drivers/${DRIVER}`]: driverRecord({ currentRequestId: BOOKING }),
    });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, DRIVER));
  });

  it('denies another driver during the trip', async () => {
    await seedTrip('accepted');
    await assertFails(readCard(OTHER_DRIVER, PASSENGER));
  });

  it('denies another driver on their own trip with someone else', async () => {
    await seedTrip('accepted');
    await seed({
      [`bookings/${OTHER_BOOKING}`]: booking({
        passengerId: OTHER_PASSENGER,
        driverId: OTHER_DRIVER,
      }),
      [`drivers/${OTHER_DRIVER}`]: driverRecord({ currentBookingId: OTHER_BOOKING }),
    });
    await assertFails(readCard(OTHER_DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, OTHER_DRIVER));
  });

  it("denies another passenger reading the driver's card", async () => {
    await seedTrip('accepted');
    await assertFails(readCard(OTHER_PASSENGER, DRIVER));
  });

  it("denies the driver another passenger's card", async () => {
    await seedTrip('accepted');
    await assertFails(readCard(DRIVER, OTHER_PASSENGER));
  });

  it("denies a passenger reading another passenger's card", async () => {
    await seedTrip('accepted');
    await assertFails(readCard(PASSENGER, OTHER_PASSENGER));
  });

  it('denies both parties once the trip is completed (link cleared)', async () => {
    await seedTrip('completed', { linked: false });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, DRIVER));
  });

  it('denies both parties after a passenger cancel, while the link is still set', async () => {
    await seedTrip('cancelled', { extra: { cancelledBy: 'passenger' } });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, DRIVER));
  });

  it('denies both parties after a driver cancel', async () => {
    await seedTrip('cancelled', { linked: false, extra: { cancelledBy: 'driver' } });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, DRIVER));
  });

  it('denies a driver whose currentBookingId points at a different booking', async () => {
    await seed({
      [`bookings/${BOOKING}`]: booking({ status: 'accepted' }),
      [`bookings/${OTHER_BOOKING}`]: booking({ passengerId: OTHER_PASSENGER }),
      [`drivers/${DRIVER}`]: driverRecord({ currentBookingId: OTHER_BOOKING }),
    });
    await assertFails(readCard(DRIVER, PASSENGER));
    await assertFails(readCard(PASSENGER, DRIVER));
  });

  it('denies a signed-out user during the trip', async () => {
    await seedTrip('accepted');
    await assertFails(readCard(null, PASSENGER));
    await assertFails(readCard(null, DRIVER));
  });
});

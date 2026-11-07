/// <reference types="node" />

// Firestore rules tests for privacy: consent at registration and re-consent
// (users/{uid}.legalConsent + the create-only log users/{uid}/legalConsents/{version}),
// account deletion requests (deletionRequests/{uid}), the admin's one-commit anonymization
// of users, contacts, drivers and driverApplications, and the Privacy Notice acknowledgement
// on driver applications.
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
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

// The admin website's exact write payloads (no Firebase imports, so Node loads it directly).
import {
  anonymizedApplicationUpdate,
  anonymizedDriverUpdate,
  anonymizedUserUpdate,
  authDeletedUpdate,
  completedRequestUpdate,
  declinedRequestUpdate,
} from '../../admin/src/privacy/deletionPlan.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

/** Must equal currentLegalVersion() in firestore.rules (tests/legal/legalRulesSync.test.ts). */
const VERSION = '1.0';

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const APPLICANT = 'applicant1';
const NEW_USER = 'newuser1';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function userProfile(uid: string, role: string, fullName: string, mobileNumber: string): DocumentData {
  return {
    uid,
    role,
    fullName,
    mobileNumber,
    email: `${uid}@example.com`,
    profileImage: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

const USERS: Record<string, DocumentData> = {
  [PASSENGER]: userProfile(PASSENGER, 'passenger', 'Maria Santos', '+639171234567'),
  [OTHER_PASSENGER]: userProfile(OTHER_PASSENGER, 'passenger', 'Jose Cruz', '+639181234567'),
  [DRIVER]: userProfile(DRIVER, 'driver', 'Pedro Reyes', '+639191234567'),
  [APPLICANT]: userProfile(APPLICANT, 'passenger', 'Juan Dela Cruz', '+639201234567'),
};

function card(uid: string): DocumentData {
  return { fullName: USERS[uid].fullName, mobileNumber: USERS[uid].mobileNumber, updatedAt: Timestamp.now() };
}

function driverRecord(overrides: DocumentData = {}): DocumentData {
  return {
    fullName: 'Pedro Reyes',
    vehiclePlate: 'ABC 1234',
    vehicleType: 'tricycle',
    vehicleBrand: 'Honda',
    vehicleModel: 'TMX 155',
    vehicleColor: 'Red',
    isVerified: true,
    isOnline: true,
    isAvailable: true,
    currentLocation: { latitude: 11.0, longitude: 124.0 },
    currentBookingId: null,
    currentRequestId: null,
    verificationNote: null,
    rating: 0,
    profileImage: null,
    ...overrides,
  };
}

function storageDoc(uid: string, type: string): DocumentData {
  return {
    storagePath: `driverApplications/${uid}/${type}`,
    downloadUrl: `https://firebasestorage.googleapis.com/v0/b/demo/o/${type}`,
    fileName: `${type}.jpg`,
    contentType: 'image/jpeg',
    uploadedAt: Timestamp.now(),
  };
}

function application(uid: string, overrides: DocumentData = {}): DocumentData {
  return {
    uid,
    firstName: 'Juan',
    middleName: null,
    lastName: 'Dela Cruz',
    fullName: 'Juan Dela Cruz',
    email: `${uid}@example.com`,
    mobileNumber: USERS[uid].mobileNumber,
    vehicleType: 'tricycle',
    vehiclePlate: 'XYZ 9876',
    vehicleBrand: 'Honda',
    vehicleModel: 'TMX 155',
    vehicleColor: 'Red',
    documents: { orCr: storageDoc(uid, 'orCr'), ltoLicense: storageDoc(uid, 'ltoLicense') },
    status: 'pending',
    adminRemarks: null,
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    reviewedAt: null,
    privacyNoticeVersion: VERSION,
    privacyNoticeAcknowledgedAt: Timestamp.now(),
    ...overrides,
  };
}

function pendingRequest(uid: string, overrides: DocumentData = {}): DocumentData {
  return { uid, status: 'pending', requestedAt: Timestamp.now(), reason: null, ...overrides };
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

/** A copy of data without the given keys (Firestore rejects undefined values). */
function without(data: DocumentData, ...keys: string[]): DocumentData {
  const copy = { ...data };
  for (const key of keys) delete copy[key];
  return copy;
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
  const docs: Record<string, DocumentData> = { [`drivers/${DRIVER}`]: driverRecord() };
  for (const uid of Object.keys(USERS)) {
    docs[`users/${uid}`] = USERS[uid];
    docs[`contacts/${uid}`] = card(uid);
  }
  await seed(docs);
});

// ─── Consent ──────────────────────────────────────────────────────────────

/** legalConsent as the app writes it (server time). */
function consent(overrides: DocumentData = {}): DocumentData {
  return { version: VERSION, acceptedAt: serverTimestamp(), ...overrides };
}

function logEntry(overrides: DocumentData = {}): DocumentData {
  return { version: VERSION, acceptedAt: serverTimestamp(), ...overrides };
}

function newProfile(overrides: DocumentData = {}): DocumentData {
  return {
    uid: NEW_USER,
    role: 'passenger',
    email: `${NEW_USER}@example.com`,
    fullName: 'Liza Ramos',
    mobileNumber: '+639211234567',
    profileImage: null, // as authService.createPassengerProfile writes it
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Registration like the app: the profile with consent and its log entry in one batch. */
function register(
  options: { profile?: DocumentData; log?: DocumentData | null; logVersion?: string } = {},
) {
  const firestore = db(NEW_USER);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'users', NEW_USER), options.profile ?? newProfile({ legalConsent: consent() }));
  if (options.log !== null) {
    batch.set(
      doc(firestore, 'users', NEW_USER, 'legalConsents', options.logVersion ?? VERSION),
      options.log ?? logEntry(),
    );
  }
  return batch.commit();
}

/** Re-consent like the app: legalConsent + updatedAt and the log entry in one batch. */
function reconsent(
  uid: string,
  options: { update?: DocumentData; log?: DocumentData | null; logVersion?: string } = {},
) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'users', uid), options.update ?? { legalConsent: consent(), updatedAt: serverTimestamp() });
  if (options.log !== null) {
    batch.set(doc(firestore, 'users', uid, 'legalConsents', options.logVersion ?? VERSION), options.log ?? logEntry());
  }
  return batch.commit();
}

describe('privacy: consent at registration', () => {
  it('allows registering with consent and its log entry in one batch', async () => {
    await assertSucceeds(register());
  });

  it('allows registering without consent (accepted later on the re-consent screen)', async () => {
    await assertSucceeds(setDoc(doc(db(NEW_USER), 'users', NEW_USER), newProfile()));
  });

  it('denies consent without its log entry', async () => {
    await assertFails(register({ log: null }));
  });

  const badConsents: [string, DocumentData][] = [
    ['an old version', consent({ version: '0.9' })],
    ['a future version', consent({ version: '1.1' })],
    ['a client-chosen time', consent({ acceptedAt: Timestamp.now() })],
    ['an extra field', consent({ ip: '1.2.3.4' })],
  ];

  for (const [label, legalConsent] of badConsents) {
    it(`denies consent with ${label}`, async () => {
      await assertFails(register({ profile: newProfile({ legalConsent }) }));
    });
  }

  it('denies a consent that is not a map', async () => {
    await assertFails(register({ profile: newProfile({ legalConsent: VERSION }) }));
  });

  it('denies registering an already anonymized profile', async () => {
    await assertFails(
      register({ profile: newProfile({ legalConsent: consent(), anonymizedAt: serverTimestamp() }) }),
    );
  });
});

describe('privacy: re-consent', () => {
  it('allows a passenger to accept the current version', async () => {
    await assertSucceeds(reconsent(PASSENGER));
    const snap = await getDoc(doc(db(PASSENGER), 'users', PASSENGER, 'legalConsents', VERSION));
    if (snap.data()?.version !== VERSION) throw new Error('consent log entry missing');
  });

  it('allows a driver account to accept the current version', async () => {
    await assertSucceeds(reconsent(DRIVER));
  });

  it('denies accepting the same version twice (one log entry per version)', async () => {
    await assertSucceeds(reconsent(PASSENGER));
    await assertFails(reconsent(PASSENGER));
  });

  it('denies re-consent without the log entry', async () => {
    await assertFails(reconsent(PASSENGER, { log: null }));
  });

  it('denies re-consent without updatedAt at server time', async () => {
    await assertFails(reconsent(PASSENGER, { update: { legalConsent: consent() } }));
    await assertFails(reconsent(PASSENGER, { update: { legalConsent: consent(), updatedAt: Timestamp.now() } }));
  });

  it('denies changing other profile fields with the consent', async () => {
    await assertFails(
      reconsent(PASSENGER, {
        update: { legalConsent: consent(), updatedAt: serverTimestamp(), fullName: 'Maria S.' },
      }),
    );
    await assertFails(
      reconsent(DRIVER, {
        update: { legalConsent: consent(), updatedAt: serverTimestamp(), role: 'passenger' },
      }),
    );
  });

  it("denies accepting for someone else", async () => {
    const firestore = db(OTHER_PASSENGER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'users', PASSENGER), { legalConsent: consent(), updatedAt: serverTimestamp() });
    batch.set(doc(firestore, 'users', PASSENGER, 'legalConsents', VERSION), logEntry());
    await assertFails(batch.commit());
  });

  it('denies a passenger profile edit that touches legalConsent', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'users', PASSENGER), { legalConsent: null, updatedAt: serverTimestamp() }),
    );
  });

  it('still allows an ordinary passenger profile edit', async () => {
    await assertSucceeds(
      updateDoc(doc(db(PASSENGER), 'users', PASSENGER), { fullName: 'Maria S. Santos', updatedAt: serverTimestamp() }),
    );
  });

  it('denies re-consent on an anonymized account', async () => {
    await seed({ [`users/${PASSENGER}`]: { ...USERS[PASSENGER], anonymizedAt: Timestamp.now() } });
    await assertFails(reconsent(PASSENGER));
  });
});

describe('privacy: consent log', () => {
  it('denies a log entry without the matching legalConsent', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'users', PASSENGER, 'legalConsents', VERSION), logEntry()));
  });

  it('denies a log entry for another version', async () => {
    await assertFails(reconsent(PASSENGER, { logVersion: '0.9', log: logEntry({ version: '0.9' }) }));
  });

  it('denies a log entry whose version differs from its id', async () => {
    await assertFails(reconsent(PASSENGER, { log: logEntry({ version: '0.9' }) }));
  });

  it('denies a log entry with a client-chosen time or extra field', async () => {
    await assertFails(reconsent(PASSENGER, { log: logEntry({ acceptedAt: Timestamp.now() }) }));
    await assertFails(reconsent(PASSENGER, { log: logEntry({ device: 'Android' }) }));
  });

  it('never allows changing or deleting a log entry (owner or admin)', async () => {
    await assertSucceeds(reconsent(PASSENGER));
    const path = ['users', PASSENGER, 'legalConsents', VERSION] as const;
    await assertFails(updateDoc(doc(db(PASSENGER), ...path), { acceptedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(PASSENGER), ...path)));
    await assertFails(deleteDoc(doc(adminDb(), ...path)));
  });

  it('lets the owner and admins read the log, nobody else', async () => {
    await assertSucceeds(reconsent(PASSENGER));
    const path = ['users', PASSENGER, 'legalConsents', VERSION] as const;
    await assertSucceeds(getDoc(doc(db(PASSENGER), ...path)));
    await assertSucceeds(getDoc(doc(adminDb(), ...path)));
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), ...path)));
    await assertFails(getDoc(doc(db(null), ...path)));
  });
});

// ─── Deletion requests ────────────────────────────────────────────────────

function requestDeletion(uid: string, overrides: DocumentData = {}, asUid: string = uid) {
  return setDoc(doc(db(asUid), 'deletionRequests', uid), {
    uid,
    status: 'pending',
    requestedAt: serverTimestamp(),
    ...overrides,
  });
}

describe('privacy: deletion requests (user)', () => {
  it('allows asking for deletion, with or without a reason', async () => {
    await assertSucceeds(requestDeletion(PASSENGER));
    await assertSucceeds(requestDeletion(DRIVER, { reason: 'I moved away.' }));
    await assertSucceeds(requestDeletion(OTHER_PASSENGER, { reason: null }));
  });

  it('allows a reason of 500 characters, not 501', async () => {
    await assertSucceeds(requestDeletion(PASSENGER, { reason: 'x'.repeat(500) }));
    await assertFails(requestDeletion(OTHER_PASSENGER, { reason: 'x'.repeat(501) }));
  });

  const badRequests: [string, DocumentData][] = [
    ['status completed', { status: 'completed' }],
    ['a client-chosen time', { requestedAt: Timestamp.now() }],
    ['a reason that is not text', { reason: 42 }],
    ['an extra field', { completedBy: PASSENGER }],
    ['another uid', { uid: OTHER_PASSENGER }],
  ];

  for (const [label, overrides] of badRequests) {
    it(`denies a request with ${label}`, async () => {
      await assertFails(requestDeletion(PASSENGER, overrides));
    });
  }

  it("denies asking for someone else's deletion", async () => {
    await assertFails(requestDeletion(PASSENGER, {}, OTHER_PASSENGER));
  });

  it('denies asking again after the account was anonymized', async () => {
    await seed({ [`users/${PASSENGER}`]: { ...USERS[PASSENGER], anonymizedAt: Timestamp.now() } });
    await assertFails(requestDeletion(PASSENGER));
  });

  it('lets the owner and admins read a request, nobody else', async () => {
    await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER)));
    await assertSucceeds(getDoc(doc(adminDb(), 'deletionRequests', PASSENGER)));
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'deletionRequests', PASSENGER)));
  });

  it('allows withdrawing a pending request, not a completed one', async () => {
    await seed({
      [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER),
      [`deletionRequests/${DRIVER}`]: pendingRequest(DRIVER, { status: 'completed' }),
    });
    await assertSucceeds(deleteDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER)));
    await assertFails(deleteDoc(doc(db(DRIVER), 'deletionRequests', DRIVER)));
  });

  it('denies the owner changing a request or overwriting it', async () => {
    await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
    await assertFails(updateDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER), { reason: 'changed' }));
    await assertFails(requestDeletion(PASSENGER));
  });

  it('denies an admin completing a request without anonymizing the account', async () => {
    await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
    await assertFails(
      updateDoc(doc(adminDb(), 'deletionRequests', PASSENGER), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: ADMIN,
      }),
    );
  });
});

// ─── Anonymization (account deletion by an admin) ─────────────────────────

const DELETED = 'Deleted user';

function anonymizedUser(): DocumentData {
  return {
    fullName: DELETED,
    email: '',
    mobileNumber: '',
    profileImage: null,
    anonymizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function anonymizedDriver(): DocumentData {
  return {
    fullName: DELETED,
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    isVerified: false,
    isOnline: false,
    isAvailable: false,
    currentLocation: null,
    verificationNote: null,
    verificationUpdatedAt: serverTimestamp(),
    verificationUpdatedBy: ADMIN,
    anonymizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function anonymizedApplication(): DocumentData {
  return {
    firstName: '',
    middleName: null,
    lastName: '',
    fullName: DELETED,
    email: '',
    mobileNumber: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    documents: null,
    adminRemarks: null,
    anonymizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function completedRequest(): DocumentData {
  return { status: 'completed', completedAt: serverTimestamp(), completedBy: ADMIN };
}

interface AnonymizeParts {
  user?: DocumentData | null;
  contact?: boolean;
  driver?: DocumentData | null;
  application?: DocumentData | null;
  request?: DocumentData | null;
}

/**
 * The admin website's account deletion: one batch. Each part defaults to the correct write;
 * null leaves it out (contact: false keeps the card).
 */
function anonymize(uid: string, parts: AnonymizeParts = {}, firestore: Firestore = adminDb()) {
  const batch = writeBatch(firestore);
  if (parts.user !== null) batch.update(doc(firestore, 'users', uid), parts.user ?? anonymizedUser());
  if (parts.contact !== false) batch.delete(doc(firestore, 'contacts', uid));
  if (parts.driver) batch.update(doc(firestore, 'drivers', uid), parts.driver);
  if (parts.application) batch.update(doc(firestore, 'driverApplications', uid), parts.application);
  if (parts.request) batch.update(doc(firestore, 'deletionRequests', uid), parts.request);
  return batch.commit();
}

/** A passenger account without driver records. */
async function seedPassengerRequest() {
  await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
}

describe('privacy: anonymizing a passenger', () => {
  it('allows the full deletion: profile, card and request in one commit', async () => {
    await seedPassengerRequest();
    await assertSucceeds(anonymize(PASSENGER, { request: completedRequest() }));
  });

  it('allows a deletion without a request (asked another way)', async () => {
    await assertSucceeds(anonymize(PASSENGER));
  });

  it('allows a deletion when the contact card never existed', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore() as unknown as Firestore, 'contacts', PASSENGER));
    });
    await assertSucceeds(anonymize(PASSENGER, { contact: false }));
  });

  it('keeps the consent record (legalConsent and the log stay)', async () => {
    await assertSucceeds(reconsent(PASSENGER));
    await assertSucceeds(anonymize(PASSENGER));
    await assertSucceeds(getDoc(doc(adminDb(), 'users', PASSENGER, 'legalConsents', VERSION)));
  });

  it('denies leaving the contact card', async () => {
    await assertFails(anonymize(PASSENGER, { contact: false }));
  });

  it('denies leaving a pending request pending', async () => {
    await seedPassengerRequest();
    await assertFails(anonymize(PASSENGER));
  });

  it('denies completing the request with a client time or for another admin', async () => {
    await seedPassengerRequest();
    await assertFails(anonymize(PASSENGER, { request: { ...completedRequest(), completedAt: Timestamp.now() } }));
    await assertFails(anonymize(PASSENGER, { request: { ...completedRequest(), completedBy: 'admin2' } }));
  });

  const badUsers: [string, DocumentData][] = [
    ['the name kept', without(anonymizedUser(), 'fullName')],
    ['the email kept', without(anonymizedUser(), 'email')],
    ['the mobile number kept', without(anonymizedUser(), 'mobileNumber')],
    ['the photo kept', { ...anonymizedUser(), profileImage: 'https://example.com/me.jpg' }],
    ['another placeholder name', { ...anonymizedUser(), fullName: 'Removed' }],
    ['a client-chosen time', { ...anonymizedUser(), anonymizedAt: Timestamp.now() }],
    ['the role changed', { ...anonymizedUser(), role: 'driver' }],
    ['the consent removed', { ...anonymizedUser(), legalConsent: null }],
  ];

  for (const [label, user] of badUsers) {
    it(`denies an anonymization with ${label}`, async () => {
      await assertFails(anonymize(PASSENGER, { user }));
    });
  }

  it('denies the profile photo kept when the profile had one', async () => {
    await seed({ [`users/${PASSENGER}`]: { ...USERS[PASSENGER], profileImage: 'https://example.com/me.jpg' } });
    await assertFails(anonymize(PASSENGER, { user: without(anonymizedUser(), 'profileImage') }));
    await assertSucceeds(anonymize(PASSENGER));
  });

  it('denies anyone but an admin (the owner included)', async () => {
    await assertFails(anonymize(PASSENGER, {}, db(PASSENGER)));
    await assertFails(anonymize(PASSENGER, {}, db(OTHER_PASSENGER)));
  });

  it('denies a second anonymization', async () => {
    await assertSucceeds(anonymize(PASSENGER));
    await assertFails(anonymize(PASSENGER, { contact: false }));
  });

  it('denies deleting a contact card on its own', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'contacts', PASSENGER)));
  });
});

describe('privacy: after anonymization', () => {
  beforeEach(async () => {
    await assertSucceeds(anonymize(PASSENGER));
  });

  it('denies the owner editing the profile', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'users', PASSENGER), { fullName: 'Maria Santos', updatedAt: serverTimestamp() }),
    );
  });

  it('denies the owner writing a new contact card', async () => {
    await assertFails(
      setDoc(doc(db(PASSENGER), 'contacts', PASSENGER), {
        fullName: DELETED,
        mobileNumber: '',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('still lets an admin read the anonymized profile', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'users', PASSENGER)));
  });
});

describe('privacy: anonymizing a driver', () => {
  beforeEach(async () => {
    await seed({ [`deletionRequests/${DRIVER}`]: pendingRequest(DRIVER) });
  });

  it('allows the full deletion: profile, card, driver record and request', async () => {
    await assertSucceeds(anonymize(DRIVER, { driver: anonymizedDriver(), request: completedRequest() }));
  });

  it('allows the full deletion with the approved application too', async () => {
    await seed({ [`driverApplications/${DRIVER}`]: application(APPLICANT, { uid: DRIVER, status: 'approved' }) });
    await assertSucceeds(
      anonymize(DRIVER, {
        driver: anonymizedDriver(),
        application: anonymizedApplication(),
        request: completedRequest(),
      }),
    );
  });

  it('denies leaving the driver record', async () => {
    await assertFails(anonymize(DRIVER, { request: completedRequest() }));
  });

  it('denies leaving the application', async () => {
    await seed({ [`driverApplications/${DRIVER}`]: application(APPLICANT, { uid: DRIVER, status: 'approved' }) });
    await assertFails(anonymize(DRIVER, { driver: anonymizedDriver(), request: completedRequest() }));
  });

  it('denies the deletion while the driver is on a trip or holds a request', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ currentBookingId: 'booking1' }) });
    await assertFails(anonymize(DRIVER, { driver: anonymizedDriver(), request: completedRequest() }));
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ currentRequestId: 'request1' }) });
    await assertFails(anonymize(DRIVER, { driver: anonymizedDriver(), request: completedRequest() }));
  });

  const badDrivers: [string, DocumentData][] = [
    ['the name kept', without(anonymizedDriver(), 'fullName')],
    ['the plate kept', without(anonymizedDriver(), 'vehiclePlate')],
    ['the vehicle details kept', without(anonymizedDriver(), 'vehicleBrand', 'vehicleModel', 'vehicleColor')],
    ['the driver still verified', { ...anonymizedDriver(), isVerified: true }],
    ['the driver still online', { ...anonymizedDriver(), isOnline: true }],
    ['the position kept', without(anonymizedDriver(), 'currentLocation')],
    ['a note kept', { ...anonymizedDriver(), verificationNote: 'Was verified.' }],
    ['the rating changed', { ...anonymizedDriver(), rating: 5 }],
    ['a client-chosen time', { ...anonymizedDriver(), anonymizedAt: Timestamp.now() }],
  ];

  for (const [label, driver] of badDrivers) {
    it(`denies a driver anonymization with ${label}`, async () => {
      await assertFails(anonymize(DRIVER, { driver, request: completedRequest() }));
    });
  }

  it('denies anonymizing the driver record on its own', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'drivers', DRIVER), anonymizedDriver()));
  });

  it('denies restoring or editing an anonymized driver', async () => {
    await assertSucceeds(anonymize(DRIVER, { driver: anonymizedDriver(), request: completedRequest() }));
    await assertFails(
      updateDoc(doc(adminDb(), 'drivers', DRIVER), {
        isVerified: true,
        verificationNote: null,
        verificationUpdatedAt: serverTimestamp(),
        verificationUpdatedBy: ADMIN,
      }),
    );
    await assertFails(
      updateDoc(doc(adminDb(), 'drivers', DRIVER), {
        fullName: 'Pedro Reyes',
        vehiclePlate: 'ABC 1234',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('privacy: anonymizing an applicant', () => {
  beforeEach(async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: application(APPLICANT, { adminRemarks: null }) });
  });

  it('allows the deletion with the application anonymized', async () => {
    await assertSucceeds(anonymize(APPLICANT, { application: anonymizedApplication() }));
  });

  it('denies leaving the application', async () => {
    await assertFails(anonymize(APPLICANT));
  });

  const badApplications: [string, DocumentData][] = [
    ['the names kept', without(anonymizedApplication(), 'firstName', 'lastName')],
    ['the email kept', without(anonymizedApplication(), 'email')],
    ['the documents kept', without(anonymizedApplication(), 'documents')],
    ['the status changed', { ...anonymizedApplication(), status: 'rejected' }],
    ['the acknowledgement removed', { ...anonymizedApplication(), privacyNoticeVersion: null }],
    ['a client-chosen time', { ...anonymizedApplication(), anonymizedAt: Timestamp.now() }],
  ];

  for (const [label, app] of badApplications) {
    it(`denies an application anonymization with ${label}`, async () => {
      await assertFails(anonymize(APPLICANT, { application: app }));
    });
  }

  it('denies anonymizing the application on its own', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'driverApplications', APPLICANT), anonymizedApplication()));
  });

  it('denies reviewing an anonymized application', async () => {
    await assertSucceeds(anonymize(APPLICANT, { application: anonymizedApplication() }));
    await assertFails(
      updateDoc(doc(adminDb(), 'driverApplications', APPLICANT), {
        status: 'rejected',
        adminRemarks: 'Incomplete documents.',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ─── Driver application: Privacy Notice acknowledgement ──────────────────

function applicantDb(): Firestore {
  return db(APPLICANT, { email: `${APPLICANT}@example.com` });
}

function submission(overrides: DocumentData = {}): DocumentData {
  return {
    ...application(APPLICANT),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    privacyNoticeAcknowledgedAt: serverTimestamp(),
    ...overrides,
  };
}

function resubmission(overrides: DocumentData = {}): DocumentData {
  return {
    status: 'pending',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    privacyNoticeVersion: VERSION,
    privacyNoticeAcknowledgedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('privacy: driver application acknowledgement', () => {
  it('allows a submission that acknowledges the current notice', async () => {
    await assertSucceeds(setDoc(doc(applicantDb(), 'driverApplications', APPLICANT), submission()));
  });

  const badAcks: [string, DocumentData][] = [
    ['no version', { privacyNoticeVersion: null }],
    ['an old version', { privacyNoticeVersion: '0.9' }],
    ['no time', { privacyNoticeAcknowledgedAt: null }],
    ['a client-chosen time', { privacyNoticeAcknowledgedAt: Timestamp.now() }],
  ];

  for (const [label, overrides] of badAcks) {
    it(`denies a submission with ${label}`, async () => {
      await assertFails(setDoc(doc(applicantDb(), 'driverApplications', APPLICANT), submission(overrides)));
    });
  }

  it('denies a submission without the acknowledgement fields', async () => {
    await assertFails(
      setDoc(
        doc(applicantDb(), 'driverApplications', APPLICANT),
        without(submission(), 'privacyNoticeVersion', 'privacyNoticeAcknowledgedAt'),
      ),
    );
  });

  describe('resubmission after a rejection', () => {
    beforeEach(async () => {
      await seed({
        [`driverApplications/${APPLICANT}`]: application(APPLICANT, {
          status: 'rejected',
          adminRemarks: 'Blurry license photo.',
          reviewedAt: Timestamp.now(),
        }),
      });
    });

    it('allows a resubmission that acknowledges the notice again', async () => {
      await assertSucceeds(updateDoc(doc(applicantDb(), 'driverApplications', APPLICANT), resubmission()));
    });

    it('denies a resubmission that keeps the old acknowledgement time', async () => {
      await assertFails(
        updateDoc(
          doc(applicantDb(), 'driverApplications', APPLICANT),
          without(resubmission(), 'privacyNoticeVersion', 'privacyNoticeAcknowledgedAt'),
        ),
      );
    });

    it('allows a legacy application (no acknowledgement yet) to gain it on resubmit, not without', async () => {
      await seed({
        [`driverApplications/${APPLICANT}`]: without(
          application(APPLICANT, { status: 'rejected', adminRemarks: 'Blurry.', reviewedAt: Timestamp.now() }),
          'privacyNoticeVersion',
          'privacyNoticeAcknowledgedAt',
        ),
      });
      await assertFails(
        updateDoc(
          doc(applicantDb(), 'driverApplications', APPLICANT),
          without(resubmission(), 'privacyNoticeVersion', 'privacyNoticeAcknowledgedAt'),
        ),
      );
      await assertSucceeds(updateDoc(doc(applicantDb(), 'driverApplications', APPLICANT), resubmission()));
    });

    it('denies resubmitting an anonymized application', async () => {
      await seed({
        [`driverApplications/${APPLICANT}`]: application(APPLICANT, {
          status: 'rejected',
          adminRemarks: null,
          reviewedAt: Timestamp.now(),
          anonymizedAt: Timestamp.now(),
        }),
      });
      await assertFails(updateDoc(doc(applicantDb(), 'driverApplications', APPLICANT), resubmission()));
    });
  });
});

// ─── Admin: decline a request, record the sign-in account deletion ────────

function decline(overrides: DocumentData = {}, firestore: Firestore = adminDb()) {
  return updateDoc(doc(firestore, 'deletionRequests', PASSENGER), {
    status: 'declined',
    declineNote: 'We could not confirm you are the account holder. Please email us.',
    declinedAt: serverTimestamp(),
    declinedBy: ADMIN,
    ...overrides,
  });
}

describe('privacy: declining a deletion request', () => {
  beforeEach(seedPassengerRequest);

  it('allows an admin to decline a pending request with a note the user can read', async () => {
    await assertSucceeds(decline());
    const snap = await getDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER));
    if (snap.data()?.status !== 'declined' || !snap.data()?.declineNote) throw new Error('decline not readable');
  });

  it('allows a note of 500 characters, not an empty one or 501', async () => {
    await assertFails(decline({ declineNote: '' }));
    await assertFails(decline({ declineNote: 'x'.repeat(501) }));
    await assertSucceeds(decline({ declineNote: 'x'.repeat(500) }));
  });

  const badDeclines: [string, DocumentData][] = [
    ['no note', { declineNote: null }],
    ['a client-chosen time', { declinedAt: Timestamp.now() }],
    ['another admin named', { declinedBy: 'admin2' }],
    ['an extra field', { completedAt: serverTimestamp() }],
    ['another status', { status: 'completed' }],
  ];

  for (const [label, overrides] of badDeclines) {
    it(`denies a decline with ${label}`, async () => {
      await assertFails(decline(overrides));
    });
  }

  it('denies the owner declining their own request', async () => {
    await assertFails(decline({ declinedBy: PASSENGER }, db(PASSENGER)));
  });

  it('denies declining a request that is not pending', async () => {
    await seed({
      [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER, {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: ADMIN,
      }),
    });
    await assertFails(decline());
  });

  it('lets the owner remove a declined request and ask again', async () => {
    await assertSucceeds(decline());
    await assertSucceeds(deleteDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER)));
    await assertSucceeds(requestDeletion(PASSENGER));
  });

  it('allows anonymizing an account whose request was declined (asked again another way)', async () => {
    await assertSucceeds(decline());
    await assertSucceeds(anonymize(PASSENGER));
  });
});

function recordAuthDeleted(overrides: DocumentData = {}, firestore: Firestore = adminDb()) {
  return updateDoc(doc(firestore, 'deletionRequests', PASSENGER), {
    authDeletedAt: serverTimestamp(),
    authDeletedBy: ADMIN,
    ...overrides,
  });
}

describe('privacy: recording the sign-in account deletion', () => {
  beforeEach(async () => {
    await seed({
      [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER, {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: ADMIN,
      }),
    });
  });

  it('allows an admin to record it once on a completed request', async () => {
    await assertSucceeds(recordAuthDeleted());
    await assertFails(recordAuthDeleted());
  });

  it('denies a client-chosen time, another admin, or other changes', async () => {
    await assertFails(recordAuthDeleted({ authDeletedAt: Timestamp.now() }));
    await assertFails(recordAuthDeleted({ authDeletedBy: 'admin2' }));
    await assertFails(recordAuthDeleted({ status: 'pending' }));
  });

  it('denies recording it before the request is completed', async () => {
    await seedPassengerRequest();
    await assertFails(recordAuthDeleted());
  });

  it('denies the owner recording it', async () => {
    await assertFails(recordAuthDeleted({ authDeletedBy: PASSENGER }, db(PASSENGER)));
  });
});

// ─── The admin website's own payloads (admin/src/privacy/deletionPlan.ts) ──

describe('privacy: admin website payloads', () => {
  it('anonymizes a driver with application and completes the request (deletionRequests.ts anonymizeAndComplete)', async () => {
    await seed({
      [`deletionRequests/${DRIVER}`]: pendingRequest(DRIVER),
      [`driverApplications/${DRIVER}`]: application(APPLICANT, { uid: DRIVER, status: 'approved' }),
    });
    const now = serverTimestamp();
    await assertSucceeds(
      anonymize(DRIVER, {
        user: anonymizedUserUpdate(now),
        driver: anonymizedDriverUpdate(now, ADMIN),
        application: anonymizedApplicationUpdate(now),
        request: completedRequestUpdate(now, ADMIN),
      }),
    );
  });

  it('anonymizes a passenger and completes the request', async () => {
    await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
    const now = serverTimestamp();
    await assertSucceeds(
      anonymize(PASSENGER, { user: anonymizedUserUpdate(now), request: completedRequestUpdate(now, ADMIN) }),
    );
  });

  it('declines with a trimmed note, then records nothing else', async () => {
    await seed({ [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER) });
    await assertSucceeds(
      updateDoc(
        doc(adminDb(), 'deletionRequests', PASSENGER),
        declinedRequestUpdate('  Please email us from your account address.  ', serverTimestamp(), ADMIN),
      ),
    );
    const snap = await getDoc(doc(db(PASSENGER), 'deletionRequests', PASSENGER));
    if (snap.data()?.declineNote !== 'Please email us from your account address.') throw new Error('note not trimmed');
  });

  it('records the sign-in account deletion on a completed request', async () => {
    await seed({
      [`deletionRequests/${PASSENGER}`]: pendingRequest(PASSENGER, {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: ADMIN,
      }),
    });
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'deletionRequests', PASSENGER), authDeletedUpdate(serverTimestamp(), ADMIN)),
    );
  });

  it('refuses the anonymization while the driver is on a trip (the website stops it first)', async () => {
    await seed({
      [`deletionRequests/${DRIVER}`]: pendingRequest(DRIVER),
      [`drivers/${DRIVER}`]: driverRecord({ currentBookingId: 'booking1' }),
    });
    const now = serverTimestamp();
    await assertFails(
      anonymize(DRIVER, {
        user: anonymizedUserUpdate(now),
        driver: anonymizedDriverUpdate(now, ADMIN),
        request: completedRequestUpdate(now, ADMIN),
      }),
    );
  });
});

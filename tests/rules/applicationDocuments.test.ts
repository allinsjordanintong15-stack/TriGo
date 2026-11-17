/// <reference types="node" />

// Firestore rules tests for driver application document photos at
// driverApplications/{uid}/documents/{docType}: compressed JPEG bytes written only in the
// commit that submits or resubmits the application (all or nothing), only while there is no
// application yet or it was rejected; read by the applicant and admins only; deleted by the
// applicant under the same condition, or by admins (account deletion: privacy.test.ts).
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
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

setLogLevel('error');

const ADMIN = 'admin1';
const APPLICANT = 'applicant1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';

/** Rules: data.size() < 900000. */
const MAX_OK_BYTES = 899_999;
const KEPT_TIME = Timestamp.fromMillis(Date.UTC(2026, 10, 1));

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function applicantDb(): Firestore {
  return db(APPLICANT, { email: `${APPLICANT}@example.com` });
}

function otherDb(): Firestore {
  return db(OTHER_PASSENGER, { email: `${OTHER_PASSENGER}@example.com` });
}

/** A photo exactly as the app writes it (server time). */
function photo(type: string, overrides: DocumentData = {}, size = 400_000): DocumentData {
  return {
    uid: APPLICANT,
    docType: type,
    mimeType: 'image/jpeg',
    data: Bytes.fromUint8Array(new Uint8Array(size)),
    sizeBytes: size,
    width: 1600,
    height: 1200,
    uploadedAt: serverTimestamp(),
    ...overrides,
  };
}

/** The application fields of a submit (references filled in by `submitWith`). */
function applicationFields(overrides: DocumentData = {}): DocumentData {
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
    vehicleBrand: 'Honda',
    vehicleModel: 'TMX 155',
    vehicleColor: 'Red',
    status: 'pending',
    adminRemarks: null,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedAt: null,
    privacyNoticeVersion: '1.0',
    privacyNoticeAcknowledgedAt: serverTimestamp(),
    ...overrides,
  };
}

/** A stored application (seeded) whose references match the seeded kept photos. */
function storedApplication(overrides: DocumentData = {}): DocumentData {
  const reference = { sizeBytes: 1234, uploadedAt: KEPT_TIME };
  return {
    ...applicationFields(),
    documents: { orCr: reference, ltoLicense: reference },
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    privacyNoticeAcknowledgedAt: Timestamp.now(),
    ...overrides,
  };
}

function keptPhoto(type: string): DocumentData {
  return { ...photo(type, {}, 1234), uploadedAt: KEPT_TIME };
}

type PhotoWrite = { type: string; data: DocumentData } | { type: string; kept: true };

/**
 * One commit like the app's submit transaction: the photos (unless kept) and the
 * application with matching references. `mode` create = new application, update = resubmit.
 */
function submitWith(
  photos: PhotoWrite[],
  options: { firestore?: Firestore; mode?: 'create' | 'update'; application?: DocumentData; references?: DocumentData } = {},
) {
  const firestore = options.firestore ?? applicantDb();
  const batch = writeBatch(firestore);
  const documents: DocumentData = {};
  for (const entry of photos) {
    if ('kept' in entry) {
      documents[entry.type] = { sizeBytes: 1234, uploadedAt: KEPT_TIME };
    } else {
      batch.set(doc(firestore, 'driverApplications', APPLICANT, 'documents', entry.type), entry.data);
      documents[entry.type] = { sizeBytes: entry.data.sizeBytes, uploadedAt: serverTimestamp() };
    }
  }
  const applicationRef = doc(firestore, 'driverApplications', APPLICANT);
  const references = options.references ?? documents;
  if ((options.mode ?? 'create') === 'create') {
    batch.set(applicationRef, { ...applicationFields(), documents: references, ...(options.application ?? {}) });
  } else {
    const fields = applicationFields();
    batch.update(applicationRef, {
      firstName: fields.firstName,
      status: 'pending',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacyNoticeVersion: '1.0',
      privacyNoticeAcknowledgedAt: serverTimestamp(),
      documents: references,
      ...(options.application ?? {}),
    });
  }
  return batch.commit();
}

const bothPhotos = (orCr: DocumentData = photo('orCr'), ltoLicense: DocumentData = photo('ltoLicense')): PhotoWrite[] => [
  { type: 'orCr', data: orCr },
  { type: 'ltoLicense', data: ltoLicense },
];

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

async function exists(path: string): Promise<boolean> {
  let found = false;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    found = (await getDoc(doc(context.firestore() as unknown as Firestore, path))).exists();
  });
  return found;
}

const ORCR_PATH = `driverApplications/${APPLICANT}/documents/orCr`;
const LICENSE_PATH = `driverApplications/${APPLICANT}/documents/ltoLicense`;

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
  });
});

// ─── Upload with the submit ───────────────────────────────────────────────

describe('application documents: upload with the first submit', () => {
  it('lets the applicant submit the application and both photos in one commit', async () => {
    await assertSucceeds(submitWith(bothPhotos()));
    assert(await exists(ORCR_PATH));
    assert(await exists(LICENSE_PATH));
  });

  it('accepts the largest allowed photo (899 999 bytes), both in one commit', async () => {
    await assertSucceeds(
      submitWith(bothPhotos(photo('orCr', {}, MAX_OK_BYTES), photo('ltoLicense', {}, MAX_OK_BYTES))),
    );
  });

  it('refuses a photo of 900 000 bytes or more', async () => {
    await assertFails(submitWith(bothPhotos(photo('orCr', {}, 900_000))));
  });

  it('refuses a size that does not match the bytes', async () => {
    await assertFails(submitWith(bothPhotos(photo('orCr', { sizeBytes: 1000 }))));
  });

  it('refuses a document type that is not on the list', async () => {
    await assertFails(
      submitWith([...bothPhotos(), { type: 'passport', data: photo('passport') }]),
    );
    await assertFails(submitWith(bothPhotos(photo('orCr', { docType: 'ltoLicense' }))));
  });

  it('refuses any mime type other than image/jpeg', async () => {
    for (const mimeType of ['image/png', 'application/pdf', 'image/heic', '']) {
      await assertFails(submitWith(bothPhotos(photo('orCr', { mimeType }))));
    }
  });

  it('refuses base64 text instead of bytes', async () => {
    await assertFails(submitWith(bothPhotos(photo('orCr', { data: 'AAAA' }))));
  });

  it('refuses extra fields, a client-chosen time, a wrong uid and sizes over 1600 px', async () => {
    await assertFails(submitWith(bothPhotos(photo('orCr', { fileName: 'orCr.jpg' }))));
    await assertFails(submitWith(bothPhotos(photo('orCr', { uploadedAt: Timestamp.now() }))));
    await assertFails(submitWith(bothPhotos(photo('orCr', { uid: OTHER_PASSENGER }))));
    await assertFails(submitWith(bothPhotos(photo('orCr', { width: 1601 }))));
    await assertFails(submitWith(bothPhotos(photo('orCr', { height: 0 }))));
    await assertFails(submitWith(bothPhotos(photo('orCr', { width: 1200.5 }))));
  });

  it('refuses a photo written on its own (without the submit)', async () => {
    await assertFails(setDoc(doc(applicantDb(), ORCR_PATH), photo('orCr')));
  });

  it('refuses an application whose photos are missing or do not match', async () => {
    // One photo missing.
    await assertFails(submitWith([{ type: 'orCr', data: photo('orCr') }], {
      references: {
        orCr: { sizeBytes: 400_000, uploadedAt: serverTimestamp() },
        ltoLicense: { sizeBytes: 400_000, uploadedAt: serverTimestamp() },
      },
    }));
    // A reference with another size.
    await assertFails(submitWith(bothPhotos(), {
      references: {
        orCr: { sizeBytes: 1, uploadedAt: serverTimestamp() },
        ltoLicense: { sizeBytes: 400_000, uploadedAt: serverTimestamp() },
      },
    }));
    // The retired Cloud Storage reference shape.
    await assertFails(submitWith(bothPhotos(), {
      references: {
        orCr: { storagePath: `driverApplications/${APPLICANT}/orCr`, downloadUrl: 'https://firebasestorage.googleapis.com/x', fileName: 'a.jpg', contentType: 'image/jpeg', uploadedAt: null },
        ltoLicense: { sizeBytes: 400_000, uploadedAt: serverTimestamp() },
      },
    }));
  });

  it("refuses another user writing the applicant's photos", async () => {
    await assertFails(submitWith(bothPhotos(), { firestore: otherDb() }));
    await assertFails(setDoc(doc(otherDb(), ORCR_PATH), photo('orCr')));
  });

  it('refuses a driver account and a signed-out user', async () => {
    await assertFails(setDoc(doc(db(DRIVER), ORCR_PATH), photo('orCr')));
    await assertFails(setDoc(doc(db(null), ORCR_PATH), photo('orCr')));
  });
});

describe('application documents: resubmit and status', () => {
  beforeEach(async () => {
    await seed({ [ORCR_PATH]: keptPhoto('orCr'), [LICENSE_PATH]: keptPhoto('ltoLicense') });
  });

  it('lets a rejected applicant retake one photo and keep the other', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'rejected', adminRemarks: 'Blurry OR/CR.' }) });
    await assertSucceeds(
      submitWith([{ type: 'orCr', data: photo('orCr') }, { type: 'ltoLicense', kept: true }], { mode: 'update' }),
    );
  });

  it('lets a rejected applicant retake both photos', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'rejected', adminRemarks: 'Blurry.' }) });
    await assertSucceeds(submitWith(bothPhotos(), { mode: 'update' }));
  });

  it('refuses replacing photos while the application is pending', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication() });
    await assertFails(submitWith(bothPhotos(), { mode: 'update' }));
    await assertFails(setDoc(doc(applicantDb(), ORCR_PATH), photo('orCr')));
  });

  it('refuses uploading after approval', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'approved' }) });
    await assertFails(submitWith(bothPhotos(), { mode: 'update' }));
    await assertFails(setDoc(doc(applicantDb(), ORCR_PATH), photo('orCr')));
  });

  it('refuses uploading to an anonymized application', async () => {
    await seed({
      [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'rejected', anonymizedAt: Timestamp.now() }),
    });
    await assertFails(submitWith(bothPhotos(), { mode: 'update' }));
  });
});

// ─── Reading ──────────────────────────────────────────────────────────────

describe('application documents: reading', () => {
  beforeEach(async () => {
    await seed({
      [`driverApplications/${APPLICANT}`]: storedApplication(),
      [ORCR_PATH]: keptPhoto('orCr'),
      [LICENSE_PATH]: keptPhoto('ltoLicense'),
    });
  });

  it('lets the applicant read their own photos', async () => {
    await assertSucceeds(getDoc(doc(applicantDb(), ORCR_PATH)));
    await assertSucceeds(getDocs(collection(applicantDb(), 'driverApplications', APPLICANT, 'documents')));
  });

  it('lets an admin read and list them', async () => {
    const snapshot = await assertSucceeds(getDoc(doc(adminDb(), ORCR_PATH)));
    assert(snapshot.data()?.data instanceof Bytes);
    await assertSucceeds(getDocs(collection(adminDb(), 'driverApplications', APPLICANT, 'documents')));
  });

  it('refuses other users, drivers and signed-out users (read and list)', async () => {
    for (const firestore of [otherDb(), db(DRIVER), db(null)]) {
      await assertFails(getDoc(doc(firestore, ORCR_PATH)));
      await assertFails(getDocs(collection(firestore, 'driverApplications', APPLICANT, 'documents')));
    }
  });
});

// ─── Deleting ─────────────────────────────────────────────────────────────

describe('application documents: deleting', () => {
  beforeEach(async () => {
    await seed({ [ORCR_PATH]: keptPhoto('orCr'), [LICENSE_PATH]: keptPhoto('ltoLicense') });
  });

  it('lets the applicant delete their photos after a rejection', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'rejected', adminRemarks: 'Blurry.' }) });
    await assertSucceeds(deleteDoc(doc(applicantDb(), ORCR_PATH)));
  });

  it('refuses the applicant deleting while pending or after approval', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication() });
    await assertFails(deleteDoc(doc(applicantDb(), ORCR_PATH)));
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'approved' }) });
    await assertFails(deleteDoc(doc(applicantDb(), ORCR_PATH)));
  });

  it('refuses other users', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'rejected', adminRemarks: 'Blurry.' }) });
    await assertFails(deleteDoc(doc(otherDb(), ORCR_PATH)));
    await assertFails(deleteDoc(doc(db(DRIVER), ORCR_PATH)));
  });

  it('lets an admin delete them', async () => {
    await seed({ [`driverApplications/${APPLICANT}`]: storedApplication({ status: 'approved' }) });
    await assertSucceeds(deleteDoc(doc(adminDb(), ORCR_PATH)));
  });
});

function assert(condition: unknown): asserts condition {
  if (!condition) throw new Error('Assertion failed');
}

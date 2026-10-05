/// <reference types="node" />

// Cloud Storage rules tests: passenger profile photos and driver application documents.
// Run with `npm run test:rules` (starts the Firestore and Storage emulators; the storage
// rules read users/{uid} and driverApplications/{uid} from the Firestore emulator).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel, type DocumentData, type Firestore } from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied requests are expected; keep the SDK's permission warnings out of the output.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';

const ONE_KB = 1024;
const TWO_MB = 2 * 1024 * 1024;

let testEnv: RulesTestEnvironment;

function context(uid: string | null): RulesTestContext {
  return uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
}

function avatarPath(uid: string, fileName = 'avatar.jpg'): string {
  return `profileImages/${uid}/${fileName}`;
}

function applicationPath(uid: string, documentType: string): string {
  return `driverApplications/${uid}/${documentType}`;
}

function upload(uid: string | null, path: string, size: number, contentType: string) {
  // UploadTask is thenable; wrap it so assertSucceeds / assertFails get a real Promise.
  return Promise.resolve(
    context(uid).storage().ref(path).put(new Uint8Array(size), { contentType }),
  );
}

function read(uid: string | null, path: string) {
  return context(uid).storage().ref(path).getMetadata();
}

function remove(uid: string | null, path: string) {
  return context(uid).storage().ref(path).delete();
}

/** Writes Firestore documents with rules disabled (test fixtures). */
async function seedFirestore(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const firestore = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

/** Uploads a file with rules disabled (test fixture). */
async function seedFile(path: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(path).put(new Uint8Array(ONE_KB), { contentType: 'image/jpeg' });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await seedFirestore({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${OTHER_PASSENGER}`]: { uid: OTHER_PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
  });
});

describe('storage: profile photo upload', () => {
  it('allows the owner to upload a JPEG under 2 MB', async () => {
    await assertSucceeds(upload(PASSENGER, avatarPath(PASSENGER), 200 * ONE_KB, 'image/jpeg'));
  });

  it('allows PNG and WebP', async () => {
    await assertSucceeds(upload(PASSENGER, avatarPath(PASSENGER), ONE_KB, 'image/png'));
    await assertSucceeds(upload(PASSENGER, avatarPath(PASSENGER), ONE_KB, 'image/webp'));
  });

  it('allows overwriting an existing avatar', async () => {
    await seedFile(avatarPath(PASSENGER));
    await assertSucceeds(upload(PASSENGER, avatarPath(PASSENGER), ONE_KB, 'image/jpeg'));
  });

  it("denies uploading to another passenger's path", async () => {
    await assertFails(upload(PASSENGER, avatarPath(OTHER_PASSENGER), ONE_KB, 'image/jpeg'));
  });

  it('denies a signed-out user', async () => {
    await assertFails(upload(null, avatarPath(PASSENGER), ONE_KB, 'image/jpeg'));
  });

  it('denies a file of 2 MB or more', async () => {
    await assertFails(upload(PASSENGER, avatarPath(PASSENGER), TWO_MB, 'image/jpeg'));
  });

  it('denies a non-image content type', async () => {
    await assertFails(upload(PASSENGER, avatarPath(PASSENGER), ONE_KB, 'application/pdf'));
  });

  it('denies image types outside the allowed list (e.g. GIF)', async () => {
    await assertFails(upload(PASSENGER, avatarPath(PASSENGER), ONE_KB, 'image/gif'));
  });

  it('denies any other file name in the profile folder', async () => {
    await assertFails(
      upload(PASSENGER, avatarPath(PASSENGER, 'other.jpg'), ONE_KB, 'image/jpeg'),
    );
  });

  it('denies a driver account uploading an avatar', async () => {
    await assertFails(upload(DRIVER, avatarPath(DRIVER), ONE_KB, 'image/jpeg'));
  });
});

describe('storage: profile photo read and delete', () => {
  beforeEach(async () => {
    await seedFile(avatarPath(PASSENGER));
  });

  it('allows the owner to read their avatar', async () => {
    await assertSucceeds(read(PASSENGER, avatarPath(PASSENGER)));
  });

  it("denies reading another passenger's avatar", async () => {
    await assertFails(read(OTHER_PASSENGER, avatarPath(PASSENGER)));
  });

  it('denies a signed-out read', async () => {
    await assertFails(read(null, avatarPath(PASSENGER)));
  });

  it('allows the owner to delete their avatar', async () => {
    await assertSucceeds(remove(PASSENGER, avatarPath(PASSENGER)));
  });

  it("denies deleting another passenger's avatar", async () => {
    await assertFails(remove(OTHER_PASSENGER, avatarPath(PASSENGER)));
  });
});

describe('storage: driver application documents (unchanged)', () => {
  it('allows a passenger with no application to upload their OR/CR', async () => {
    await assertSucceeds(
      upload(PASSENGER, applicationPath(PASSENGER, 'orCr'), ONE_KB, 'image/jpeg'),
    );
  });

  it('allows uploading a license under 10 MB after a rejected application', async () => {
    await seedFirestore({ [`driverApplications/${PASSENGER}`]: { status: 'rejected' } });
    await assertSucceeds(
      upload(PASSENGER, applicationPath(PASSENGER, 'ltoLicense'), 3 * ONE_KB * ONE_KB, 'image/png'),
    );
  });

  it('denies replacing documents while an application is pending', async () => {
    await seedFirestore({ [`driverApplications/${PASSENGER}`]: { status: 'pending' } });
    await assertFails(upload(PASSENGER, applicationPath(PASSENGER, 'orCr'), ONE_KB, 'image/jpeg'));
  });

  it('denies an unknown document type', async () => {
    await assertFails(
      upload(PASSENGER, applicationPath(PASSENGER, 'selfie'), ONE_KB, 'image/jpeg'),
    );
  });

  it('denies a file of 10 MB or more', async () => {
    await assertFails(
      upload(PASSENGER, applicationPath(PASSENGER, 'orCr'), 10 * ONE_KB * ONE_KB, 'image/jpeg'),
    );
  });

  it("denies uploading to another passenger's application", async () => {
    await assertFails(
      upload(PASSENGER, applicationPath(OTHER_PASSENGER, 'orCr'), ONE_KB, 'image/jpeg'),
    );
  });

  it('allows the owner to read and denies others', async () => {
    await seedFile(applicationPath(PASSENGER, 'orCr'));
    await assertSucceeds(read(PASSENGER, applicationPath(PASSENGER, 'orCr')));
    await assertFails(read(OTHER_PASSENGER, applicationPath(PASSENGER, 'orCr')));
  });

  it('denies deleting a document, even for the owner', async () => {
    await seedFile(applicationPath(PASSENGER, 'orCr'));
    await assertFails(remove(PASSENGER, applicationPath(PASSENGER, 'orCr')));
  });
});

describe('storage: everything else', () => {
  it('denies writes outside the known paths', async () => {
    await assertFails(upload(PASSENGER, `uploads/${PASSENGER}/file.jpg`, ONE_KB, 'image/jpeg'));
  });

  it('denies reads outside the known paths', async () => {
    await seedFile(`uploads/${PASSENGER}/file.jpg`);
    await assertFails(read(PASSENGER, `uploads/${PASSENGER}/file.jpg`));
  });
});

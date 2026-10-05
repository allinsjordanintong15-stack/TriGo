/// <reference types="node" />

// Firestore rules tests for users/{uid}: registration, Edit Profile and the profile photo.
// Run with `npm run test:rules` (starts the Firestore and Storage emulators under a demo project).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.
//
// Every client write to users/{uid} in the app (checked across the codebase):
//   - authService.createPassengerProfile  setDoc     registration (create rule)
//   - authService.updatePassengerProfile  updateDoc  fullName, mobileNumber, updatedAt
//   - profile photo                       updateDoc  profileImage, updatedAt

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings out of the output.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const NEW_USER = 'newPassenger';

let testEnv: RulesTestEnvironment;

function db(uid: string | null): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function userDoc(uid: string, overrides: DocumentData = {}): DocumentData {
  return {
    uid,
    fullName: 'Juan Dela Cruz',
    email: `${uid}@example.com`,
    mobileNumber: '09171234567',
    role: 'passenger',
    profileImage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** The download URL Cloud Storage returns for profileImages/{uid}/avatar.jpg. */
function avatarUrl(uid: string, bucket = 'trigo-2eaf6.firebasestorage.app'): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/profileImages%2F${uid}%2Favatar.jpg` +
    '?alt=media&token=0f3c6c1e-1111-4a2b-9c3d-123456789abc'
  );
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

function updateOwnProfile(uid: string, data: DocumentData) {
  return updateDoc(doc(db(uid), 'users', uid), data);
}

/** Exactly what authService.updatePassengerProfile writes. */
function editProfileUpdate(overrides: DocumentData = {}): DocumentData {
  return {
    fullName: 'Juan P. Dela Cruz',
    mobileNumber: '09179998888',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** What the profile photo upload / remove writes. */
function photoUpdate(profileImage: unknown): DocumentData {
  return { profileImage, updatedAt: serverTimestamp() };
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
  await seed({
    [`users/${PASSENGER}`]: userDoc(PASSENGER),
    [`users/${OTHER_PASSENGER}`]: userDoc(OTHER_PASSENGER),
    [`users/${DRIVER}`]: userDoc(DRIVER, { role: 'driver' }),
  });
});

describe('users: read', () => {
  it('allows the owner to read their profile', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'users', PASSENGER)));
  });

  it("denies reading another user's profile", async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'users', OTHER_PASSENGER)));
  });

  it('denies a signed-out user', async () => {
    await assertFails(getDoc(doc(db(null), 'users', PASSENGER)));
  });
});

describe('users: registration (createPassengerProfile)', () => {
  it('allows creating your own passenger profile', async () => {
    await assertSucceeds(
      setDoc(doc(db(NEW_USER), 'users', NEW_USER), {
        ...userDoc(NEW_USER),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies registering with a driver role', async () => {
    await assertFails(
      setDoc(doc(db(NEW_USER), 'users', NEW_USER), userDoc(NEW_USER, { role: 'driver' })),
    );
  });

  it('denies creating a profile for someone else', async () => {
    await assertFails(setDoc(doc(db(NEW_USER), 'users', 'someoneElse'), userDoc('someoneElse')));
  });
});

describe('users: Edit Profile (updatePassengerProfile)', () => {
  it('allows the owner to change name and mobile number', async () => {
    await assertSucceeds(updateOwnProfile(PASSENGER, editProfileUpdate()));
  });

  it('denies editing another passenger', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'users', OTHER_PASSENGER), editProfileUpdate()),
    );
  });

  it('denies a non-string name', async () => {
    await assertFails(updateOwnProfile(PASSENGER, editProfileUpdate({ fullName: 42 })));
  });

  it('denies changing the role', async () => {
    await assertFails(updateOwnProfile(PASSENGER, editProfileUpdate({ role: 'driver' })));
  });

  it('denies changing the email', async () => {
    await assertFails(
      updateOwnProfile(PASSENGER, editProfileUpdate({ email: 'new@example.com' })),
    );
  });

  it('denies writing an unknown extra field', async () => {
    await assertFails(updateOwnProfile(PASSENGER, editProfileUpdate({ isVerified: true })));
  });

  it('denies changing createdAt', async () => {
    await assertFails(updateOwnProfile(PASSENGER, editProfileUpdate({ createdAt: new Date() })));
  });

  it('denies a driver account editing its users profile', async () => {
    await assertFails(updateOwnProfile(DRIVER, editProfileUpdate()));
  });
});

describe('users: profile photo', () => {
  it("allows the owner to set their own avatar's download URL", async () => {
    await assertSucceeds(updateOwnProfile(PASSENGER, photoUpdate(avatarUrl(PASSENGER))));
  });

  it('allows the URL for a legacy appspot.com bucket', async () => {
    await assertSucceeds(
      updateOwnProfile(PASSENGER, photoUpdate(avatarUrl(PASSENGER, 'trigo-2eaf6.appspot.com'))),
    );
  });

  it('allows the owner to remove the photo (null)', async () => {
    await seed({ [`users/${PASSENGER}`]: userDoc(PASSENGER, { profileImage: avatarUrl(PASSENGER) }) });
    await assertSucceeds(updateOwnProfile(PASSENGER, photoUpdate(null)));
  });

  it('denies setting another passenger’s photo', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'users', OTHER_PASSENGER), photoUpdate(avatarUrl(OTHER_PASSENGER))),
    );
  });

  it("denies pointing at another passenger's avatar file", async () => {
    await assertFails(updateOwnProfile(PASSENGER, photoUpdate(avatarUrl(OTHER_PASSENGER))));
  });

  it('denies a URL on another host', async () => {
    await assertFails(
      updateOwnProfile(
        PASSENGER,
        photoUpdate(`https://example.com/o/profileImages%2F${PASSENGER}%2Favatar.jpg?alt=media`),
      ),
    );
  });

  it('denies a different file in the profile folder', async () => {
    await assertFails(
      updateOwnProfile(
        PASSENGER,
        photoUpdate(avatarUrl(PASSENGER).replace('avatar.jpg', 'other.jpg')),
      ),
    );
  });

  it('denies a non-string value', async () => {
    await assertFails(updateOwnProfile(PASSENGER, photoUpdate(12345)));
  });

  it('denies a URL longer than 1024 characters', async () => {
    await assertFails(
      updateOwnProfile(PASSENGER, photoUpdate(avatarUrl(PASSENGER) + 'x'.repeat(1024))),
    );
  });

  it('denies deleting the field instead of setting null', async () => {
    await assertFails(updateOwnProfile(PASSENGER, photoUpdate(deleteField())));
  });

  it('denies changing the photo and the name in the same write', async () => {
    await assertFails(
      updateOwnProfile(PASSENGER, {
        ...photoUpdate(avatarUrl(PASSENGER)),
        fullName: 'Someone Else',
      }),
    );
  });

  it('denies changing the photo and the role in the same write', async () => {
    await assertFails(
      updateOwnProfile(PASSENGER, { ...photoUpdate(avatarUrl(PASSENGER)), role: 'driver' }),
    );
  });

  it('denies a driver account setting a photo', async () => {
    await assertFails(updateOwnProfile(DRIVER, photoUpdate(avatarUrl(DRIVER))));
  });

  it('denies a signed-out user', async () => {
    await assertFails(
      updateDoc(doc(db(null), 'users', PASSENGER), photoUpdate(avatarUrl(PASSENGER))),
    );
  });
});

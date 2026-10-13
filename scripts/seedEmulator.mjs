// Seeds the LOCAL Auth + Firestore emulators (demo project, never real Firebase) with an
// admin account and driver applications, for testing the admin website.
//
// Usage (from the repo root):
//   1. npm run emulators          (terminal 1; keep it running)
//   2. npm run seed:emulator      (terminal 2)
//   3. cd admin && npm run dev:emulator, then sign in as admin@trigo.test / admin1234
//
// Running it again wipes the emulators' Auth and Firestore data and seeds it fresh.

const PROJECT_ID = 'demo-trigo';

// Point firebase-admin at the emulators BEFORE it loads. These are always set here, so
// this script can never write to a real project.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = PROJECT_ID;

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'admin1234';

// Start from empty emulators so re-running gives the same data (emulator-only endpoints).
async function resetEmulators() {
  const firestoreUrl = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  for (const url of [firestoreUrl, authUrl]) {
    const response = await fetch(url, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      console.error('Could not reach the emulators. Start them first with: npm run emulators');
      process.exit(1);
    }
  }
}

await resetEmulators();

function createUser(email, displayName) {
  return auth.createUser({ email, password: PASSWORD, displayName });
}

function minutesAgo(minutes) {
  return Timestamp.fromMillis(Date.now() - minutes * 60_000);
}

function documentEntry(uid, type) {
  return {
    storagePath: `driverApplications/${uid}/${type}`,
    downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${PROJECT_ID}.appspot.com/o/${type}`,
    fileName: `${type}.jpg`,
    contentType: 'image/jpeg',
    uploadedAt: minutesAgo(30),
  };
}

async function seedApplicant({ email, firstName, middleName, lastName, mobileNumber, vehicleType, vehiclePlate, status, adminRemarks, submittedMinutesAgo }) {
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const user = await createUser(email, fullName);
  const uid = user.uid;
  await db.doc(`users/${uid}`).set({
    uid,
    fullName,
    email,
    mobileNumber,
    role: 'passenger',
    profileImage: null,
    createdAt: minutesAgo(600),
    updatedAt: minutesAgo(600),
  });
  await db.doc(`driverApplications/${uid}`).set({
    uid,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    mobileNumber,
    vehicleType,
    vehiclePlate,
    documents: { orCr: documentEntry(uid, 'orCr'), ltoLicense: documentEntry(uid, 'ltoLicense') },
    status,
    adminRemarks,
    submittedAt: minutesAgo(submittedMinutesAgo),
    updatedAt: minutesAgo(submittedMinutesAgo),
    reviewedAt: status === 'pending' && !adminRemarks ? null : minutesAgo(submittedMinutesAgo + 60),
  });
  return { uid, fullName, status };
}

const admin = await createUser('admin@trigo.test', 'TriGo Admin');
await auth.setCustomUserClaims(admin.uid, { admin: true });

const seeded = [
  await seedApplicant({
    email: 'juan@trigo.test',
    firstName: 'Juan',
    middleName: 'Santos',
    lastName: 'Dela Cruz',
    mobileNumber: '+639171234567',
    vehicleType: 'tricycle',
    vehiclePlate: 'ABC 1234',
    status: 'pending',
    adminRemarks: null,
    submittedMinutesAgo: 45,
  }),
  await seedApplicant({
    email: 'maria@trigo.test',
    firstName: 'Maria',
    middleName: null,
    lastName: 'Reyes',
    mobileNumber: '+639181234567',
    vehicleType: 'motorcycle',
    vehiclePlate: '123 XYZ',
    status: 'pending',
    // Resubmitted after a rejection: the old remarks stay until the next review.
    adminRemarks: 'The OR/CR photo was blurry. Please upload a clearer photo.',
    submittedMinutesAgo: 15,
  }),
  await seedApplicant({
    email: 'pedro@trigo.test',
    firstName: 'Pedro',
    middleName: null,
    lastName: 'Lim',
    mobileNumber: '+639191234567',
    vehicleType: 'tricycle',
    vehiclePlate: 'DEF 5678',
    status: 'rejected',
    adminRemarks: 'License is expired.',
    submittedMinutesAgo: 300,
  }),
];

console.log(`Seeded the emulators (project ${PROJECT_ID}):`);
console.log(`  admin   admin@trigo.test / ${PASSWORD}  (admin claim)`);
for (const { fullName, status } of seeded) {
  console.log(`  ${status.padEnd(10)}${fullName}  (password ${PASSWORD})`);
}
process.exit(0);

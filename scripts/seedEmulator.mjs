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

// ─── Passenger with history, an approved driver, and bookings ───────────────

async function seedUser({ email, fullName, mobileNumber, role, createdMinutesAgo }) {
  const user = await createUser(email, fullName);
  await db.doc(`users/${user.uid}`).set({
    uid: user.uid,
    fullName,
    email,
    mobileNumber,
    role,
    profileImage: null,
    createdAt: minutesAgo(createdMinutesAgo),
    updatedAt: minutesAgo(createdMinutesAgo),
  });
  return user.uid;
}

const anaUid = await seedUser({
  email: 'ana@trigo.test',
  fullName: 'Ana Santos',
  mobileNumber: '+639201234567',
  role: 'passenger',
  createdMinutesAgo: 60 * 24 * 30,
});

const carloUid = await seedUser({
  email: 'carlo@trigo.test',
  fullName: 'Carlo Bautista',
  mobileNumber: '+639211234567',
  role: 'driver',
  createdMinutesAgo: 60 * 24 * 60,
});
await db.doc(`drivers/${carloUid}`).set({
  fullName: 'Carlo Bautista',
  vehiclePlate: 'GHI 9012',
  vehicleType: 'tricycle',
  isVerified: true,
  isOnline: false,
  isAvailable: false,
  currentLocation: null,
  currentBookingId: null,
  currentRequestId: null,
  rating: 4.8,
  profileImage: null,
});

// Drivers page: an online motorcycle driver and a driver whose verification was revoked.
const bellaUid = await seedUser({
  email: 'bella@trigo.test',
  fullName: 'Bella Cruz',
  mobileNumber: '+639221234567',
  role: 'driver',
  createdMinutesAgo: 60 * 24 * 20,
});
await db.doc(`drivers/${bellaUid}`).set({
  fullName: 'Bella Cruz',
  vehiclePlate: 'JKL 3456',
  vehicleType: 'motorcycle',
  isVerified: true,
  isOnline: true,
  isAvailable: true,
  currentLocation: { latitude: 10.0794, longitude: 124.3426 },
  currentBookingId: null,
  currentRequestId: null,
  rating: 4.5,
  profileImage: null,
});

const danteUid = await seedUser({
  email: 'dante@trigo.test',
  fullName: 'Dante Reyes',
  mobileNumber: '+639231234567',
  role: 'driver',
  createdMinutesAgo: 60 * 24 * 90,
});
await db.doc(`drivers/${danteUid}`).set({
  fullName: 'Dante Reyes',
  vehiclePlate: 'MNO 7890',
  vehicleType: 'tricycle',
  isVerified: false,
  isOnline: false,
  isAvailable: false,
  currentLocation: null,
  currentBookingId: null,
  currentRequestId: null,
  rating: 3.9,
  profileImage: null,
  verificationNote: 'Driver license expired. Restore once a renewed license is shown at the office.',
  verificationUpdatedAt: minutesAgo(60 * 24 * 2),
  verificationUpdatedBy: admin.uid,
});

const POBLACION = { latitude: 10.0794, longitude: 124.3426, address: 'Poblacion, Trinidad, Bohol' };
const PLACES = [
  { latitude: 10.0921, longitude: 124.3583, address: 'Kauswagan, Trinidad, Bohol' },
  { latitude: 10.0602, longitude: 124.3311, address: 'Soom, Trinidad, Bohol' },
  { latitude: 10.1012, longitude: 124.3205, address: 'Guinobatan, Trinidad, Bohol' },
  { latitude: 10.1503, longitude: 124.4012, address: 'Talibon Public Market, Talibon, Bohol' },
];

async function seedBooking(id, { passengerId, driverId, place, status, bookingType = 'standard', vehicleType = 'tricycle', distanceKm, fare, minutesAgoCreated, paymentMethod = null, cancelledBy = null, cancellationReason = null }) {
  const createdAt = minutesAgo(minutesAgoCreated);
  const endedAt = minutesAgo(minutesAgoCreated - 25);
  await db.doc(`bookings/${id}`).set({
    passengerId,
    driverId,
    vehicleType,
    bookingType,
    pickupLocation: POBLACION,
    destination: place,
    distanceKm,
    estimatedFare: fare,
    driverProposedFare: bookingType === 'out_of_area' ? fare : null,
    agreedFare: bookingType === 'out_of_area' ? fare : null,
    fareAgreement: null,
    finalFare: status === 'completed' ? fare : null,
    status,
    outOfAreaRequestId: bookingType === 'out_of_area' ? id : null,
    createdAt,
    updatedAt: status === 'completed' || status === 'cancelled' ? endedAt : createdAt,
    acceptedAt: driverId ? minutesAgo(minutesAgoCreated - 2) : null,
    arrivedAt: null,
    startedAt: null,
    completedAt: status === 'completed' ? endedAt : null,
    cancelledAt: status === 'cancelled' ? endedAt : null,
    paymentMethod,
    cancelledBy,
    cancellationReason,
  });
}

const DAY = 60 * 24;
await seedBooking('seed-booking-1', { passengerId: anaUid, driverId: carloUid, place: PLACES[0], status: 'completed', distanceKm: 2.4, fare: 34.2, minutesAgoCreated: 3 * DAY, paymentMethod: 'cash' });
await seedBooking('seed-booking-2', { passengerId: anaUid, driverId: carloUid, place: PLACES[1], status: 'completed', distanceKm: 3.1, fare: 39.8, minutesAgoCreated: 2 * DAY, paymentMethod: 'gcash' });
await seedBooking('seed-booking-3', { passengerId: anaUid, driverId: null, place: PLACES[2], status: 'cancelled', distanceKm: 4.0, fare: 47, minutesAgoCreated: DAY, cancelledBy: 'passenger', cancellationReason: 'Changed plans' });
await seedBooking('seed-booking-4', { passengerId: anaUid, driverId: carloUid, place: PLACES[3], status: 'completed', bookingType: 'out_of_area', distanceKm: 12.5, fare: 115, minutesAgoCreated: 300, paymentMethod: 'cash' });
const juan = seeded[0];
await seedBooking('seed-booking-5', { passengerId: juan.uid, driverId: carloUid, place: PLACES[1], status: 'completed', vehicleType: 'tricycle', distanceKm: 3.1, fare: 39.8, minutesAgoCreated: 5 * DAY, paymentMethod: 'cash' });

// Out-of-area requests (Out-of-Area Trips page). seed-booking-4 is the request that became
// the completed out-of-area booking above (same id, as in the app's confirm commit).
async function seedRequest(id, { passengerId, driverId = null, place, status, distanceKm, fare, minutesAgoCreated, expiresInMinutes = 30 }) {
  const accepted = status === 'accepted';
  await db.doc(`outOfAreaRequests/${id}`).set({
    passengerId,
    pickupLocation: POBLACION,
    destination: place,
    vehicleType: 'tricycle',
    distanceKm,
    standardEstimatedFare: fare,
    suggestedAgreementFare: driverId ? fare : null,
    agreedFare: accepted ? fare : null,
    status,
    driverId,
    fareAgreement: driverId
      ? {
          standardEstimatedFare: fare,
          driverProposedFare: fare,
          agreedFare: fare,
          agreedByPassenger: accepted,
          agreedByDriver: true,
          agreedAt: accepted ? minutesAgo(minutesAgoCreated - 3) : null,
        }
      : null,
    createdAt: minutesAgo(minutesAgoCreated),
    updatedAt: minutesAgo(minutesAgoCreated),
    expiresAt: minutesAgo(minutesAgoCreated - expiresInMinutes),
  });
}

const TAGBILARAN = { latitude: 9.6496, longitude: 123.8549, address: 'Tagbilaran City Port, Tagbilaran, Bohol' };
await seedRequest('seed-booking-4', { passengerId: anaUid, driverId: carloUid, place: PLACES[3], status: 'accepted', distanceKm: 12.5, fare: 115, minutesAgoCreated: 300 });
await seedRequest('seed-request-open', { passengerId: anaUid, place: TAGBILARAN, status: 'searching', distanceKm: 62.3, fare: 560, minutesAgoCreated: 5 });
await seedRequest('seed-request-expired', { passengerId: juan.uid, place: PLACES[3], status: 'searching', distanceKm: 12.5, fare: 115, minutesAgoCreated: DAY });
await seedRequest('seed-request-cancelled', { passengerId: juan.uid, place: TAGBILARAN, status: 'cancelled', distanceKm: 62.3, fare: 560, minutesAgoCreated: 2 * DAY });
// Outside the page's default last-7-days range.
await seedRequest('seed-request-old', { passengerId: anaUid, place: PLACES[3], status: 'cancelled', distanceKm: 12.5, fare: 115, minutesAgoCreated: 10 * DAY });

// Support contacts for the System settings page and the app's Help screen (one hidden).
for (const [id, label, phone, active, sortOrder] of [
  ['seed-hotline', 'TriGo Hotline (8 AM–5 PM)', '0917 123 4567', true, 1],
  ['seed-office', 'TriGo Office, Trinidad', '(038) 123-4567', true, 2],
  ['seed-old-number', 'Old support number', '0918 765 4321', false, 3],
]) {
  await db.doc(`supportContacts/${id}`).set({ label, phone, active, sortOrder, updatedAt: Timestamp.now(), updatedBy: admin.uid });
}

// Complaints (Reports & Complaints page), at complaints/{bookingId}_{reporterUid}.
async function seedComplaint(bookingId, reporterId, reporterRole, category, message, status, minutesAgoCreated, adminNotes) {
  await db.doc(`complaints/${bookingId}_${reporterId}`).set({
    bookingId,
    reporterId,
    reporterRole,
    category,
    message,
    status,
    createdAt: minutesAgo(minutesAgoCreated),
    updatedAt: minutesAgo(status === 'open' ? minutesAgoCreated : minutesAgoCreated - 60),
    ...(adminNotes !== undefined ? { adminNotes, updatedBy: admin.uid } : {}),
  });
}

await seedComplaint('seed-booking-1', anaUid, 'passenger', 'driver_behavior', 'The driver was speeding on the highway and would not slow down when I asked.', 'open', 2 * DAY);
await seedComplaint('seed-booking-1', carloUid, 'driver', 'fare_or_payment', 'The passenger paid ₱30 instead of the ₱34.20 shown in the app.', 'in_review', 2 * DAY + 30, 'Asked the passenger to settle the difference.');
await seedComplaint('seed-booking-4', anaUid, 'passenger', 'lost_item', 'I left a black umbrella in the tricycle.', 'resolved', 200, 'Driver returned the umbrella at the office.');

console.log(`Seeded the emulators (project ${PROJECT_ID}):`);
console.log(`  admin     admin@trigo.test / ${PASSWORD}  (admin claim)`);
for (const { fullName, status } of seeded) {
  console.log(`  ${status.padEnd(10)}${fullName}  (applicant, password ${PASSWORD})`);
}
console.log(`  passenger Ana Santos  (4 bookings, password ${PASSWORD})`);
console.log(`  driver    Carlo Bautista  (verified, password ${PASSWORD})`);
console.log(`  driver    Bella Cruz  (verified, online, password ${PASSWORD})`);
console.log(`  driver    Dante Reyes  (revoked, password ${PASSWORD})`);
console.log('  5 out-of-area requests (confirmed, open, expired, cancelled, cancelled 10 days ago)');
console.log('  3 support contacts (2 active, 1 hidden)');
console.log('  3 complaints (open, in review, resolved)');
process.exit(0);

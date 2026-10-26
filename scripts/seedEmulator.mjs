// Seeds the LOCAL Auth + Firestore emulators (demo project, never real Firebase) with an
// admin account, driver applications, bookings and commission data in every state
// (paid up, due, overdue, suspended; pending/confirmed/rejected payments; a cash-out), for
// testing the admin website and the app.
//
// Usage (from the repo root):
//   1. npm run emulators          (terminal 1; keep it running)
//   2. npm run seed:emulator      (terminal 2)
//   3. cd admin && npm run dev:emulator, then sign in as admin@trigo.test / admin1234
//
// Running it again wipes the emulators' Auth and Firestore data and seeds it fresh.

const PROJECT_ID = 'demo-trigo';
// demo-* projects exist only in the emulators; refuse anything else.
if (!PROJECT_ID.startsWith('demo-')) throw new Error('seedEmulator writes only to a demo-* emulator project');

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

// vehicle: { vehicleBrand, vehicleModel, vehicleColor }, or null for an application
// submitted before those were required (the admin enters them when approving).
async function seedApplicant({ email, firstName, middleName, lastName, mobileNumber, vehicleType, vehiclePlate, vehicle, status, adminRemarks, submittedMinutesAgo }) {
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
    ...(vehicle ?? {}),
    documents: { orCr: documentEntry(uid, 'orCr'), ltoLicense: documentEntry(uid, 'ltoLicense') },
    status,
    adminRemarks,
    submittedAt: minutesAgo(submittedMinutesAgo),
    updatedAt: minutesAgo(submittedMinutesAgo),
    reviewedAt: status === 'pending' && !adminRemarks ? null : minutesAgo(submittedMinutesAgo + 60),
  });
  return { uid, fullName, status, legacy: !vehicle };
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
    vehicle: { vehicleBrand: 'Honda', vehicleModel: 'TMX 155', vehicleColor: 'Red' },
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
    // Submitted before brand, model and color were required.
    vehicle: null,
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
    // A color outside the app's chips, to check "Other" on resubmission.
    vehicle: { vehicleBrand: 'Kawasaki', vehicleModel: 'Barako II', vehicleColor: 'Blue/White' },
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
  vehicleBrand: 'Honda',
  vehicleModel: 'TMX 155',
  vehicleColor: 'Red',
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
  vehicleBrand: 'Yamaha',
  vehicleModel: 'Mio i 125',
  vehicleColor: 'Black',
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
  vehicleBrand: 'Rusi',
  vehicleModel: 'Classic 250',
  vehicleColor: 'Green',
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

// ─── Commission (driver Earnings tab, admin Earnings page) ──────────────────
// 10% of every completed trip, 7-day periods, 3 grace days. Every total below is computed
// from the trips and payments, the way the app and admin website write them (firestore.rules
// Commission accrual / payments / Cash-outs), so the ledger and accounts always agree:
//   Carlo  due        one running period (his existing trips), part paid, one pending payment
//   Bella  paid up    a closed period and a running one, both paid
//   Eduardo overdue   period 1 ended unpaid, still inside its grace; period 2 running
//   Felix  suspended  period 1's grace ended with it part paid; one rejected payment

const COMMISSION = { percentage: 10, paymentPeriodDays: 7, gracePeriodDays: 3 };
await db.doc('commissionSettings/active').set({ ...COMMISSION, updatedAt: minutesAgo(30 * DAY), updatedBy: admin.uid });
await db.doc('paymentSettings/active').set({
  gcashName: 'TriGo Transport',
  gcashNumber: '09171234567',
  updatedAt: minutesAgo(30 * DAY),
  updatedBy: admin.uid,
});

// vehicle: { vehicleBrand, vehicleModel, vehicleColor }, or null for a driver approved
// before those existed (passengers then see only the vehicle type and plate).
async function seedVerifiedDriver({ email, fullName, mobileNumber, vehiclePlate, vehicle }) {
  const uid = await seedUser({ email, fullName, mobileNumber, role: 'driver', createdMinutesAgo: 60 * DAY });
  await db.doc(`drivers/${uid}`).set({
    fullName,
    vehiclePlate,
    vehicleType: 'tricycle',
    ...(vehicle ?? {}),
    isVerified: true,
    isOnline: true,
    isAvailable: true,
    currentLocation: { latitude: 10.0794, longitude: 124.3426 },
    currentBookingId: null,
    currentRequestId: null,
    rating: 4.6,
    profileImage: null,
  });
  return uid;
}

const eduardoUid = await seedVerifiedDriver({
  email: 'eduardo@trigo.test',
  fullName: 'Eduardo Ramos',
  mobileNumber: '+639241234567',
  vehiclePlate: 'PQR 2468',
  vehicle: null,
});
const felixUid = await seedVerifiedDriver({
  email: 'felix@trigo.test',
  fullName: 'Felix Navarro',
  mobileNumber: '+639251234567',
  vehiclePlate: 'STU 1357',
  vehicle: { vehicleBrand: 'Suzuki', vehicleModel: 'Smash 115', vehicleColor: 'Silver' },
});

// A completed trip for commission only (Carlo's trips are the bookings seeded above).
const extraTrips = [
  ['seed-trip-bella-1', bellaUid, PLACES[0], 45, 12 * DAY],
  ['seed-trip-bella-2', bellaUid, PLACES[1], 40, 3 * DAY],
  ['seed-trip-eduardo-1', eduardoUid, PLACES[2], 50, 8 * DAY],
  ['seed-trip-eduardo-2', eduardoUid, PLACES[0], 38.5, 6 * DAY],
  ['seed-trip-eduardo-3', eduardoUid, PLACES[1], 42, 10 * 60],
  ['seed-trip-felix-1', felixUid, PLACES[0], 40, 15 * DAY],
  ['seed-trip-felix-2', felixUid, PLACES[2], 35, 13 * DAY],
  ['seed-trip-felix-3', felixUid, PLACES[1], 45, 6 * DAY],
];
for (const [id, driverId, place, fare, createdAgo] of extraTrips) {
  const vehicleType = driverId === bellaUid ? 'motorcycle' : 'tricycle';
  await seedBooking(id, { passengerId: anaUid, driverId, place, status: 'completed', vehicleType, distanceKm: 3, fare, minutesAgoCreated: createdAgo, paymentMethod: 'cash' });
}

/**
 * Writes one driver's commissions, periods, payments (with reference locks) and account.
 * `periods` lists booking ids per period, oldest first; each period starts at its first
 * trip's completion, as the completion commit does. Payment: [id, amount, status,
 * reference, minutesAgoSubmitted, rejectionReason?]. Returns the confirmed payments.
 */
async function seedCommissionAccount(driverId, periods, payments) {
  let accrued = 0;
  let lastBookingId = null;
  const starts = [];
  for (const [index, bookingIds] of periods.entries()) {
    const seq = index + 1;
    const first = (await db.doc(`bookings/${bookingIds[0]}`).get()).data();
    const period = {
      seq,
      startAt: first.completedAt,
      periodDays: COMMISSION.paymentPeriodDays,
      graceDays: COMMISSION.gracePeriodDays,
      startCentavos: accrued,
    };
    starts.push(period);
    await db.doc(`commissionPeriods/${driverId}_${seq}`).set({ driverId, ...period });
    for (const bookingId of bookingIds) {
      const booking = (await db.doc(`bookings/${bookingId}`).get()).data();
      const amountCentavos = Math.round(booking.finalFare * COMMISSION.percentage);
      await db.doc(`commissions/${bookingId}`).set({
        driverId,
        bookingId,
        bookingType: booking.bookingType,
        finalFare: booking.finalFare,
        percentage: COMMISSION.percentage,
        amountCentavos,
        periodSeq: seq,
        completedAt: booking.completedAt,
      });
      accrued += amountCentavos;
      lastBookingId = bookingId;
    }
  }

  let paid = 0;
  let lastPaymentId = null;
  const confirmed = [];
  for (const [paymentId, amountCentavos, status, reference, submittedAgo, rejectionReason] of payments) {
    const reviewed = status === 'pending' ? {} : { reviewedAt: minutesAgo(submittedAgo - 60), reviewedBy: admin.uid };
    await db.doc(`commissionPayments/${paymentId}`).set({
      driverId,
      amountCentavos,
      reference,
      status,
      submittedAt: minutesAgo(submittedAgo),
      ...reviewed,
      ...(status === 'rejected' ? { rejectionReason } : {}),
    });
    // Rejecting frees the reference; pending and confirmed keep it.
    if (status !== 'rejected') {
      await db.doc(`paymentReferences/${reference}`).set({ paymentId, driverId, createdAt: minutesAgo(submittedAgo) });
    }
    if (status === 'confirmed') {
      paid += amountCentavos;
      lastPaymentId = paymentId;
      confirmed.push({ paymentId, amountCentavos, submittedAgo });
    }
  }
  if (paid > accrued) throw new Error(`Seed error: ${driverId} paid more than recorded`);

  // Oldest closed period still owed (oldest debt first): s with start(s) <= paid < start(s + 1).
  const current = starts[starts.length - 1];
  let unpaid = null;
  if (paid < current.startCentavos) {
    const index = starts.findIndex((period, i) => paid >= period.startCentavos && paid < starts[i + 1].startCentavos);
    const { seq, startAt, periodDays, graceDays } = starts[index];
    unpaid = { seq, startAt, periodDays, graceDays };
  }
  await db.doc(`commissionAccounts/${driverId}`).set({
    driverId,
    accruedCentavos: accrued,
    paidCentavos: paid,
    current,
    unpaid,
    lastBookingId,
    ...(lastPaymentId ? { lastPaymentId } : {}),
    updatedAt: Timestamp.now(),
  });
  return confirmed;
}

const confirmedPayments = [
  ...(await seedCommissionAccount(
    carloUid,
    [['seed-booking-5', 'seed-booking-1', 'seed-booking-2', 'seed-booking-4']],
    [
      ['seed-payment-carlo-1', 1000, 'confirmed', '1012345678901', 2 * DAY],
      ['seed-payment-carlo-2', 500, 'pending', '1012345678902', 90],
    ],
  )),
  ...(await seedCommissionAccount(
    bellaUid,
    [['seed-trip-bella-1'], ['seed-trip-bella-2']],
    [
      ['seed-payment-bella-1', 450, 'confirmed', '2012345678901', 7 * DAY],
      ['seed-payment-bella-2', 400, 'confirmed', '2012345678902', DAY],
    ],
  )),
  ...(await seedCommissionAccount(
    eduardoUid,
    [['seed-trip-eduardo-1', 'seed-trip-eduardo-2'], ['seed-trip-eduardo-3']],
    [['seed-payment-eduardo-1', 500, 'pending', '3012345678901', 120]],
  )),
  ...(await seedCommissionAccount(
    felixUid,
    [['seed-trip-felix-1', 'seed-trip-felix-2'], ['seed-trip-felix-3']],
    [
      ['seed-payment-felix-1', 300, 'confirmed', '4012345678901', 5 * DAY],
      ['seed-payment-felix-2', 450, 'rejected', '4012345678902', 3 * DAY, 'No GCash payment with this reference number was received.'],
    ],
  )),
];

// earningsLedger/totals: collected = every confirmed payment; one GCash cash-out.
const CASH_OUT_CENTAVOS = 1500;
const collectedCentavos = confirmedPayments.reduce((total, payment) => total + payment.amountCentavos, 0);
if (CASH_OUT_CENTAVOS > collectedCentavos) throw new Error('Seed error: cash-out above collected');
await db.doc('cashOuts/seed-cash-out-1').set({
  method: 'gcash',
  amountCentavos: CASH_OUT_CENTAVOS,
  reference: 'GCash ref 9012345678901',
  cashedOutOn: new Date(Date.now() - DAY * 60_000).toISOString().slice(0, 10),
  note: 'Seed data: moved to the operator account for fuel subsidy.',
  createdAt: minutesAgo(DAY),
  createdBy: admin.uid,
});
await db.doc('earningsLedger/totals').set({
  collectedCentavos,
  cashedOutCentavos: CASH_OUT_CENTAVOS,
  // The most recently confirmed payment, as the confirm commit leaves it.
  lastPaymentId: confirmedPayments.reduce((latest, payment) => (payment.submittedAgo < latest.submittedAgo ? payment : latest)).paymentId,
  lastCashOutId: 'seed-cash-out-1',
  updatedAt: minutesAgo(DAY),
});

console.log(`Seeded the emulators (project ${PROJECT_ID}):`);
console.log(`  admin     admin@trigo.test / ${PASSWORD}  (admin claim)`);
for (const { fullName, status, legacy } of seeded) {
  console.log(`  ${status.padEnd(10)}${fullName}  (applicant${legacy ? ', no brand/model/color' : ''}, password ${PASSWORD})`);
}
console.log(`  passenger Ana Santos  (12 bookings, password ${PASSWORD})`);
console.log(`  driver    Carlo Bautista  (verified, password ${PASSWORD})`);
console.log(`  driver    Bella Cruz  (verified, online, password ${PASSWORD})`);
console.log(`  driver    Dante Reyes  (revoked, password ${PASSWORD})`);
console.log('  5 out-of-area requests (confirmed, open, expired, cancelled, cancelled 10 days ago)');
console.log('  3 support contacts (2 active, 1 hidden)');
console.log('  3 complaints (open, in review, resolved)');
console.log(`  driver    Eduardo Ramos  (verified, online, no brand/model/color, password ${PASSWORD})`);
console.log(`  driver    Felix Navarro  (verified, online, password ${PASSWORD})`);
console.log('  commission 10%, 7-day periods, 3 grace days; TriGo GCash 09171234567');
console.log('    Carlo due, Bella paid up, Eduardo overdue (in grace), Felix suspended');
console.log('    payments: 3 confirmed, 2 pending, 1 rejected; 1 cash-out');
process.exit(0);

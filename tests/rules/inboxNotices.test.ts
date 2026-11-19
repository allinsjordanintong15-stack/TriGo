/// <reference types="node" />

// Firestore rules tests for the inbox (2026-11-19):
//  - adminMessages system notices, each created only in the same commit as its admin
//    decision and only for the affected user: application_approved / application_rejected
//    (driverApplications/{userId} reviewed now; rejection reason = the stored remarks),
//    payment_confirmed / payment_rejected (refId = the user's payment, reviewed now),
//    report_resolved (refId = the user's own complaint, resolved now, reason always ''),
//    deletion_declined (deletionRequests/{userId} declined now, reason = the note);
//  - announcements/{id}: admin-only create and withdraw, users read active ones of their
//    audience only;
//  - users/{uid}/inboxState/announcements: only the user reads and writes it.
// Uses the admin website's exact payloads (admin/src/inbox/noticePlan.ts, announcementPlan.ts).
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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  confirmWrites,
  DRIVER,
  multiPeriodDocs,
  PAYMENT,
  REFERENCE,
  submittedDocs,
  unpaidFrom,
} from './commissionFixtures.ts';
import { newNoticeDoc, type NoticeInput } from '../../admin/src/inbox/noticePlan.ts';
import { newAnnouncementDoc, withdrawnAnnouncementUpdate } from '../../admin/src/inbox/announcementPlan.ts';

const PROJECT_ID = 'demo-trigo-rules';

setLogLevel('error');

const ADMIN = 'admin1';
const APPLICANT = 'applicant1';
const PASSENGER = 'passenger1';
const OTHER = 'passenger2';
const APPROVED_APPLICANT = 'passengerDriver1';
const BOOKING = 'booking1';
const COMPLAINT_ID = `${BOOKING}_${PASSENGER}`;
const DAY_MS = 24 * 60 * 60 * 1000;

let testEnv: RulesTestEnvironment;

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

type Batch = ReturnType<typeof writeBatch>;

function notice(input: NoticeInput, overrides: DocumentData = {}): DocumentData {
  return { ...newNoticeDoc(input, ADMIN, serverTimestamp()), ...overrides };
}

function addMessage(batch: Batch, firestore: Firestore, data: DocumentData): void {
  batch.set(doc(collection(firestore, 'adminMessages')), data);
}

/** One admin commit: the decision's writes (if any) plus the message. */
async function commit(decision: ((batch: Batch, firestore: Firestore) => void) | null, message: DocumentData) {
  const firestore = adminDb();
  const batch = writeBatch(firestore);
  decision?.(batch, firestore);
  addMessage(batch, firestore, message);
  return batch.commit();
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
});

// ─── Driver application decisions ────────────────────────────────────────────

function applicationDoc(): DocumentData {
  const photo = { sizeBytes: 500_000, uploadedAt: Timestamp.now() };
  return {
    uid: APPLICANT,
    firstName: 'Juan',
    middleName: 'Santos',
    lastName: 'Dela Cruz',
    fullName: 'Juan Santos Dela Cruz',
    email: 'juan@example.com',
    mobileNumber: '+639171234567',
    vehicleType: 'tricycle',
    vehiclePlate: 'ABC 1234',
    vehicleBrand: 'Honda',
    vehicleModel: 'TMX 155',
    vehicleColor: 'Red',
    documents: { orCr: photo, ltoLicense: photo },
    status: 'pending',
    adminRemarks: null,
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    reviewedAt: null,
  };
}

function approve(batch: Batch, firestore: Firestore): void {
  batch.update(doc(firestore, 'driverApplications', APPLICANT), {
    status: 'approved',
    adminRemarks: null,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(firestore, 'drivers', APPLICANT), {
    fullName: 'Juan Santos Dela Cruz',
    vehiclePlate: 'ABC 1234',
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
    rating: 0,
    profileImage: null,
  });
}

const REMARKS = 'Photo is blurry — please retake';

function reject(batch: Batch, firestore: Firestore): void {
  batch.update(doc(firestore, 'driverApplications', APPLICANT), {
    status: 'rejected',
    adminRemarks: REMARKS,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

describe('notices: driver application', () => {
  beforeEach(async () => {
    await seed({
      [`users/${APPLICANT}`]: { uid: APPLICANT, role: 'passenger', mobileNumber: '+639171234567', email: 'juan@example.com' },
      [`users/${OTHER}`]: { uid: OTHER, role: 'passenger' },
      [`driverApplications/${APPLICANT}`]: applicationDoc(),
    });
  });

  it('accepts application_approved in the approval commit', async () => {
    await assertSucceeds(commit(approve, notice({ kind: 'application_approved', userId: APPLICANT })));
  });

  it('accepts application_rejected with exactly the stored remarks', async () => {
    await assertSucceeds(
      commit(reject, notice({ kind: 'application_rejected', userId: APPLICANT, remarks: REMARKS })),
    );
  });

  it('denies a notice without its decision in the same commit', async () => {
    await assertFails(commit(null, notice({ kind: 'application_approved', userId: APPLICANT })));
    await assertFails(commit(null, notice({ kind: 'application_rejected', userId: APPLICANT, remarks: REMARKS })));
  });

  it('denies the wrong kind, user or reason', async () => {
    await assertFails(commit(reject, notice({ kind: 'application_approved', userId: APPLICANT })));
    await assertFails(commit(approve, notice({ kind: 'application_rejected', userId: APPLICANT, remarks: REMARKS })));
    await assertFails(commit(approve, notice({ kind: 'application_approved', userId: OTHER })));
    await assertFails(
      commit(reject, notice({ kind: 'application_rejected', userId: APPLICANT, remarks: 'Something else' })),
    );
    await assertFails(
      commit(approve, notice({ kind: 'application_approved', userId: APPLICANT }, { reason: 'Welcome!' })),
    );
  });

  it('denies until or a refId on a system notice', async () => {
    await assertFails(
      commit(approve, notice({ kind: 'application_approved', userId: APPLICANT }, { until: Timestamp.now() })),
    );
    await assertFails(commit(approve, notice({ kind: 'application_approved', userId: APPLICANT }, { refId: 'x' })));
  });

  it('denies non-admins writing a notice, even with the decision', async () => {
    const firestore = db(APPLICANT);
    await assertFails(
      setDoc(doc(firestore, 'adminMessages', 'm1'), {
        ...notice({ kind: 'application_approved', userId: APPLICANT }),
        createdBy: APPLICANT,
      }),
    );
  });
});

// ─── Commission payment decisions ────────────────────────────────────────────

const { docs: MULTI, periods: PERIODS } = multiPeriodDocs();

function confirmPayment(batch: Batch, firestore: Firestore): void {
  const writes = confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null });
  batch.update(doc(firestore, 'commissionPayments', PAYMENT), writes.payment);
  if (writes.account) batch.update(doc(firestore, 'commissionAccounts', DRIVER), writes.account);
  if (writes.ledger?.kind === 'set') batch.set(doc(firestore, 'earningsLedger', 'totals'), writes.ledger.data);
  if (writes.ledger?.kind === 'update') batch.update(doc(firestore, 'earningsLedger', 'totals'), writes.ledger.data);
}

const REJECTION = 'Reference number not found';

function rejectPayment(batch: Batch, firestore: Firestore): void {
  batch.update(doc(firestore, 'commissionPayments', PAYMENT), {
    status: 'rejected',
    rejectionReason: REJECTION,
    reviewedAt: serverTimestamp(),
    reviewedBy: ADMIN,
  });
  batch.delete(doc(firestore, 'paymentReferences', REFERENCE));
}

const confirmedNotice = (overrides: Partial<{ userId: string; paymentId: string }> = {}): NoticeInput => ({
  kind: 'payment_confirmed',
  userId: DRIVER,
  paymentId: PAYMENT,
  amountCentavos: 700,
  reference: REFERENCE,
  ...overrides,
});

const rejectedNotice = (reason = REJECTION): NoticeInput => ({
  kind: 'payment_rejected',
  userId: DRIVER,
  paymentId: PAYMENT,
  amountCentavos: 700,
  reference: REFERENCE,
  reason,
});

describe('notices: commission payments', () => {
  beforeEach(async () => {
    await seed({ ...MULTI, ...submittedDocs(700), [`users/${OTHER}`]: { uid: OTHER, role: 'passenger' } });
  });

  it('accepts payment_confirmed in the confirm commit', async () => {
    await assertSucceeds(commit(confirmPayment, notice(confirmedNotice())));
  });

  it('accepts payment_rejected with exactly the stored reason', async () => {
    await assertSucceeds(commit(rejectPayment, notice(rejectedNotice())));
  });

  it('denies a payment notice without the review, for another user, or without refId', async () => {
    await assertFails(commit(null, notice(confirmedNotice())));
    await assertFails(commit(confirmPayment, notice(confirmedNotice({ userId: OTHER }))));
    await assertFails(commit(confirmPayment, notice(confirmedNotice({ paymentId: 'otherPayment' }))));
    await assertFails(commit(confirmPayment, notice(confirmedNotice(), { refId: null })));
  });

  it('denies the wrong status or reason', async () => {
    await assertFails(commit(rejectPayment, notice(confirmedNotice())));
    await assertFails(commit(confirmPayment, notice(rejectedNotice())));
    await assertFails(commit(rejectPayment, notice(rejectedNotice('Amount does not match'))));
    await assertFails(commit(confirmPayment, notice(confirmedNotice(), { reason: 'Thanks' })));
  });
});

// ─── Complaint resolution ────────────────────────────────────────────────────

function openComplaint(): DocumentData {
  return {
    bookingId: BOOKING,
    reporterId: PASSENGER,
    reporterRole: 'passenger',
    reportedUserId: DRIVER,
    category: 'other',
    message: 'Something went wrong on this trip.',
    status: 'in_review',
    adminNotes: '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function resolve(batch: Batch, firestore: Firestore): void {
  batch.update(doc(firestore, 'complaints', COMPLAINT_ID), {
    status: 'resolved',
    outcome: 'no_action',
    adminNotes: 'Private admin note.',
    resolvedAt: serverTimestamp(),
    resolvedBy: ADMIN,
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN,
  });
}

const reportNotice = (userId = PASSENGER): NoticeInput => ({
  kind: 'report_resolved',
  userId,
  complaintId: COMPLAINT_ID,
  tripDateLabel: 'Nov 18, 2026',
});

describe('notices: report resolved', () => {
  beforeEach(async () => {
    await seed({
      [`bookings/${BOOKING}`]: { passengerId: PASSENGER, driverId: DRIVER, status: 'completed' },
      [`complaints/${COMPLAINT_ID}`]: openComplaint(),
    });
  });

  it('accepts report_resolved to the reporter in the resolve commit', async () => {
    await assertSucceeds(commit(resolve, notice(reportNotice())));
  });

  it('denies it to the reported person, without the resolution, or with any reason', async () => {
    await assertFails(commit(resolve, notice(reportNotice(DRIVER))));
    await assertFails(commit(null, notice(reportNotice())));
    await assertFails(commit(resolve, notice(reportNotice(), { reason: 'Private admin note.' })));
    await assertFails(commit(resolve, notice(reportNotice(), { refId: 'otherBooking_passenger1' })));
  });

  it('denies a second notice once the complaint is already resolved (no resolution now)', async () => {
    await seed({
      [`complaints/${COMPLAINT_ID}`]: { ...openComplaint(), status: 'resolved', resolvedAt: Timestamp.now() },
    });
    await assertFails(commit(null, notice(reportNotice())));
  });
});

// ─── Account deletion decline ────────────────────────────────────────────────

const NOTE = 'We could not confirm that you hold this account.';

function decline(batch: Batch, firestore: Firestore): void {
  batch.update(doc(firestore, 'deletionRequests', PASSENGER), {
    status: 'declined',
    declineNote: NOTE,
    declinedAt: serverTimestamp(),
    declinedBy: ADMIN,
  });
}

describe('notices: account deletion declined', () => {
  beforeEach(async () => {
    await seed({
      [`deletionRequests/${PASSENGER}`]: { uid: PASSENGER, status: 'pending', requestedAt: Timestamp.now() },
      [`deletionRequests/${OTHER}`]: { uid: OTHER, status: 'pending', requestedAt: Timestamp.now() },
    });
  });

  it('accepts deletion_declined with the decline note in the decline commit', async () => {
    await assertSucceeds(commit(decline, notice({ kind: 'deletion_declined', userId: PASSENGER, note: NOTE })));
  });

  it('denies it without the decline, for another user, or with another reason', async () => {
    await assertFails(commit(null, notice({ kind: 'deletion_declined', userId: PASSENGER, note: NOTE })));
    await assertFails(commit(decline, notice({ kind: 'deletion_declined', userId: OTHER, note: NOTE })));
    await assertFails(commit(decline, notice({ kind: 'deletion_declined', userId: PASSENGER, note: 'Other text' })));
  });
});

// ─── Driver-action kinds keep their rules ────────────────────────────────────

describe('notices: existing kinds', () => {
  it('denies a refId on a suspension message and unknown kinds', async () => {
    const base = {
      userId: DRIVER,
      kind: 'suspension_lifted',
      title: 'Your suspension was lifted',
      body: 'TriGo lifted the suspension on your driver account.',
      reason: 'Reviewed again.',
      until: null,
      createdBy: ADMIN,
      createdAt: serverTimestamp(),
      readAt: null,
    };
    await assertSucceeds(setDoc(doc(adminDb(), 'adminMessages', 'ok'), base));
    await assertFails(setDoc(doc(adminDb(), 'adminMessages', 'withRef'), { ...base, refId: 'x' }));
    await assertFails(setDoc(doc(adminDb(), 'adminMessages', 'unknown'), { ...base, kind: 'announcement' }));
  });
});

describe('notices: the user reads their own and marks it read once', () => {
  beforeEach(async () => {
    await seed({
      'adminMessages/n1': {
        ...newNoticeDoc({ kind: 'report_resolved', userId: PASSENGER, complaintId: COMPLAINT_ID, tripDateLabel: null }, ADMIN, Timestamp.now()),
      },
    });
  });

  it('reads own, not others', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'adminMessages', 'n1')));
    await assertFails(getDoc(doc(db(OTHER), 'adminMessages', 'n1')));
    await assertSucceeds(getDocs(query(collection(db(PASSENGER), 'adminMessages'), where('userId', '==', PASSENGER))));
  });

  it('sets readAt once and never deletes', async () => {
    await assertFails(updateDoc(doc(db(OTHER), 'adminMessages', 'n1'), { readAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(PASSENGER), 'adminMessages', 'n1'), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(PASSENGER), 'adminMessages', 'n1'), { readAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(PASSENGER), 'adminMessages', 'n1')));
    await assertFails(deleteDoc(doc(adminDb(), 'adminMessages', 'n1')));
  });
});

// ─── Announcements ───────────────────────────────────────────────────────────

const DRAFT = { title: 'Holiday schedule', body: 'TriGo support is closed on Nov 30.', audience: 'all' as const, showUntilDate: '' };

function announcement(audience: 'all' | 'passengers' | 'drivers', overrides: DocumentData = {}): DocumentData {
  return { ...newAnnouncementDoc({ ...DRAFT, audience }, null, ADMIN, Timestamp.now()), ...overrides };
}

describe('announcements: admin writes', () => {
  it('lets an admin create one, with or without a later show-until time', async () => {
    await assertSucceeds(
      setDoc(doc(adminDb(), 'announcements', 'a1'), newAnnouncementDoc(DRAFT, null, ADMIN, serverTimestamp())),
    );
    await assertSucceeds(
      setDoc(
        doc(adminDb(), 'announcements', 'a2'),
        newAnnouncementDoc(DRAFT, Timestamp.fromMillis(Date.now() + DAY_MS), ADMIN, serverTimestamp()),
      ),
    );
  });

  it('denies non-admins and invalid announcements', async () => {
    const valid = newAnnouncementDoc(DRAFT, null, ADMIN, serverTimestamp());
    await assertFails(setDoc(doc(db(PASSENGER), 'announcements', 'a1'), { ...valid, createdBy: PASSENGER }));
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, audience: 'admins' }));
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, title: ' ' }));
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, body: 'x'.repeat(1001) }));
    await assertFails(
      setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, showUntil: Timestamp.fromMillis(Date.now() - DAY_MS) }),
    );
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, status: 'withdrawn' }));
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, createdAt: Timestamp.now() }));
    await assertFails(setDoc(doc(adminDb(), 'announcements', 'a1'), { ...valid, extra: true }));
  });

  it('lets an admin withdraw once; nobody edits the text or deletes', async () => {
    await seed({ 'announcements/a1': announcement('all') });
    await assertFails(updateDoc(doc(adminDb(), 'announcements', 'a1'), { title: 'Changed' }));
    await assertFails(updateDoc(doc(db(PASSENGER), 'announcements', 'a1'), withdrawnAnnouncementUpdate(PASSENGER, serverTimestamp())));
    await assertSucceeds(updateDoc(doc(adminDb(), 'announcements', 'a1'), withdrawnAnnouncementUpdate(ADMIN, serverTimestamp())));
    await assertFails(updateDoc(doc(adminDb(), 'announcements', 'a1'), withdrawnAnnouncementUpdate(ADMIN, serverTimestamp())));
    await assertFails(deleteDoc(doc(adminDb(), 'announcements', 'a1')));
  });
});

describe('announcements: audience reads', () => {
  beforeEach(async () => {
    await seed({
      [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
      [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
      [`users/${APPROVED_APPLICANT}`]: { uid: APPROVED_APPLICANT, role: 'passenger' },
      [`drivers/${APPROVED_APPLICANT}`]: { fullName: 'Ana', isVerified: true },
      [`driverApplications/${APPROVED_APPLICANT}`]: { status: 'approved' },
      'announcements/all': announcement('all'),
      'announcements/passengers': announcement('passengers'),
      'announcements/drivers': announcement('drivers'),
      'announcements/withdrawn': announcement('all', { status: 'withdrawn', withdrawnAt: Timestamp.now(), withdrawnBy: ADMIN }),
    });
  });

  const audienceQuery = (uid: string, audience: string) =>
    getDocs(
      query(collection(db(uid), 'announcements'), where('audience', '==', audience), where('status', '==', 'active')),
    );

  it('passengers read all + passengers, not drivers', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'announcements', 'all')));
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'announcements', 'passengers')));
    await assertFails(getDoc(doc(db(PASSENGER), 'announcements', 'drivers')));
    await assertSucceeds(audienceQuery(PASSENGER, 'all'));
    await assertSucceeds(audienceQuery(PASSENGER, 'passengers'));
    await assertFails(audienceQuery(PASSENGER, 'drivers'));
  });

  it('drivers read all + drivers, not passengers', async () => {
    await assertSucceeds(audienceQuery(DRIVER, 'all'));
    await assertSucceeds(audienceQuery(DRIVER, 'drivers'));
    await assertFails(getDoc(doc(db(DRIVER), 'announcements', 'passengers')));
  });

  it('approved applicants read both passenger and driver announcements', async () => {
    await assertSucceeds(audienceQuery(APPROVED_APPLICANT, 'passengers'));
    await assertSucceeds(audienceQuery(APPROVED_APPLICANT, 'drivers'));
  });

  it('nobody but admins reads withdrawn ones or lists without the filters', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'announcements', 'withdrawn')));
    await assertFails(getDocs(collection(db(PASSENGER), 'announcements')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore() as unknown as Firestore, 'announcements', 'all')));
    await assertSucceeds(getDoc(doc(adminDb(), 'announcements', 'withdrawn')));
    await assertSucceeds(getDocs(collection(adminDb(), 'announcements')));
  });
});

describe('announcements: read state (users/{uid}/inboxState/announcements)', () => {
  const stateRef = (firestore: Firestore, uid: string, id = 'announcements') =>
    doc(firestore, 'users', uid, 'inboxState', id);

  it('lets the user write and read their own', async () => {
    await assertSucceeds(
      setDoc(stateRef(db(PASSENGER), PASSENGER), { readIds: ['a1'], updatedAt: serverTimestamp() }, { merge: true }),
    );
    await assertSucceeds(
      setDoc(stateRef(db(PASSENGER), PASSENGER), { lastReadAllAt: serverTimestamp(), readIds: [], updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(getDoc(stateRef(db(PASSENGER), PASSENGER)));
  });

  it('denies other users, admins writing, other documents, and bad shapes', async () => {
    const valid = { lastReadAllAt: null, readIds: [], updatedAt: serverTimestamp() };
    await assertFails(setDoc(stateRef(db(OTHER), PASSENGER), valid));
    await assertFails(getDoc(stateRef(db(OTHER), PASSENGER)));
    await assertFails(setDoc(stateRef(adminDb(), PASSENGER), valid));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER, 'other'), valid));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER), { ...valid, readIds: Array.from({ length: 201 }, (_, i) => `a${i}`) }));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER), { ...valid, readIds: 'a1' }));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER), { ...valid, lastReadAllAt: 'yesterday' }));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER), { ...valid, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(stateRef(db(PASSENGER), PASSENGER), { ...valid, extra: 1 }));
  });

  it('nobody deletes it', async () => {
    await seed({ [`users/${PASSENGER}/inboxState/announcements`]: { lastReadAllAt: null, readIds: [], updatedAt: Timestamp.now() } });
    await assertFails(deleteDoc(stateRef(db(PASSENGER), PASSENGER)));
  });
});

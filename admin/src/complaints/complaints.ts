import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { readBooking, type AdminBooking } from '../bookings/bookings';
import { db } from '../firebase/config';

// complaints/{bookingId}_{reporterUid}: "Report a problem" from the mobile app, by the
// booking's passenger or its assigned driver. Admins list them and set status + notes
// (firestore.rules, complaints: admin review). Nobody deletes them.

export type ComplaintStatus = 'open' | 'in_review' | 'resolved';
export type ComplaintRole = 'passenger' | 'driver';

export const COMPLAINT_STATUSES: ComplaintStatus[] = ['open', 'in_review', 'resolved'];

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
};

export const COMPLAINT_CATEGORY_LABELS = {
  driver_behavior: 'Driver behavior',
  passenger_behavior: 'Passenger behavior',
  fare_or_payment: 'Fare or payment',
  safety: 'Safety concern',
  lost_item: 'Lost item',
  app_problem: 'Problem with the app',
  other: 'Something else',
} as const;

export const ROLE_LABELS: Record<ComplaintRole, string> = { passenger: 'Passenger', driver: 'Driver' };

/** Same limit as firestore.rules (adminNotes.size() <= 1000). */
export const MAX_ADMIN_NOTES_LENGTH = 1000;

/** The list query returns at most this many complaints (newest first). */
export const COMPLAINT_QUERY_LIMIT = 200;

export type AdminComplaint = {
  complaintId: string;
  bookingId: string;
  reporterId: string;
  reporterRole: ComplaintRole | null;
  category: keyof typeof COMPLAINT_CATEGORY_LABELS | null;
  message: string;
  status: ComplaintStatus;
  adminNotes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function readStatus(value: unknown): ComplaintStatus {
  return value === 'in_review' || value === 'resolved' ? value : 'open';
}

export function readComplaint(complaintId: string, data: DocumentData): AdminComplaint {
  return {
    complaintId,
    bookingId: typeof data.bookingId === 'string' ? data.bookingId : '',
    reporterId: typeof data.reporterId === 'string' ? data.reporterId : '',
    reporterRole: data.reporterRole === 'passenger' || data.reporterRole === 'driver' ? data.reporterRole : null,
    category:
      typeof data.category === 'string' && data.category in COMPLAINT_CATEGORY_LABELS
        ? (data.category as keyof typeof COMPLAINT_CATEGORY_LABELS)
        : null,
    message: typeof data.message === 'string' ? data.message : '',
    status: readStatus(data.status),
    adminNotes: typeof data.adminNotes === 'string' ? data.adminNotes : '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  };
}

async function loadNames(uids: string[]): Promise<Map<string, string>> {
  const snapshots = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
  const names = new Map<string, string>();
  for (const snap of snapshots) {
    const fullName = snap.data()?.fullName;
    if (typeof fullName === 'string' && fullName) names.set(snap.id, fullName);
  }
  return names;
}

/** Complaints per status, counted by Firestore (no documents downloaded). */
export async function loadComplaintCounts(): Promise<Record<ComplaintStatus, number>> {
  const counts = await Promise.all(
    COMPLAINT_STATUSES.map(async (status) =>
      (await getCountFromServer(query(collection(db, 'complaints'), where('status', '==', status)))).data().count,
    ),
  );
  return { open: counts[0], in_review: counts[1], resolved: counts[2] };
}

export type ComplaintListEntry = { complaint: AdminComplaint; reporterName: string };

export type ComplaintList = {
  entries: ComplaintListEntry[];
  /** True when the query hit COMPLAINT_QUERY_LIMIT, so older complaints are not shown. */
  truncated: boolean;
};

/**
 * Newest first, at most COMPLAINT_QUERY_LIMIT, optionally one status. The status filter uses
 * the composite index complaints (status ASC, createdAt DESC) in firestore.indexes.json.
 */
export async function loadComplaints(status: ComplaintStatus | null): Promise<ComplaintList> {
  const snapshot = await getDocs(
    query(
      collection(db, 'complaints'),
      ...(status ? [where('status', '==', status)] : []),
      orderBy('createdAt', 'desc'),
      limit(COMPLAINT_QUERY_LIMIT),
    ),
  );
  const complaints = snapshot.docs.map((d) => readComplaint(d.id, d.data()));
  const names = await loadNames([...new Set(complaints.map((c) => c.reporterId).filter(Boolean))]);
  return {
    entries: complaints.map((complaint) => ({ complaint, reporterName: names.get(complaint.reporterId) ?? '' })),
    truncated: snapshot.size >= COMPLAINT_QUERY_LIMIT,
  };
}

export type ComplaintDetail = {
  complaint: AdminComplaint;
  booking: AdminBooking | null;
  reporterName: string;
  passengerName: string;
  driverName: string;
  /** Email of the admin who last changed it, when it is still a user profile. */
  updatedByEmail: string | null;
};

export async function loadComplaintDetail(complaintId: string): Promise<ComplaintDetail | null> {
  const complaintSnap = await getDoc(doc(db, 'complaints', complaintId));
  if (!complaintSnap.exists()) return null;
  const complaint = readComplaint(complaintSnap.id, complaintSnap.data());

  const bookingSnap = complaint.bookingId ? await getDoc(doc(db, 'bookings', complaint.bookingId)) : null;
  const booking = bookingSnap?.exists() ? readBooking(bookingSnap.id, bookingSnap.data()) : null;

  const uids = [complaint.reporterId, booking?.passengerId, booking?.driverId, complaint.updatedBy].filter(
    (uid): uid is string => typeof uid === 'string' && uid !== '',
  );
  // Admin accounts may have no users/{uid} profile; a failed or missing read shows the uid.
  const users = await Promise.all(
    [...new Set(uids)].map(async (uid) => [uid, (await getDoc(doc(db, 'users', uid)).catch(() => null))?.data()] as const),
  );
  const userById = new Map(users);
  const name = (uid: string | null | undefined) => (uid ? (userById.get(uid)?.fullName ?? '') : '');
  const updatedByEmail = complaint.updatedBy ? userById.get(complaint.updatedBy)?.email : undefined;

  return {
    complaint,
    booking,
    reporterName: name(complaint.reporterId),
    passengerName: name(booking?.passengerId),
    driverName: name(booking?.driverId),
    updatedByEmail: typeof updatedByEmail === 'string' ? updatedByEmail : null,
  };
}

export class ComplaintConflictError extends Error {}

/**
 * Sets the status and admin notes. The transaction re-reads the complaint so a change another
 * admin saved after this page loaded is not overwritten silently.
 */
export async function reviewComplaint(
  complaintId: string,
  adminUid: string,
  expected: { status: ComplaintStatus; adminNotes: string },
  next: { status: ComplaintStatus; adminNotes: string },
): Promise<void> {
  const complaintRef = doc(db, 'complaints', complaintId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(complaintRef);
    if (!snap.exists()) throw new ComplaintConflictError('This complaint no longer exists.');
    const current = readComplaint(snap.id, snap.data());
    if (current.status !== expected.status || current.adminNotes !== expected.adminNotes) {
      throw new ComplaintConflictError('Another admin changed this complaint. Reload the page to see the latest.');
    }
    // Exact field set allowed by firestore.rules (complaints, admin review).
    transaction.update(complaintRef, {
      status: next.status,
      adminNotes: next.adminNotes,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  });
}

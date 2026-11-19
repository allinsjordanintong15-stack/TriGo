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
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { readBooking, type AdminBooking } from '../bookings/bookings';
import {
  newAdminMessageDoc,
  suspensionEndMillis,
  suspensionUpdate,
  type SuspensionDuration,
} from '../drivers/driverActionPlan';
import { db } from '../firebase/config';
import { newNoticeDoc } from '../inbox/noticePlan';
import { formatDateTime } from '../lib/format';
import { newWarningDoc, validateWarningReason } from '../warnings/warningPlan';
import {
  readOutcome,
  reopenedComplaintUpdate,
  resolvedComplaintUpdate,
  suspendBlockReason,
  validateResolveNote,
  warnBlockReason,
  type ComplaintOutcome,
} from './complaintResolve';
import { reportedRoleFor, reportedUserOf } from './reportedParty';

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

/**
 * Admin Complaints tabs (/complaints/:tab), by who reported: passengers report drivers,
 * drivers report passengers.
 */
export type ComplaintTab = 'against-drivers' | 'against-passengers';

export const COMPLAINT_TABS: { tab: ComplaintTab; reporterRole: ComplaintRole; label: string }[] = [
  { tab: 'against-drivers', reporterRole: 'passenger', label: 'Against drivers' },
  { tab: 'against-passengers', reporterRole: 'driver', label: 'Against passengers' },
];

export function complaintTab(value: string | undefined): (typeof COMPLAINT_TABS)[number] | undefined {
  return COMPLAINT_TABS.find((t) => t.tab === value);
}

/** The tab a complaint is listed under; null when its reporterRole is unreadable. */
export function tabForRole(role: ComplaintRole | null): ComplaintTab | null {
  return COMPLAINT_TABS.find((t) => t.reporterRole === role)?.tab ?? null;
}

/** Same limit as firestore.rules (adminNotes.size() <= 1000). */
export const MAX_ADMIN_NOTES_LENGTH = 1000;

/** The list query returns at most this many complaints (newest first). */
export const COMPLAINT_QUERY_LIMIT = 200;

export type AdminComplaint = {
  complaintId: string;
  bookingId: string;
  reporterId: string;
  reporterRole: ComplaintRole | null;
  /**
   * Who the complaint is about (the other side of the booking); null when the booking had no
   * driver; undefined on complaints from before 2026-11-10, which don't store it.
   */
  reportedUserId: string | null | undefined;
  category: keyof typeof COMPLAINT_CATEGORY_LABELS | null;
  message: string;
  status: ComplaintStatus;
  adminNotes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  /** Set when resolved with the one-step resolve (from 2026-11-16); null otherwise. */
  outcome: ComplaintOutcome | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
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
    reportedUserId:
      typeof data.reportedUserId === 'string' && data.reportedUserId
        ? data.reportedUserId
        : 'reportedUserId' in data
          ? null
          : undefined,
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
    outcome: readOutcome(data.outcome),
    resolvedAt: toDate(data.resolvedAt),
    resolvedBy: typeof data.resolvedBy === 'string' ? data.resolvedBy : null,
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

/**
 * Complaints per status from one kind of reporter, counted by Firestore (no documents
 * downloaded). Equality filters only, so no composite index is needed.
 */
export async function loadComplaintCounts(reporterRole: ComplaintRole): Promise<Record<ComplaintStatus, number>> {
  const counts = await Promise.all(
    COMPLAINT_STATUSES.map(async (status) =>
      (
        await getCountFromServer(
          query(
            collection(db, 'complaints'),
            where('reporterRole', '==', reporterRole),
            where('status', '==', status),
          ),
        )
      ).data().count,
    ),
  );
  return { open: counts[0], in_review: counts[1], resolved: counts[2] };
}

/**
 * Complaints against one person in one role (as a driver: reported by passengers; as a
 * passenger: reported by drivers), counted by Firestore. Only complaints that store
 * reportedUserId (from 2026-11-10) are counted. Equality filters only: no composite index.
 */
export async function countComplaintsAgainst(uid: string, as: ComplaintRole): Promise<number> {
  const reporterRole: ComplaintRole = as === 'driver' ? 'passenger' : 'driver';
  const snapshot = await getCountFromServer(
    query(collection(db, 'complaints'), where('reportedUserId', '==', uid), where('reporterRole', '==', reporterRole)),
  );
  return snapshot.data().count;
}

export type ComplaintListEntry = {
  complaint: AdminComplaint;
  reporterName: string;
  /** Null when the complaint doesn't store reportedUserId (older) or names nobody (no driver). */
  reportedName: string | null;
};

export type ComplaintList = {
  entries: ComplaintListEntry[];
  /** True when the query hit COMPLAINT_QUERY_LIMIT, so older complaints are not shown. */
  truncated: boolean;
};

/**
 * One kind of reporter's complaints, newest first, at most COMPLAINT_QUERY_LIMIT, optionally
 * one status. Composite indexes in firestore.indexes.json: complaints (reporterRole ASC,
 * createdAt DESC) and (reporterRole ASC, status ASC, createdAt DESC).
 */
export async function loadComplaints(
  reporterRole: ComplaintRole,
  status: ComplaintStatus | null,
): Promise<ComplaintList> {
  const snapshot = await getDocs(
    query(
      collection(db, 'complaints'),
      where('reporterRole', '==', reporterRole),
      ...(status ? [where('status', '==', status)] : []),
      orderBy('createdAt', 'desc'),
      limit(COMPLAINT_QUERY_LIMIT),
    ),
  );
  const complaints = snapshot.docs.map((d) => readComplaint(d.id, d.data()));
  // One profile read per distinct person (reporters and reported together), not per row.
  const uids = complaints.flatMap((c) => [c.reporterId, c.reportedUserId ?? '']).filter(Boolean);
  const names = await loadNames([...new Set(uids)]);
  return {
    entries: complaints.map((complaint) => ({
      complaint,
      reporterName: names.get(complaint.reporterId) ?? '',
      reportedName: complaint.reportedUserId ? (names.get(complaint.reportedUserId) ?? '') : null,
    })),
    truncated: snapshot.size >= COMPLAINT_QUERY_LIMIT,
  };
}

export type ComplaintDetail = {
  complaint: AdminComplaint;
  booking: AdminBooking | null;
  reporterName: string;
  passengerName: string;
  driverName: string;
  /** Who the complaint is about (stored, or from the booking for older complaints). */
  reported: { uid: string; role: ComplaintRole; name: string } | null;
  /** The reported person's mobile number from their profile ('' when none). */
  reportedPhone: string;
  /** Email of the admin who last changed it, when it is still a user profile. */
  updatedByEmail: string | null;
  /** Name of the admin who last changed it, when their profile has one. */
  updatedByName: string | null;
};

export async function loadComplaintDetail(complaintId: string): Promise<ComplaintDetail | null> {
  const complaintSnap = await getDoc(doc(db, 'complaints', complaintId));
  if (!complaintSnap.exists()) return null;
  const complaint = readComplaint(complaintSnap.id, complaintSnap.data());

  const bookingSnap = complaint.bookingId ? await getDoc(doc(db, 'bookings', complaint.bookingId)) : null;
  const booking = bookingSnap?.exists() ? readBooking(bookingSnap.id, bookingSnap.data()) : null;

  const reportedUid = reportedUserOf(complaint, booking);
  const reportedRole = reportedRoleFor(complaint.reporterRole);

  const uids = [complaint.reporterId, booking?.passengerId, booking?.driverId, reportedUid, complaint.updatedBy].filter(
    (uid): uid is string => typeof uid === 'string' && uid !== '',
  );
  // Admin accounts may have no users/{uid} profile; a failed or missing read shows the uid.
  const users = await Promise.all(
    [...new Set(uids)].map(async (uid) => [uid, (await getDoc(doc(db, 'users', uid)).catch(() => null))?.data()] as const),
  );
  const userById = new Map(users);
  const name = (uid: string | null | undefined) => (uid ? (userById.get(uid)?.fullName ?? '') : '');
  const updatedByEmail = complaint.updatedBy ? userById.get(complaint.updatedBy)?.email : undefined;
  const updatedByName = complaint.updatedBy ? userById.get(complaint.updatedBy)?.fullName : undefined;
  const reportedPhone = reportedUid ? userById.get(reportedUid)?.mobileNumber : undefined;

  return {
    complaint,
    booking,
    reporterName: name(complaint.reporterId),
    passengerName: name(booking?.passengerId),
    driverName: name(booking?.driverId),
    reported: reportedUid && reportedRole ? { uid: reportedUid, role: reportedRole, name: name(reportedUid) } : null,
    reportedPhone: typeof reportedPhone === 'string' ? reportedPhone : '',
    updatedByEmail: typeof updatedByEmail === 'string' ? updatedByEmail : null,
    updatedByName: typeof updatedByName === 'string' && updatedByName ? updatedByName : null,
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
    if (next.status === 'resolved' && current.status !== 'resolved') {
      // Resolving needs an outcome (resolveComplaint); only notes can change once resolved.
      throw new ComplaintConflictError('Choose how this complaint was resolved.');
    }
    // Exact field set allowed by firestore.rules (complaints, admin review). Leaving
    // Resolved (reopening) clears the outcome.
    transaction.update(
      complaintRef,
      next.status === 'resolved'
        ? { status: next.status, adminNotes: next.adminNotes, updatedAt: serverTimestamp(), updatedBy: adminUid }
        : current.status === 'resolved' || current.outcome !== null
          ? reopenedComplaintUpdate(next.adminNotes, adminUid, serverTimestamp())
          : { status: next.status, adminNotes: next.adminNotes, updatedAt: serverTimestamp(), updatedBy: adminUid },
    );
  });
}

export type ResolveChoice =
  | { outcome: 'no_action' }
  | { outcome: 'warned'; reason: string }
  | { outcome: 'suspended'; reason: string; duration: SuspensionDuration };

/**
 * Resolves the complaint in ONE transaction: status Resolved with the outcome, note,
 * resolvedAt/resolvedBy, and, when chosen, the warning (warnings/{complaintId}) or the
 * reported driver's suspension with its message (adminMessages). firestore.rules checks
 * that the outcome matches what is written in the same commit. The reporter always gets a
 * "we reviewed your report" notice (report_resolved) with only the trip date: never the
 * note, the outcome or anything about the other person. `tripDateLabel` is the booking date
 * as the admin sees it, or null when unknown.
 */
export async function resolveComplaint(
  complaintId: string,
  adminUid: string,
  expectedStatus: ComplaintStatus,
  note: string,
  choice: ResolveChoice,
  tripDateLabel: string | null,
): Promise<void> {
  const noteError = validateResolveNote(note);
  if (noteError) throw new ComplaintConflictError(noteError);
  if (choice.outcome !== 'no_action') {
    const reasonError = validateWarningReason(choice.reason);
    if (reasonError) throw new ComplaintConflictError(reasonError);
  }
  const complaintRef = doc(db, 'complaints', complaintId);
  const warningRef = doc(db, 'warnings', complaintId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(complaintRef);
    if (!snap.exists()) throw new ComplaintConflictError('This complaint no longer exists.');
    const complaint = readComplaint(snap.id, snap.data());
    if (complaint.status !== expectedStatus || complaint.status === 'resolved') {
      throw new ComplaintConflictError('Another admin changed this complaint. Reload it to see the latest.');
    }
    const reportedUid = typeof complaint.reportedUserId === 'string' ? complaint.reportedUserId : null;
    const reportedRole = reportedRoleFor(complaint.reporterRole);
    const now = serverTimestamp();

    if (choice.outcome === 'warned') {
      const warningSnap = await transaction.get(warningRef);
      const blocked = warnBlockReason({
        reportedUserId: complaint.reportedUserId,
        reporterRole: complaint.reporterRole,
        warningExists: warningSnap.exists(),
      });
      if (blocked || !reportedUid || !reportedRole) throw new ComplaintConflictError(blocked ?? 'This complaint cannot lead to a warning.');
      transaction.set(
        warningRef,
        newWarningDoc(
          { userId: reportedUid, role: reportedRole, complaintId, bookingId: complaint.bookingId, reason: choice.reason },
          adminUid,
          now,
        ),
      );
    }

    if (choice.outcome === 'suspended') {
      const blocked = suspendBlockReason({
        reportedUserId: complaint.reportedUserId,
        reporterRole: complaint.reporterRole,
        warningExists: false,
      });
      if (blocked || !reportedUid) throw new ComplaintConflictError(blocked ?? 'This driver cannot be suspended here.');
      const driverRef = doc(db, 'drivers', reportedUid);
      const driverSnap = await transaction.get(driverRef);
      if (!driverSnap.exists()) throw new ComplaintConflictError('This driver record no longer exists.');
      const endMillis = suspensionEndMillis(choice.duration, Date.now());
      const until = endMillis === null ? null : Timestamp.fromMillis(endMillis);
      const untilLabel = endMillis === null ? null : formatDateTime(new Date(endMillis));
      // Same writes as the Drivers page's Suspend (drivers.ts suspendDriver).
      transaction.update(driverRef, suspensionUpdate(choice.reason, until, adminUid, now));
      transaction.set(
        doc(collection(db, 'adminMessages')),
        newAdminMessageDoc({ userId: reportedUid, kind: 'suspended', reason: choice.reason, until, untilLabel }, adminUid, now),
      );
    }

    transaction.update(complaintRef, resolvedComplaintUpdate(choice.outcome, note, adminUid, now));
    if (complaint.reporterId) {
      transaction.set(
        doc(collection(db, 'adminMessages')),
        newNoticeDoc({ kind: 'report_resolved', userId: complaint.reporterId, complaintId, tripDateLabel }, adminUid, now),
      );
    }
  });
}

/** Who an older complaint is about, worked out from its booking; null = the trip had no driver. */
export type ReportedFallback = { uid: string; name: string } | null;

/**
 * For complaints filed before 2026-11-10 (no reportedUserId): the other side of each one's
 * booking. Call it for the rows on screen only: one booking read and one name read each.
 */
export async function loadReportedFallback(complaints: AdminComplaint[]): Promise<Map<string, ReportedFallback>> {
  const older = complaints.filter((c) => c.reportedUserId === undefined && c.bookingId);
  const bookings = await Promise.all(
    older.map((c) => getDoc(doc(db, 'bookings', c.bookingId)).catch(() => null)),
  );
  const uids = older.map((c, i) => {
    const data = bookings[i]?.data();
    return reportedUserOf(c, data ? { passengerId: data.passengerId ?? null, driverId: data.driverId ?? null } : null);
  });
  const names = await loadNames([...new Set(uids.filter((uid): uid is string => Boolean(uid)))]);
  return new Map(older.map((c, i) => [c.complaintId, uids[i] ? { uid: uids[i] as string, name: names.get(uids[i] as string) ?? '' } : null]));
}

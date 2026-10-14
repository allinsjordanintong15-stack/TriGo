import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '../firebase/config';

// driverApplications/{uid} is written by the applicant in the mobile app; admins only
// change status, adminRemarks, reviewedAt and updatedAt (firestore.rules). Approving also
// creates drivers/{uid} in the same commit; users/{uid}.role is not changed.

export const VEHICLE_TYPES = ['tricycle', 'motorcycle'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  tricycle: 'Tricycle',
  motorcycle: 'Motorcycle',
};

export const MAX_REMARKS_LENGTH = 500;

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type ApplicationDocument = { fileName: string; contentType: string } | null;

export type DriverApplication = {
  uid: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  vehicleType: VehicleType | null;
  vehiclePlate: string;
  documents: { orCr: ApplicationDocument; ltoLicense: ApplicationDocument };
  status: ApplicationStatus;
  /** On a pending application, remarks from an earlier rejection (resubmitted). */
  adminRemarks: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  /** submittedAt in ms, to detect a resubmission between viewing and saving. */
  submittedAtMillis: number | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function readDocument(value: unknown): ApplicationDocument {
  const entry = value as { fileName?: unknown; contentType?: unknown } | null | undefined;
  if (!entry) return null;
  return {
    fileName: typeof entry.fileName === 'string' ? entry.fileName : 'Unnamed file',
    contentType: typeof entry.contentType === 'string' ? entry.contentType : '',
  };
}

function readApplication(uid: string, data: DocumentData): DriverApplication {
  const submittedAt = toDate(data.submittedAt);
  const vehicleType = VEHICLE_TYPES.includes(data.vehicleType) ? (data.vehicleType as VehicleType) : null;
  return {
    uid,
    firstName: data.firstName ?? '',
    middleName: data.middleName ?? null,
    lastName: data.lastName ?? '',
    fullName: data.fullName ?? '',
    email: data.email ?? '',
    mobileNumber: data.mobileNumber ?? '',
    vehicleType,
    vehiclePlate: data.vehiclePlate ?? '',
    documents: {
      orCr: readDocument(data.documents?.orCr),
      ltoLicense: readDocument(data.documents?.ltoLicense),
    },
    status: data.status,
    adminRemarks: data.adminRemarks ?? null,
    submittedAt,
    reviewedAt: toDate(data.reviewedAt),
    submittedAtMillis: submittedAt ? submittedAt.getTime() : null,
  };
}

/** Pending applications, oldest first (sorted here to avoid a composite index). */
export async function loadPendingApplications(): Promise<DriverApplication[]> {
  const snapshot = await getDocs(query(collection(db, 'driverApplications'), where('status', '==', 'pending')));
  return snapshot.docs
    .map((d) => readApplication(d.id, d.data()))
    .sort((a, b) => (a.submittedAtMillis ?? 0) - (b.submittedAtMillis ?? 0));
}

export async function loadApplication(uid: string): Promise<DriverApplication | null> {
  const snapshot = await getDoc(doc(db, 'driverApplications', uid));
  return snapshot.exists() ? readApplication(uid, snapshot.data()) : null;
}

export class ReviewConflictError extends Error {}

/** Re-reads the application in the transaction: it must still be the pending submission the admin viewed. */
function assertStillPending(viewed: DriverApplication, data: DocumentData | undefined): DriverApplication {
  if (!data) {
    throw new ReviewConflictError('This application no longer exists.');
  }
  const current = readApplication(viewed.uid, data);
  if (current.status !== 'pending') {
    throw new ReviewConflictError('This application was already reviewed. Go back to the list to see the latest.');
  }
  if (current.submittedAtMillis !== viewed.submittedAtMillis) {
    throw new ReviewConflictError('The applicant changed this application. Reload it and review again.');
  }
  return current;
}

function normalizeRemarks(remarks: string): string | null {
  const trimmed = remarks.trim();
  return trimmed ? trimmed : null;
}

/** Approves the application and creates drivers/{uid} in one commit. */
export async function approveApplication(
  viewed: DriverApplication,
  vehicleType: VehicleType,
  remarks: string,
): Promise<void> {
  const applicationRef = doc(db, 'driverApplications', viewed.uid);
  const driverRef = doc(db, 'drivers', viewed.uid);
  // drivers/{uid} is not read here: firestore.rules refuses the approval if one already
  // exists (writing over it is an update, and no update rule accepts these fields).
  await runTransaction(db, async (transaction) => {
    const current = assertStillPending(viewed, (await transaction.get(applicationRef)).data());
    transaction.update(applicationRef, {
      status: 'approved',
      adminRemarks: normalizeRemarks(remarks),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Exact field set required by firestore.rules (drivers create).
    transaction.set(driverRef, {
      fullName: current.fullName,
      vehiclePlate: current.vehiclePlate,
      vehicleType,
      isVerified: true,
      isOnline: false,
      isAvailable: false,
      currentLocation: null,
      currentBookingId: null,
      currentRequestId: null,
      rating: 0,
      profileImage: null,
    });
  });
}

/** Rejects the application; the remarks are shown to the applicant. */
export async function rejectApplication(viewed: DriverApplication, remarks: string): Promise<void> {
  const applicationRef = doc(db, 'driverApplications', viewed.uid);
  await runTransaction(db, async (transaction) => {
    assertStillPending(viewed, (await transaction.get(applicationRef)).data());
    transaction.update(applicationRef, {
      status: 'rejected',
      adminRemarks: remarks.trim(),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function formatDateTime(date: Date | null): string {
  return date ? date.toLocaleString() : '—';
}

import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_TYPES,
} from '@/constants/applicationDocuments';
import { LEGAL_VERSION } from '@/constants/legal';
import { COLLECTIONS, firestore } from '@/firebase';
import {
  ApplicationDocumentImage,
  ApplicationDocumentReference,
  applicationDocumentStore,
} from '@/services/applicationDocumentService';
import {
  DriverApplication,
  DriverApplicationDocument,
  DriverApplicationDocumentType,
  DriverApplicationStatus,
  User,
  VehicleType,
} from '@/types';
import { validateMobileNumber } from '@/validations/auth';
import {
  normalizePersonName,
  normalizeVehiclePlate,
  normalizeVehicleText,
  validatePersonName,
  validateVehicleBrand,
  validateVehicleColor,
  validateVehicleModel,
  validateVehiclePlate,
} from '@/validations/driverApplication';
import {
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export class DriverApplicationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverApplicationServiceError';
  }
}

export type { ApplicationDocumentImage };

export interface DriverApplicationInput {
  firstName: string;
  middleName: string;
  lastName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  documents: Record<DriverApplicationDocumentType, ApplicationDocumentImage | null>;
  /** The "I've read this" checkbox under the short privacy notice above Submit. */
  privacyNoticeAcknowledged: boolean;
}

export const DOCUMENT_LABELS: Record<DriverApplicationDocumentType, string> = APPLICATION_DOCUMENT_LABELS;

export function composeFullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName]
    .map((part) => (part ? normalizePersonName(part) : ''))
    .filter(Boolean)
    .join(' ');
}

/** Best-effort split of a single account name, used only to pre-fill the form. */
export function splitFullName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = normalizePersonName(fullName).split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/**
 * The reference {sizeBytes, uploadedAt} to a photo on file. Null when missing, null, or in
 * the older Cloud Storage shape (never uploaded in production): "No documents on file".
 */
function toApplicationDocument(value: unknown): DriverApplicationDocument | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.sizeBytes !== 'number') return null;
  return { sizeBytes: data.sizeBytes, uploadedAt: toDate(data.uploadedAt) };
}

export function docToDriverApplication(uid: string, data: DocumentData): DriverApplication {
  const fullName: string = data.fullName ?? '';
  // Applications from before structured names only stored `fullName`.
  const fallbackName = splitFullName(fullName);
  const documents =
    data.documents && typeof data.documents === 'object' && !Array.isArray(data.documents)
      ? (data.documents as Record<string, unknown>)
      : {};

  return {
    uid,
    firstName: data.firstName ?? fallbackName.firstName,
    middleName:
      typeof data.middleName === 'string' ? data.middleName : fallbackName.middleName || null,
    lastName: data.lastName ?? fallbackName.lastName,
    fullName,
    email: data.email ?? '',
    mobileNumber: data.mobileNumber ?? '',
    vehicleType: data.vehicleType as VehicleType,
    vehiclePlate: data.vehiclePlate ?? '',
    // Missing on applications submitted before these were required.
    vehicleBrand: typeof data.vehicleBrand === 'string' ? data.vehicleBrand : null,
    vehicleModel: typeof data.vehicleModel === 'string' ? data.vehicleModel : null,
    vehicleColor: typeof data.vehicleColor === 'string' ? data.vehicleColor : null,
    documents: {
      orCr: toApplicationDocument(documents.orCr),
      ltoLicense: toApplicationDocument(documents.ltoLicense),
    },
    status: data.status as DriverApplicationStatus,
    adminRemarks: typeof data.adminRemarks === 'string' ? data.adminRemarks : null,
    submittedAt: toDate(data.submittedAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
    reviewedAt: toDate(data.reviewedAt),
  };
}

/** Live view of the user's own application; emits `null` when they have not applied. */
export function subscribeToDriverApplication(
  uid: string,
  onUpdate: (application: DriverApplication | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(firestore, COLLECTIONS.driverApplications, uid),
    (snapshot) => {
      const data = snapshot.data();
      onUpdate(snapshot.exists() && data ? docToDriverApplication(snapshot.id, data) : null);
    },
    (error) => onError(error),
  );
}

function validateInput(user: User, email: string, input: DriverApplicationInput): string | null {
  return (
    validatePersonName(input.firstName, 'First name', true) ??
    validatePersonName(input.middleName, 'Middle name', false) ??
    validatePersonName(input.lastName, 'Last name', true) ??
    (email ? null : 'Your account email could not be found. Please sign in again.') ??
    (validateMobileNumber(user.mobileNumber)
      ? 'Please add a valid mobile number in Edit Profile before applying.'
      : null) ??
    validateVehiclePlate(input.vehiclePlate) ??
    validateVehicleBrand(input.vehicleBrand) ??
    validateVehicleModel(input.vehicleModel) ??
    validateVehicleColor(input.vehicleColor) ??
    (input.documents.orCr ? null : 'Please add a photo of your OR/CR.') ??
    (input.documents.ltoLicense ? null : "Please add a photo of your LTO-verified driver's license.") ??
    (input.privacyNoticeAcknowledged
      ? null
      : "Please read the note about your data and tick \"I've read this\" before submitting.")
  );
}

/** Turns a Firestore error from the submit into a message the applicant can act on. */
function submitErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  const keep = 'Your photos and details are kept; tap Submit again.';
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
    return `No connection, so nothing was sent. Check your internet connection. ${keep}`;
  }
  if (code === 'permission-denied') {
    return 'Your application could not be saved. It may already have been submitted or reviewed; go back to see its status.';
  }
  if (code === 'invalid-argument' || code === 'resource-exhausted') {
    return 'Your photos could not be saved. Please retake them and try again.';
  }
  return `Your application was not submitted. ${keep}`;
}

/**
 * Submit a new application or resubmit a rejected one, with its document photos, in ONE
 * transaction: the photos and the application all save, or nothing does. Tied to the
 * Firebase Auth UID (and its email): one application per account. Status is always
 * `pending`; approval is an administrator action only.
 */
export async function submitDriverApplication(
  user: User,
  email: string,
  input: DriverApplicationInput,
): Promise<void> {
  const validationError = validateInput(user, email, input);
  if (validationError) {
    throw new DriverApplicationServiceError(validationError);
  }

  const applicationRef = doc(firestore, COLLECTIONS.driverApplications, user.uid);

  // Check before sending the photos so a duplicate submission fails fast.
  const existing = await getDoc(applicationRef).catch(() => null);
  const existingStatus = existing?.exists()
    ? (existing.data().status as DriverApplicationStatus)
    : null;
  if (existingStatus === 'pending' || existingStatus === 'approved') {
    throw new DriverApplicationServiceError(
      existingStatus === 'approved'
        ? 'Your driver application has already been approved.'
        : 'You already have a driver application waiting for verification.',
    );
  }

  const firstName = normalizePersonName(input.firstName);
  const middleName = normalizePersonName(input.middleName) || null;
  const lastName = normalizePersonName(input.lastName);
  const submittedFields = {
    firstName,
    middleName,
    lastName,
    fullName: composeFullName(firstName, middleName, lastName),
    email,
    mobileNumber: user.mobileNumber,
    vehicleType: input.vehicleType,
    vehiclePlate: normalizeVehiclePlate(input.vehiclePlate),
    vehicleBrand: normalizeVehicleText(input.vehicleBrand),
    vehicleModel: normalizeVehicleText(input.vehicleModel),
    vehicleColor: normalizeVehicleText(input.vehicleColor),
    status: 'pending' as const,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Required by the rules on every submit and resubmit: the current legal version, now.
    privacyNoticeVersion: LEGAL_VERSION,
    privacyNoticeAcknowledgedAt: serverTimestamp(),
  };

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(applicationRef);
      if (snapshot.exists() && snapshot.data().status !== 'rejected') {
        throw new DriverApplicationServiceError(
          'You already have a driver application. Duplicate applications are not allowed.',
        );
      }

      // New photos are written here; kept ones are only referenced (firestore.rules).
      const documents = {} as Record<DriverApplicationDocumentType, ApplicationDocumentReference>;
      for (const documentType of APPLICATION_DOCUMENT_TYPES) {
        documents[documentType] = applicationDocumentStore.addToSubmit(
          transaction,
          user.uid,
          documentType,
          input.documents[documentType]!,
        );
      }

      if (!snapshot.exists()) {
        transaction.set(applicationRef, {
          uid: user.uid,
          ...submittedFields,
          documents,
          adminRemarks: null,
          reviewedAt: null,
        });
        return;
      }

      // Controlled resubmission after rejection; admin remarks and review details stay.
      transaction.update(applicationRef, { ...submittedFields, documents });
    });
  } catch (error) {
    if (error instanceof DriverApplicationServiceError) {
      throw error;
    }

    throw new DriverApplicationServiceError(submitErrorMessage(error));
  }
}

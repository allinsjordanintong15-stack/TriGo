import { COLLECTIONS, firestore, storage, STORAGE_PATHS } from '@/firebase';
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
  validateDocumentImage,
  validatePersonName,
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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export class DriverApplicationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverApplicationServiceError';
  }
}

/** An image picked on the device that has not been uploaded yet. */
export interface LocalDocumentImage {
  kind: 'local';
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
}

/** A document already uploaded with a previous (rejected) submission. */
export interface UploadedDocumentImage {
  kind: 'uploaded';
  document: DriverApplicationDocument;
}

export type ApplicationDocumentImage = LocalDocumentImage | UploadedDocumentImage;

export interface DriverApplicationInput {
  firstName: string;
  middleName: string;
  lastName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  documents: Record<DriverApplicationDocumentType, ApplicationDocumentImage | null>;
}

export const DOCUMENT_LABELS: Record<DriverApplicationDocumentType, string> = {
  orCr: 'OR/CR of Vehicle',
  ltoLicense: "LTO-Verified Driver's License",
};

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

function toApplicationDocument(value: unknown): DriverApplicationDocument | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.storagePath !== 'string' || typeof data.downloadUrl !== 'string') return null;

  return {
    storagePath: data.storagePath,
    downloadUrl: data.downloadUrl,
    fileName: typeof data.fileName === 'string' ? data.fileName : '',
    contentType: typeof data.contentType === 'string' ? data.contentType : '',
    uploadedAt: toDate(data.uploadedAt),
  };
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

/** Read a local file URI into a Blob (XHR is the reliable way in React Native). */
function readFileAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.onload = () => resolve(request.response as Blob);
    request.onerror = () => reject(new Error('Unable to read the selected image.'));
    request.responseType = 'blob';
    request.open('GET', uri, true);
    request.send(null);
  });
}

async function uploadDocumentImage(
  uid: string,
  documentType: DriverApplicationDocumentType,
  image: LocalDocumentImage,
): Promise<Omit<DriverApplicationDocument, 'uploadedAt'>> {
  const storagePath = STORAGE_PATHS.driverApplicationDocument(uid, documentType);
  const blob = await readFileAsBlob(image.uri);

  try {
    // Fixed path per document type: replacing an image overwrites the previous upload.
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: image.mimeType });
    const downloadUrl = await getDownloadURL(storageRef);
    return { storagePath, downloadUrl, fileName: image.fileName, contentType: image.mimeType };
  } finally {
    (blob as Blob & { close?: () => void }).close?.();
  }
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
    (input.documents.orCr ? null : 'Please add a photo of your OR/CR.') ??
    (input.documents.ltoLicense ? null : "Please add a photo of your LTO-verified driver's license.")
  );
}

/**
 * Upload the documents, then submit a new application or resubmit a rejected one.
 * Tied to the Firebase Auth UID (and its email): one application per account. Status is
 * always `pending`; approval is an administrator action only.
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

  for (const image of Object.values(input.documents)) {
    if (image?.kind === 'local') {
      const imageError = validateDocumentImage(image);
      if (imageError) throw new DriverApplicationServiceError(imageError);
    }
  }

  const applicationRef = doc(firestore, COLLECTIONS.driverApplications, user.uid);

  // Check before uploading so a duplicate submission fails fast without touching Storage.
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

  const documents: Record<string, unknown> = {};
  try {
    for (const documentType of ['orCr', 'ltoLicense'] as const) {
      const image = input.documents[documentType]!;
      if (image.kind === 'uploaded') {
        documents[documentType] = image.document;
      } else {
        const uploaded = await uploadDocumentImage(user.uid, documentType, image);
        documents[documentType] = { ...uploaded, uploadedAt: serverTimestamp() };
      }
    }
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    throw new DriverApplicationServiceError(
      code === 'storage/unauthorized'
        ? 'Your documents could not be uploaded. Please check that each file is an image under 10 MB.'
        : code.startsWith('storage/')
          ? 'Document upload is not available right now. Please try again later.'
          : 'Unable to upload your documents. Please check your internet connection and try again.',
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
    documents,
    status: 'pending' as const,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(applicationRef);

      if (!snapshot.exists()) {
        transaction.set(applicationRef, {
          uid: user.uid,
          ...submittedFields,
          adminRemarks: null,
          reviewedAt: null,
        });
        return;
      }

      const status = snapshot.data().status as DriverApplicationStatus;
      if (status !== 'rejected') {
        throw new DriverApplicationServiceError(
          'You already have a driver application. Duplicate applications are not allowed.',
        );
      }

      // Controlled resubmission after rejection; admin remarks and review details stay.
      transaction.update(applicationRef, submittedFields);
    });
  } catch (error) {
    if (error instanceof DriverApplicationServiceError) {
      throw error;
    }

    throw new DriverApplicationServiceError(
      'Unable to submit your application. Please check your internet connection and try again.',
    );
  }
}

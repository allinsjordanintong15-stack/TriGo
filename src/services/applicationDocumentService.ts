// Driver application document photos: preparing (compressing) them on the device and
// writing them in the submit transaction. The only place in the app that knows where the
// photos live: driverApplications/{uid}/documents/{docType}, as a base64 STRING
// (`dataBase64`), never Firestore Bytes (shared/documents; docs/DECISIONS.md 2026-11-17).
//
// The app NEVER reads or listens to the photo documents. Firebase's React Native SDK decoded
// received photo bytes with String.fromCharCode.apply and crashed the whole Firestore client
// on Hermes; reading nearly 1 MB per photo on a phone is wasteful anyway. A photo on file is
// known only from the application's small reference {sizeBytes, uploadedAt}.

import {
  ApplicationDocumentType,
  DOCUMENT_IMAGE_MAX_BYTES,
  DOCUMENT_IMAGE_MAX_SIDE,
  DOCUMENT_IMAGE_MIME_TYPE,
} from '@/constants/applicationDocuments';
import { COLLECTIONS, firestore } from '@/firebase';
import {
  base64ByteLength,
  compressWithSteps,
  isStoredBase64,
  type CompressionStep,
  type Dimensions,
} from '@/utils/documentCompression';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { doc, serverTimestamp, Timestamp, type FieldValue, type Transaction } from 'firebase/firestore';

export type ApplicationDocumentErrorReason = 'too-large' | 'not-a-photo' | 'unreadable';

export class ApplicationDocumentError extends Error {
  constructor(
    readonly reason: ApplicationDocumentErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationDocumentError';
  }
}

/** A photo compressed on the device, ready to be written with the submit. */
export interface PreparedDocumentImage {
  kind: 'prepared';
  /** The compressed JPEG on the device (for previews). */
  uri: string;
  /** The same JPEG, base64-encoded (the text that is stored). */
  base64: string;
  /** Decoded JPEG size. */
  sizeBytes: number;
  width: number;
  height: number;
}

/**
 * A photo already on file from an earlier submission, known only from the application's
 * reference (the photo itself is never read on the phone). Kept on resubmit unless retaken.
 */
export interface StoredDocumentImage {
  kind: 'stored';
  sizeBytes: number;
  /** The stored time exactly as written; a kept photo's reference must repeat it. */
  uploadedAt: Timestamp;
}

export type ApplicationDocumentImage = PreparedDocumentImage | StoredDocumentImage;

/** What the application stores about each photo: {sizeBytes, uploadedAt} (firestore.rules). */
export interface ApplicationDocumentReference {
  sizeBytes: number;
  uploadedAt: Timestamp | FieldValue;
}

/** Where the photos live. Swap the implementation to move them (e.g. to Cloud Storage). */
export interface ApplicationDocumentStore {
  /**
   * Adds the photo's write to the submit transaction and returns the reference to put on
   * the application. A kept (stored) photo is not written again.
   */
  addToSubmit(
    transaction: Transaction,
    uid: string,
    docType: ApplicationDocumentType,
    image: ApplicationDocumentImage,
  ): ApplicationDocumentReference;
}

function documentRef(uid: string, docType: ApplicationDocumentType) {
  return doc(firestore, COLLECTIONS.driverApplications, uid, 'documents', docType);
}

/** Thrown before anything is sent when a prepared photo's text is not what the rules accept. */
export class InvalidDocumentDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentDataError';
  }
}

const firestoreDocumentStore: ApplicationDocumentStore = {
  addToSubmit(transaction, uid, docType, image) {
    if (image.kind === 'stored') {
      return { sizeBytes: image.sizeBytes, uploadedAt: image.uploadedAt };
    }
    const dataBase64 = image.base64.replace(/\s/g, '');
    const sizeBytes = base64ByteLength(dataBase64);
    if (!isStoredBase64(dataBase64) || sizeBytes < 1) {
      throw new InvalidDocumentDataError(`Invalid base64 for ${docType} (length ${dataBase64.length}).`);
    }
    if (sizeBytes > DOCUMENT_IMAGE_MAX_BYTES) {
      throw new InvalidDocumentDataError(`${docType} is too large: ${sizeBytes} bytes.`);
    }
    const uploadedAt = serverTimestamp();
    transaction.set(documentRef(uid, docType), {
      uid,
      docType,
      mimeType: DOCUMENT_IMAGE_MIME_TYPE,
      dataBase64,
      // The decoded JPEG size; the rules check it against the text length.
      sizeBytes,
      width: image.width,
      height: image.height,
      uploadedAt,
    });
    return { sizeBytes, uploadedAt };
  },
};

export const applicationDocumentStore: ApplicationDocumentStore = firestoreDocumentStore;

/** The picker's result for one photo (expo-image-picker asset fields used here). */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  type?: string | null;
  mimeType?: string | null;
}

const TOO_LARGE_MESSAGE =
  'This photo is still too large after compressing it. Please take the photo again a little further away, or choose a different photo.';

/**
 * Compresses a picked photo: longest side 1600 px at JPEG quality 0.7, then lower quality
 * (down to 0.5), then 1280 px, stopping at 600 KB; never more than 700 KB.
 */
export async function prepareDocumentImage(photo: PickedPhoto): Promise<PreparedDocumentImage> {
  const isPhoto =
    (photo.type == null || photo.type === 'image') &&
    (photo.mimeType == null || photo.mimeType.toLowerCase().startsWith('image/'));
  if (!isPhoto) {
    throw new ApplicationDocumentError(
      'not-a-photo',
      'Only photos can be used. PDFs and other files are not supported; please take a photo of the document instead.',
    );
  }

  // One resize per longest side; each quality is a separate save of the same render.
  const rendered = new Map<number, ImageRef>();
  try {
    const original: Dimensions = { width: photo.width, height: photo.height };
    const encode = async (step: CompressionStep, size: Dimensions) => {
      let image = rendered.get(step.longSide);
      if (!image) {
        const context = ImageManipulator.manipulate(photo.uri);
        if (size.width !== original.width || size.height !== original.height) {
          context.resize(size.width >= size.height ? { width: size.width } : { height: size.height });
        }
        image = await context.renderAsync();
        rendered.set(step.longSide, image);
      }
      const saved = await image.saveAsync({ compress: step.quality, format: SaveFormat.JPEG, base64: true });
      const base64 = saved.base64 ?? '';
      return { uri: saved.uri, base64, width: saved.width, height: saved.height, sizeBytes: base64ByteLength(base64) };
    };

    // Unknown dimensions (0): render once at full size to learn them.
    if (!original.width || !original.height) {
      const probe = await ImageManipulator.manipulate(photo.uri).renderAsync();
      original.width = probe.width;
      original.height = probe.height;
      probe.release();
    }

    const outcome = await compressWithSteps(encode, original);
    if (!outcome.ok) throw new ApplicationDocumentError('too-large', TOO_LARGE_MESSAGE);
    const { uri, base64, sizeBytes, width, height } = outcome.image;
    if (!base64 || width > DOCUMENT_IMAGE_MAX_SIDE || height > DOCUMENT_IMAGE_MAX_SIDE) {
      throw new ApplicationDocumentError('unreadable', 'This photo could not be prepared. Please try another photo.');
    }
    return { kind: 'prepared', uri, base64, sizeBytes, width, height };
  } catch (error) {
    if (error instanceof ApplicationDocumentError) throw error;
    throw new ApplicationDocumentError(
      'unreadable',
      'This photo could not be read. Please take the photo again or choose another one.',
    );
  } finally {
    for (const image of rendered.values()) image.release();
  }
}

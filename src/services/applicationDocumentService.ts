// Driver application document photos: preparing (compressing) them on the device, writing
// them in the submit transaction, and reading them back. The only place that knows where the
// photos live. Today: Firestore bytes at driverApplications/{uid}/documents/{docType}
// (Cloud Storage needs the Blaze plan; docs/DECISIONS.md 2026-11-17). Moving to Cloud
// Storage later means a second ApplicationDocumentStore, not changes to the screens.

import {
  ApplicationDocumentType,
  DOCUMENT_IMAGE_MAX_SIDE,
  DOCUMENT_IMAGE_MIME_TYPE,
} from '@/constants/applicationDocuments';
import { COLLECTIONS, firestore } from '@/firebase';
import { base64ByteLength, compressWithSteps, type CompressionStep, type Dimensions } from '@/utils/documentCompression';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import {
  Bytes,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  type FieldValue,
  type Transaction,
} from 'firebase/firestore';

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
  /** The same JPEG, base64-encoded (the bytes that are written). */
  base64: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/** A photo already on file from an earlier submission (kept on resubmit unless retaken). */
export interface StoredDocumentImage {
  kind: 'stored';
  /** data: URI for previews. */
  uri: string;
  sizeBytes: number;
  width: number;
  height: number;
  /** The stored time as written; a kept photo's reference must repeat it exactly. */
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
  /** The applicant's photo on file, or null when there is none. */
  load(uid: string, docType: ApplicationDocumentType): Promise<StoredDocumentImage | null>;
}

function documentRef(uid: string, docType: ApplicationDocumentType) {
  return doc(firestore, COLLECTIONS.driverApplications, uid, 'documents', docType);
}

const firestoreDocumentStore: ApplicationDocumentStore = {
  addToSubmit(transaction, uid, docType, image) {
    if (image.kind === 'stored') {
      return { sizeBytes: image.sizeBytes, uploadedAt: image.uploadedAt };
    }
    const uploadedAt = serverTimestamp();
    transaction.set(documentRef(uid, docType), {
      uid,
      docType,
      mimeType: DOCUMENT_IMAGE_MIME_TYPE,
      data: Bytes.fromBase64String(image.base64),
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      uploadedAt,
    });
    return { sizeBytes: image.sizeBytes, uploadedAt };
  },

  async load(uid, docType) {
    const snapshot = await getDoc(documentRef(uid, docType));
    const data = snapshot.data();
    if (!snapshot.exists() || !data || !(data.data instanceof Bytes) || !(data.uploadedAt instanceof Timestamp)) {
      return null;
    }
    return {
      kind: 'stored',
      uri: `data:${DOCUMENT_IMAGE_MIME_TYPE};base64,${data.data.toBase64()}`,
      sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
      width: typeof data.width === 'number' ? data.width : 0,
      height: typeof data.height === 'number' ? data.height : 0,
      uploadedAt: data.uploadedAt,
    };
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
 * (down to 0.5), then 1280 px, stopping at 700 KB; never more than 900 KB.
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
